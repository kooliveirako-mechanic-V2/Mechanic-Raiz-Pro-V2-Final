import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { Cliente } from "@/hooks/useClientes";

/**
 * Busca server-side de clientes — resolve o problema de busca client-side
 * que só encontrava registros já paginados na memória.
 * Normaliza CPF/CNPJ removendo pontos, traços e barras.
 */
export function useClienteSearch(searchTerm: string) {
  const { oficinaAtual } = useOficina();
  const trimmed = searchTerm.trim();
  const enabled = !!oficinaAtual && trimmed.length >= 2;

  // Normaliza o termo para busca de documentos (remove formatação)
  const normalizedTerm = trimmed.replace(/[.\-\/]/g, "");
  const normalizedPhone = trimmed.replace(/\D/g, "");

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["clientes_search", oficinaAtual?.id, trimmed],
    queryFn: async () => {
      if (!oficinaAtual || trimmed.length < 2) return [];

      const likeTerm = `%${trimmed}%`;
      const likeNormalized = `%${normalizedTerm}%`;
      const likePhone = `%${normalizedPhone}%`;

      // Server-side search: nome, email + telefone/CPF-CNPJ normalizados
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("oficina_id", oficinaAtual.id)
        .or(
          `nome.ilike.${likeTerm},telefone_normalizado.ilike.${likePhone},email.ilike.${likeTerm},cpf_cnpj.ilike.${likeNormalized}`
        )
        .order("nome", { ascending: true })
        .limit(50);

      if (error) throw error;
      return data as Cliente[];
    },
    enabled,
    staleTime: 30_000, // 30s cache — evita re-fetch a cada keystroke
  });

  return { results, isLoading: enabled ? isLoading : false, isSearching: enabled };
}
