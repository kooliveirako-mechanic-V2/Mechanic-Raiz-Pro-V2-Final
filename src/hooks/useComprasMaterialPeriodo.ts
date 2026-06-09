import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { startOfMonth, endOfMonth } from "date-fns";

interface ComprasMaterialResult {
  total: number;
  quantidadeEntradas: number;
  inicio: string;
  fim: string;
}

/**
 * Soma o quanto saiu de caixa em compras de PEÇAS / MATERIAL no período.
 * Fonte: estoque_movimentacoes (tipo='entrada') * custo_unitario.
 * Exclui itens do tipo 'servico' (catálogo de serviços não é compra real).
 *
 * IMPORTANTE: leitura somente. NÃO altera estoque, OS, nem financeiro.
 * Pode ser chamado com filtro de data; sem filtro = mês atual.
 */
export function useComprasMaterialPeriodo(dateFilter: { start: string; end: string } | null) {
  const { oficinaAtual } = useOficina();
  const oficinaId = oficinaAtual?.id;

  const inicio = dateFilter?.start ?? startOfMonth(new Date()).toISOString().slice(0, 10);
  const fim = dateFilter?.end ?? endOfMonth(new Date()).toISOString().slice(0, 10);

  return useQuery<ComprasMaterialResult>({
    queryKey: ["compras-material-periodo", oficinaId, inicio, fim],
    enabled: !!oficinaId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!oficinaId) return { total: 0, quantidadeEntradas: 0, inicio, fim };

      // Janela: [inicio 00:00, fim+1d 00:00)
      const inicioISO = `${inicio}T00:00:00`;
      const fimDate = new Date(`${fim}T00:00:00`);
      fimDate.setDate(fimDate.getDate() + 1);
      const fimISO = fimDate.toISOString();

      const { data, error } = await supabase
        .from("estoque_movimentacoes")
        .select("quantidade, custo_unitario, estoque:estoque_id(tipo_item, custo_unitario)")
        .eq("oficina_id", oficinaId)
        .eq("tipo", "entrada")
        .gte("created_at", inicioISO)
        .lt("created_at", fimISO);

      if (error) {
        console.warn("[useComprasMaterialPeriodo] erro:", error);
        return { total: 0, quantidadeEntradas: 0, inicio, fim };
      }

      let total = 0;
      let count = 0;
      for (const row of data ?? []) {
        // Ignora movimentações vinculadas a serviço puro
        const est = (row as any)?.estoque;
        const tipoItem = est?.tipo_item;
        if (tipoItem === "servico") continue;
        const qtd = Number((row as any).quantidade) || 0;
        // Fallback: muitas movimentações não gravam custo_unitario — usa o do cadastro do item
        const custoMov = Number((row as any).custo_unitario);
        const custoEst = Number(est?.custo_unitario);
        const custo = custoMov > 0 ? custoMov : (custoEst > 0 ? custoEst : 0);
        if (qtd <= 0 || custo <= 0) continue;
        total += qtd * custo;
        count += 1;
      }

      return { total, quantidadeEntradas: count, inicio, fim };
    },
  });
}
