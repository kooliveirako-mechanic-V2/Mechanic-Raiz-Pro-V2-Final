import { useQuery } from "@tanstack/react-query";
import { useOficina } from "@/contexts/OficinaContext";
import { getUnifiedPreFiscal, UnifiedPreFiscalMetrics } from "@/services/financeiroService";

export type PreFiscalData = UnifiedPreFiscalMetrics;

export function useFinanceiroPreFiscalUnificado(start: string, end: string) {
  const { oficinaAtual } = useOficina();

  return useQuery({
    queryKey: ["financeiro-prefiscal-unificado", oficinaAtual?.id, start, end],
    queryFn: async () => {
      if (!oficinaAtual) return null;
      return getUnifiedPreFiscal({
        oficinaId: oficinaAtual.id,
        inicio: start,
        fim: end,
      });
    },
    enabled: !!oficinaAtual && !!start && !!end,
  });
}
