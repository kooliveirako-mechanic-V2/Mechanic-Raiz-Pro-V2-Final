import { useQuery } from "@tanstack/react-query";
import { useOficina } from "@/contexts/OficinaContext";
import { startOfMonth, endOfMonth, format, subMonths } from "date-fns";
import { financeiroV2Service } from "@/services/financeiroV2Service";

export interface DashboardV2Metrics {
  faturamentoMes: number;
  lucroOperacional: number;
  cmvTotal: number;
  caixa: number;
  entradasPagas: number;
  saidasPagas: number;
  saldoAReceber: number;
  clientesMes: number;
  servicosFinalizados: number;
  vendasBalcao: number;
  avisos: string[];
  modo?: string;
  registrosIgnorados?: any[];
}

/**
 * Hook do Dashboard V2 - PORTÃO 3.5.
 * Consome exclusivamente o financeiroV2Service.
 */
export function useDashboardV2() {
  const { oficinaAtual } = useOficina();

  // 1. Métricas do Mês Atual
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ["financeiro-v2-dashboard-atual", oficinaAtual?.id],
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
    queryKey: ["financeiro-v2-dashboard-series", oficinaAtual?.id],
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

  const dashboardMetrics: DashboardV2Metrics | null = metrics ? {
    faturamentoMes: metrics.competencia.faturamento_liquido,
    lucroOperacional: metrics.resultado.lucro_operacional,
    cmvTotal: metrics.custos.cmv_total,
    caixa: metrics.caixa.saldo_caixa_periodo,
    entradasPagas: metrics.caixa.entradas_pagas_no_periodo,
    saidasPagas: metrics.caixa.saidas_pagas_no_periodo,
    saldoAReceber: metrics.competencia.saldo_a_receber_competencia,
    clientesMes: metrics.contadores.servicos_finalizados + metrics.contadores.vendas_balcao, // V2 principal não conta clientes distintos por mês para performance
    servicosFinalizados: metrics.contadores.servicos_finalizados,
    vendasBalcao: metrics.contadores.vendas_balcao,
    avisos: metrics.auditoria.avisos,
    modo: (metrics as any).modo,
    registrosIgnorados: (metrics as any).auditoria?.registros_ignorados_por_manifesto
  } : null;

  return {
    metrics: dashboardMetrics,
    history: history?.series || [],
    isLoading: metricsLoading || historyLoading,
    error: metricsError || historyError,
  };
}
