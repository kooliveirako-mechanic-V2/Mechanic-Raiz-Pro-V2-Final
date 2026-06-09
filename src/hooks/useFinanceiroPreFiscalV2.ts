import { useQuery } from "@tanstack/react-query";
import { useOficina } from "@/contexts/OficinaContext";
import { financeiroV2Service } from "@/services/financeiroV2Service";

/**
 * Hook para Pré-fiscal V2 - PORTÃO 6B.
 * Consome exclusivamente o motor financeiro V2.
 * Implementa separação absoluta Competência vs Caixa para apoio contábil.
 */
export function useFinanceiroPreFiscalV2(inicio: string, fim: string) {
  const { oficinaAtual } = useOficina();

  return useQuery({
    queryKey: ["financeiro-v2-prefiscal", oficinaAtual?.id, inicio, fim],
    queryFn: async () => {
      if (!oficinaAtual?.id) return null;
      return await financeiroV2Service.getMetrics(oficinaAtual.id, inicio, fim);
    },
    enabled: !!oficinaAtual?.id,
    staleTime: 60000,
  });
}
