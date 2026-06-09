import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { OrdemServico } from "@/hooks/useOrdensServico";

/**
 * Busca server-side de Ordens de Serviço — resolve o problema de busca client-side
 * que só encontrava OS já paginadas na memória.
 */
export function useOSSearch(searchTerm: string) {
  const { oficinaAtual } = useOficina();
  const trimmed = searchTerm.trim();
  const enabled = !!oficinaAtual && trimmed.length >= 2;

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["os_search", oficinaAtual?.id, trimmed],
    queryFn: async () => {
      if (!oficinaAtual || trimmed.length < 2) return [];

      const likeTerm = `%${trimmed}%`;
      const isNumero = /^\d+$/.test(trimmed);

      // Base query
      let query = supabase
        .from("ordens_servico")
        .select(`
          *,
          cliente:clientes(id, nome, telefone),
          veiculo:veiculos(id, tipo, marca, modelo, placa)
        `)
        .eq("oficina_id", oficinaAtual.id);

      // Se for número, busca exata por número OS + busca parcial por texto
      if (isNumero) {
        query = query.or(`numero.eq.${trimmed},tipo_servico.ilike.${likeTerm},descricao.ilike.${likeTerm}`);
      } else {
        query = query.or(`tipo_servico.ilike.${likeTerm},descricao.ilike.${likeTerm}`);
      }

      const { data, error } = await query
        .order("data_servico", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Também buscar por nome do cliente e placa (precisa de query separada
      // pois Supabase não suporta .or() em campos de join)
      const { data: byCliente, error: errCliente } = await supabase
        .from("ordens_servico")
        .select(`
          *,
          cliente:clientes!inner(id, nome, telefone),
          veiculo:veiculos(id, tipo, marca, modelo, placa)
        `)
        .eq("oficina_id", oficinaAtual.id)
        .ilike("cliente.nome", likeTerm)
        .order("data_servico", { ascending: false })
        .limit(50);

      const { data: byPlaca, error: errPlaca } = await supabase
        .from("ordens_servico")
        .select(`
          *,
          cliente:clientes(id, nome, telefone),
          veiculo:veiculos!inner(id, tipo, marca, modelo, placa)
        `)
        .eq("oficina_id", oficinaAtual.id)
        .ilike("veiculo.placa", likeTerm)
        .order("data_servico", { ascending: false })
        .limit(50);

      // Merge e deduplica por ID
      const allResults = [...(data || []), ...(byCliente || []), ...(byPlaca || [])];
      const seen = new Set<string>();
      const unique = allResults.filter(os => {
        if (seen.has(os.id)) return false;
        seen.add(os.id);
        return true;
      });

      return unique as OrdemServico[];
    },
    enabled,
    staleTime: 30_000,
  });

  return { results, isLoading: enabled ? isLoading : false, isSearching: enabled };
}
