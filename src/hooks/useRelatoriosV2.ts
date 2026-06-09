import { useQuery } from "@tanstack/react-query";
import { useOficina } from "@/contexts/OficinaContext";
import { financeiroV2Service, type FinanceiroV2Response } from "@/services/financeiroV2Service";

/**
 * Hook para Relatórios V2 - PORTÃO 4.
 * Consome exclusivamente o motor financeiro V2.
 * Implementa separação absoluta Competência vs Caixa.
 */
export function useRelatoriosV2(inicio: string, fim: string) {
  const { oficinaAtual } = useOficina();

  return useQuery({
    queryKey: ["financeiro-v2-relatorios", oficinaAtual?.id, inicio, fim],
    queryFn: async () => {
      if (!oficinaAtual?.id) return null;
      return await financeiroV2Service.getMetrics(oficinaAtual.id, inicio, fim);
    },
    enabled: !!oficinaAtual?.id,
    staleTime: 60000,
  });
}
