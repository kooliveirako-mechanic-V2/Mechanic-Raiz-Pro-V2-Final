import { useQuery } from "@tanstack/react-query";
import { useOficina } from "@/contexts/OficinaContext";
import { startOfMonth, endOfMonth, format, subMonths } from "date-fns";
import { financeiroV2Service } from "@/services/financeiroV2Service";

/**
 * Hook para Mobile V2 - PORTÃO 6A.
 * Consome exclusivamente o motor financeiro V2.
 */
export function useMobileV2() {
  const { oficinaAtual } = useOficina();

  // 1. Métricas do Mês Atual
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ["financeiro-v2-mobile-atual", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual?.id) return null;
      const inicio = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const fim = format(endOfMonth(new Date()), "yyyy-MM-dd");
      return await financeiroV2Service.getMetrics(oficinaAtual.id, inicio, fim);
    },
    enabled: !!oficinaAtual?.id,
    staleTime: 30000,
  });

  // 2. Série Histórica (6 meses)
  const { data: history, isLoading: historyLoading, error: historyError } = useQuery({
    queryKey: ["financeiro-v2-mobile-series", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual?.id) return null;
      const seisMesesAtras = subMonths(new Date(), 5);
      const inicio = format(startOfMonth(seisMesesAtras), "yyyy-MM-dd");
      const fim = format(endOfMonth(new Date()), "yyyy-MM-dd");
      return await financeiroV2Service.getSeries(oficinaAtual.id, inicio, fim);
    },
    enabled: !!oficinaAtual?.id,
    staleTime: 60000,
  });

  return {
    metrics,
    history: history?.series || [],
    isLoading: metricsLoading || historyLoading,
    error: metricsError || historyError,
  };
}
