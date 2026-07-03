import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { startOfMonth, endOfMonth, format, subMonths } from "date-fns";
import { FEATURE_FLAGS_V2 } from "@/config/featureFlagsV2";
import { 
  getUnifiedMetrics, 
  getUnifiedRankings, 
  getUnifiedSeries,
  type UnifiedMetrics, 
  type UnifiedRankings,
  type UnifiedSeriesData 
} from "@/services/financeiroService";
import { useDashboardV2 } from "./useDashboardV2";

// FEATURE FLAG: FINANCEIRO_V2_DASHBOARD_ENABLED
// Se false, mantém dashboard legado. Se true, ativa camada V2.
export const FINANCEIRO_V2_DASHBOARD_ENABLED = FEATURE_FLAGS_V2.DASHBOARD_V2_ENABLED;

export interface UnifiedDashboardMetrics {
  faturamentoMes: number;
  lucroOperacional: number;
  cmvTotal: number;
  perdasOperacionais: number;
  prejuizosMes: number;
  caixa: number;
  entradasPagas: number;
  saidasPagas: number;
  saldoAReceber: number;
  clientesMes: number;
  totalClientes: number; // Novo campo para o card de Clientes
  servicosHoje: number;
  servicosFinalizadosHoje: number;
  servicosAtrasados: number;
  estoqueBaixo: number;
  comparativoMensal: {
    faturamentoAtual: number;
    faturamentoAnterior: number;
    servicosAtual: number;
    servicosAnterior: number;
    clientesAtual: number;
    clientesAnterior: number;
  };
  graficoMensal: Array<{
    mes: string;
    faturamentoLiquido: number;
    lucroOperacional: number;
  }>;
}

export interface TopService {
  name: string;
  value: number;
}

export interface TopClient {
  id: string;
  nome: string;
  totalServicos: number;
  valorTotal: number;
  lucroTotal: number;
}

/**
 * Dashboard hook otimizado - FASE 2B.
 * Consome exclusivamente fontes unificadas de financeiroService.
 */
export function useDashboard() {
  const { oficinaAtual } = useOficina();

  // Hook V2 (sempre instanciado mas condicionalmente usado)
  const dashboardV2Hook = useDashboardV2();
  const { metrics: metricsV2, isLoading: metricsV2Loading, error: metricsV2Error } = dashboardV2Hook;

  // 1. Métricas Principais (Mês Atual) - LEGADO
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ["financeiro-unificado-atual", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual?.id || FINANCEIRO_V2_DASHBOARD_ENABLED) return null;
      return await getUnifiedMetrics({
        oficinaId: oficinaAtual.id,
        inicio: format(startOfMonth(new Date()), "yyyy-MM-dd"),
        fim: format(endOfMonth(new Date()), "yyyy-MM-dd"),
      });
    },
    enabled: !!oficinaAtual?.id && !FINANCEIRO_V2_DASHBOARD_ENABLED,
    staleTime: 30000,
  });

  // 2. Métricas Mês Anterior (para comparativo) - LEGADO
  const { data: metricsPrev, isLoading: metricsPrevLoading } = useQuery({
    queryKey: ["financeiro-unificado-anterior", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual?.id || FINANCEIRO_V2_DASHBOARD_ENABLED) return null;
      const prevMonth = subMonths(new Date(), 1);
      return await getUnifiedMetrics({
        oficinaId: oficinaAtual.id,
        inicio: format(startOfMonth(prevMonth), "yyyy-MM-dd"),
        fim: format(endOfMonth(prevMonth), "yyyy-MM-dd"),
      });
    },
    enabled: !!oficinaAtual?.id && !FINANCEIRO_V2_DASHBOARD_ENABLED,
    staleTime: 60000,
  });

  // 3. Rankings (Top Serviços e Clientes) - Usando RPC unificada
  const { data: rankings, isLoading: rankingsLoading } = useQuery({
    queryKey: ["financeiro-rankings-atual", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual?.id) return null;
      return await getUnifiedRankings({
        oficinaId: oficinaAtual.id,
        inicio: format(startOfMonth(new Date()), "yyyy-MM-dd"),
        fim: format(endOfMonth(new Date()), "yyyy-MM-dd"),
      });
    },
    enabled: !!oficinaAtual?.id,
    staleTime: 60000,
  });

  // 4. Séries Temporais (Gráfico 6 meses) - Usando RPC unificada
  const { data: series, isLoading: seriesLoading } = useQuery({
    queryKey: ["financeiro-series-6meses", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual?.id) return null;
      const seisMesesAtras = subMonths(new Date(), 5);
      return await getUnifiedSeries({
        oficinaId: oficinaAtual.id,
        inicio: format(startOfMonth(seisMesesAtras), "yyyy-MM-dd"),
        fim: format(endOfMonth(new Date()), "yyyy-MM-dd"),
      });
    },
    enabled: !!oficinaAtual?.id,
    staleTime: 60000,
  });

  // 5. Stats Operacionais (não financeiros) - consolidated into single RPC
  const { data: operationalStats, isLoading: operationalLoading } = useQuery({
    queryKey: ["dashboard-operacional", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual?.id) return null;
      const inicioMes = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const fimMes = format(endOfMonth(new Date()), "yyyy-MM-dd");

      const { data, error } = await supabase.rpc("get_dashboard_stats", {
        p_oficina_id: oficinaAtual.id,
        p_data_inicio: inicioMes,
        p_data_fim: fimMes,
      });

      if (error) {
        console.error("[useDashboard] get_dashboard_stats error:", error);
        throw error;
      }

      return {
        servicosHoje: data?.servicos_hoje || 0,
        servicosFinalizadosHoje: data?.servicos_finalizados_hoje || 0,
        totalClientes: data?.total_clientes || 0,
        novosClientesMes: data?.novos_clientes_mes || 0,
        servicosAtrasados: data?.servicos_atrasados || 0,
        estoqueBaixo: data?.estoque_baixo || 0,
        servicosAtualCount: data?.servicos_atual_count || 0,
        servicosPrevCount: data?.servicos_prev_count || 0,
        clientesPrevCount: data?.clientes_prev_count || 0,
      };
    },
    enabled: !!oficinaAtual?.id,
  });

  // 6. Recent services (UI only)
  const { data: recentServices = [], isLoading: recentLoading } = useQuery({
    queryKey: ["dashboard-recentes", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual?.id) return [];
      const { data, error } = await supabase
        .from("ordens_servico")
        .select(`*, cliente:clientes(id, nome), veiculo:veiculos(id, modelo, placa)`)
        .eq("oficina_id", oficinaAtual.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!oficinaAtual?.id,
  });

  // Mapeamento Final para UnifiedDashboardMetrics - SELEÇÃO POR FEATURE FLAG
  const unifiedMetrics: UnifiedDashboardMetrics | null = (() => {
    if (FINANCEIRO_V2_DASHBOARD_ENABLED) {
      if (!metricsV2 || !operationalStats) return null;
      return {
        faturamentoMes: metricsV2.faturamentoMes,
        lucroOperacional: metricsV2.lucroOperacional,
        cmvTotal: metricsV2.cmvTotal,
        perdasOperacionais: 0,
        prejuizosMes: 0,
        caixa: metricsV2.caixa,
        entradasPagas: metricsV2.entradasPagas,
        saidasPagas: metricsV2.saidasPagas,
        saldoAReceber: metricsV2.saldoAReceber,
        clientesMes: metricsV2.clientesMes,
        totalClientes: operationalStats.totalClientes,
        servicosHoje: operationalStats.servicosHoje,
        servicosFinalizadosHoje: operationalStats.servicosFinalizadosHoje,
        servicosAtrasados: operationalStats.servicosAtrasados,
        estoqueBaixo: operationalStats.estoqueBaixo,
        comparativoMensal: {
          faturamentoAtual: metricsV2.faturamentoMes,
          faturamentoAnterior: metricsV2Loading ? 0 : (dashboardV2Hook.history[dashboardV2Hook.history.length - 2]?.competencia.faturamento_liquido || 0),
          servicosAtual: metricsV2.servicosFinalizados,
          servicosAnterior: metricsV2Loading ? 0 : (dashboardV2Hook.history[dashboardV2Hook.history.length - 2]?.contadores.servicos_finalizados || 0),
          clientesAtual: metricsV2.clientesMes,
          clientesAnterior: 0, // V2 history não conta clientes por mês para performance
        },
        graficoMensal: dashboardV2Hook.history.map(s => ({
          mes: s.mes,
          faturamentoLiquido: s.competencia.faturamento_liquido,
          lucroOperacional: s.resultado.lucro_operacional
        })) || [],
      };
    }

    // Fluxo Legado
    if (!metrics || !operationalStats) return null;
    return {
      faturamentoMes: metrics.faturamento.liquido,
      lucroOperacional: metrics.operacional.lucro_operacional,
      cmvTotal: metrics.operacional.custo_pecas,
      perdasOperacionais: (metrics as any).perdas_operacionais?.total ?? 0,
      prejuizosMes: (metrics as any).perdas_operacionais?.total ?? 0,
      caixa: metrics.caixa.lucro_caixa_oficina_periodo,
      entradasPagas: metrics.caixa.entradas_oficina_periodo,
      saidasPagas: metrics.caixa.saidas_oficina_periodo,
      saldoAReceber: metrics.caixa.saldo_a_receber_competencia,
      clientesMes: operationalStats.novosClientesMes,
      totalClientes: operationalStats.totalClientes,
      servicosHoje: operationalStats.servicosHoje,
      servicosFinalizadosHoje: operationalStats.servicosFinalizadosHoje,
      servicosAtrasados: operationalStats.servicosAtrasados,
      estoqueBaixo: operationalStats.estoqueBaixo,
      comparativoMensal: {
        faturamentoAtual: metrics.faturamento.liquido,
        faturamentoAnterior: metricsPrev?.faturamento.liquido || 0,
        servicosAtual: operationalStats.servicosAtualCount,
        servicosAnterior: operationalStats.servicosPrevCount,
        clientesAtual: operationalStats.novosClientesMes,
        clientesAnterior: operationalStats.clientesPrevCount,
      },
      graficoMensal: series?.map(s => ({
        mes: s.label,
        faturamentoLiquido: s.faturamento_liquido,
        lucroOperacional: s.lucro_operacional
      })) || [],
    };
  })();

  // Adaptadores para componentes legados
  const statsAdapter = (() => {
    if (FINANCEIRO_V2_DASHBOARD_ENABLED && unifiedMetrics && metricsV2) {
      return {
        ...unifiedMetrics,
        totalClientes: metricsV2.clientesMes,
        novosClientesMes: metricsV2.clientesMes,
        recebimentosMes: metricsV2.entradasPagas,
        lucroMes: metricsV2.lucroOperacional,
        pecasMes: metricsV2.cmvTotal,
        servicosMaoObraMes: 0, // V2 não separa MAO por enquanto
        custoPecasMes: metricsV2.cmvTotal,
        descontosMes: 0,
        alertaItensSemCusto: false,
        alertaLucroInflado: false,
        modo: (metricsV2 as any).modo,
        registrosIgnoradosCount: (metricsV2 as any).auditoria?.registros_ignorados_por_manifesto?.length || 0,
        lucroCaixaMes: metricsV2.caixa,
        lucroOperacionalMes: metricsV2.lucroOperacional,
      };
    }

    if (!FINANCEIRO_V2_DASHBOARD_ENABLED && unifiedMetrics && metrics) {
      return {
        ...unifiedMetrics,
        totalClientes: operationalStats?.totalClientes || 0,
        novosClientesMes: operationalStats?.novosClientesMes || 0,
        recebimentosMes: metrics.caixa.recebido_vinculado_competencia || 0,
        lucroMes: metrics.operacional.lucro_operacional || 0,
        pecasMes: metrics.faturamento.pecas || 0,
        servicosMaoObraMes: metrics.faturamento.servicos || 0,
        custoPecasMes: metrics.operacional.custo_pecas || 0,
        descontosMes: metrics.faturamento.descontos || 0,
        alertaItensSemCusto: (metrics as any).auditoria?.total_itens_livres_sem_custo > 0,
        alertaLucroInflado: (metrics as any).auditoria?.alerta_lucro_inflado,
        lucroCaixaMes: metrics.caixa.lucro_caixa_oficina_periodo || 0,
        lucroOperacionalMes: metrics.operacional.lucro_operacional || 0,
      };
    }

    return null;
  })();

  const topServices: TopService[] = rankings?.servicos.map(s => ({
    name: s.tipo_servico,
    value: s.total_os
  })) || [];

  const topClients: TopClient[] = rankings?.clientes.map(c => ({
    id: c.id,
    nome: c.nome,
    totalServicos: c.total_os,
    valorTotal: c.faturamento_total,
    lucroTotal: c.lucro_total
  })) || [];

  return {
    metrics: unifiedMetrics,
    stats: statsAdapter, // Retrocompatibilidade
    chartData: unifiedMetrics?.graficoMensal || [],
    monthlyComparison: unifiedMetrics?.comparativoMensal ? {
      currentMonth: {
        servicos: unifiedMetrics.comparativoMensal.servicosAtual,
        faturamento: unifiedMetrics.comparativoMensal.faturamentoAtual,
        clientes: unifiedMetrics.comparativoMensal.clientesAtual,
      },
      previousMonth: {
        servicos: unifiedMetrics.comparativoMensal.servicosAnterior,
        faturamento: unifiedMetrics.comparativoMensal.faturamentoAnterior,
        clientes: unifiedMetrics.comparativoMensal.clientesAnterior,
      },
    } : null,
    recentServices,
    topServices,
    topClients,
    isLoading: metricsLoading || metricsPrevLoading || rankingsLoading || seriesLoading || operationalLoading || recentLoading || (FINANCEIRO_V2_DASHBOARD_ENABLED && metricsV2Loading),
    error: metricsError || (FINANCEIRO_V2_DASHBOARD_ENABLED ? (metricsV2Error as any) : null),
    auditoriaLimpa: (metricsV2 as any)?.modo === "preview_limpeza_logica" ? {
      isModoLimpo: true,
      registrosIgnorados: (metricsV2 as any).auditoria?.registros_ignorados_por_manifesto || []
    } : { isModoLimpo: false, registrosIgnorados: [] }
  };
}
