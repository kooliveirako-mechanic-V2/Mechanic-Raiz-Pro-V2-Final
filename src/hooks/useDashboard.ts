import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { startOfMonth, endOfMonth, format, subMonths } from "date-fns";
import { getUnifiedMetrics, type UnifiedMetrics } from "@/services/financeiroService";

export interface DashboardStats {
  servicosHoje: number;
  servicosFinalizadosHoje: number;
  faturamentoMes: number;
  lucroMes: number;
  prejuizosMes: number;
  totalClientes: number;
  novosClientesMes: number;
  servicosAtrasados: number;
  estoqueBaixo: number;
  recebimentosMes: number;
  lucroCaixaMes: number;
  lucroOperacionalMes: number;
  pecasMes: number;
  servicosMaoObraMes: number;
  custoPecasMes: number;
  descontosMes: number;
  alertaItensSemCusto: boolean;
  alertaLucroInflado: boolean;
}

export interface ChartData {
  mes: string;
  faturamento: number;
  lucro: number;
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
 * Dashboard hook otimizado - FASE 2.
 * Consome exclusivamente a fonte única get_metrics_financeiras_unificadas.
 */
export function useDashboard() {
  const { oficinaAtual } = useOficina();

  // ── Fonte Única da Verdade (Mês Atual) ─────────────────────
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ["financeiro-unificado-atual", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual?.id) return null;
      
      const { data, error } = await supabase.rpc(
        'get_metrics_financeiras_unificadas',
        { p_oficina_id: oficinaAtual.id }
      );

      if (error) {
        console.error('[Dashboard] RPC error:', error);
        throw error;
      }
      
      console.log('[Dashboard] RPC result:', data);
      return data as any as UnifiedMetrics;
    },
    enabled: !!oficinaAtual?.id,
    retry: 2,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  // ── Comparativo Mensal (Mês Anterior) ──────────────────────
  const { data: metricsPrev, isLoading: metricsPrevLoading, error: metricsPrevError } = useQuery({
    queryKey: ["financeiro-unificado-anterior", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return null;
      const prevMonth = subMonths(new Date(), 1);
      const inicio = format(startOfMonth(prevMonth), "yyyy-MM-dd");
      const fim = format(endOfMonth(prevMonth), "yyyy-MM-dd");
      return await getUnifiedMetrics({
        oficinaId: oficinaAtual.id,
        inicio,
        fim,
      });
    },
    enabled: !!oficinaAtual,
    staleTime: 60_000,
  });

  // ── Dados Históricos (Breakdown 6 meses) ───────────────────
  // Para manter o gráfico funcionando, buscamos os últimos 6 meses.
  // Idealmente, a RPC deveria retornar isso em uma única chamada, mas por agora chamamos getUnifiedMetrics para cada mês para garantir a fonte da verdade.
  const { data: chartData = [], isLoading: chartLoading, error: chartError } = useQuery({
    queryKey: ["financeiro-unificado-chart", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      const data = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const inicio = format(startOfMonth(date), "yyyy-MM-dd");
        const fim = format(endOfMonth(date), "yyyy-MM-dd");
        const m = await getUnifiedMetrics({ oficinaId: oficinaAtual.id, inicio, fim });
        data.push({
          mes: format(date, "MMM"),
          faturamento: (m as any)?.faturamento?.liquido ?? 0,
          lucro: (m as any)?.operacional?.lucro_operacional ?? 0,
        });
      }
      return data;
    },
    enabled: !!oficinaAtual,
    staleTime: 60_000,
  });

  // ── Stats (non-financial queries) ─────────────────────────────
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ["dashboard", "stats", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return null;

      const hoje = format(new Date(), "yyyy-MM-dd");
      const inicioMes = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const prevMonth = subMonths(new Date(), 1);
      const inicioPrev = format(startOfMonth(prevMonth), "yyyy-MM-dd");
      const fimPrev = format(endOfMonth(prevMonth), "yyyy-MM-dd");

      const [
        servicosHojeRes, 
        totalClientesRes, 
        novosClientesMesRes, 
        servicosAtrasadosRes, 
        estoqueRes,
        servicosAtualRes,
        servicosPrevRes,
        clientesPrevRes
      ] = await Promise.all([
        supabase.from("ordens_servico").select("id, status").eq("oficina_id", oficinaAtual.id).eq("data_servico", hoje),
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("oficina_id", oficinaAtual.id),
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("oficina_id", oficinaAtual.id).gte("created_at", inicioMes),
        supabase.from("ordens_servico").select("id", { count: "exact", head: true }).eq("oficina_id", oficinaAtual.id).in("status", ["pendente", "em_andamento"]).lt("data_servico", hoje),
        supabase.from("estoque").select("id, quantidade, alerta_minimo").eq("oficina_id", oficinaAtual.id).eq("arquivado", false),
        supabase.from("ordens_servico").select("id", { count: "exact", head: true }).eq("oficina_id", oficinaAtual.id).eq("status", "finalizado").gte("data_servico", inicioMes),
        supabase.from("ordens_servico").select("id", { count: "exact", head: true }).eq("oficina_id", oficinaAtual.id).eq("status", "finalizado").gte("data_servico", inicioPrev).lte("data_servico", fimPrev),
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("oficina_id", oficinaAtual.id).gte("created_at", inicioPrev).lte("created_at", fimPrev),
      ]);

      return {
        servicosHoje: servicosHojeRes.data?.length || 0,
        servicosFinalizadosHoje: servicosHojeRes.data?.filter((s) => s.status === "finalizado").length || 0,
        totalClientes: totalClientesRes.count || 0,
        novosClientesMes: novosClientesMesRes.count || 0,
        servicosAtrasados: servicosAtrasadosRes.count || 0,
        estoqueBaixo: estoqueRes.data?.filter((item) => item.quantidade <= item.alerta_minimo).length || 0,
        servicosAtual: servicosAtualRes.count || 0,
        servicosPrev: servicosPrevRes.count || 0,
        clientesPrev: clientesPrevRes.count || 0,
      };
    },
    enabled: !!oficinaAtual,
  });

  // ── Recent services ───────────────────────────────────────────
  const { data: recentServices = [], isLoading: recentLoading } = useQuery({
    queryKey: ["dashboard", "recent", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      const { data, error } = await supabase
        .from("ordens_servico")
        .select(`*, cliente:clientes(id, nome), veiculo:veiculos(id, modelo, placa)`)
        .eq("oficina_id", oficinaAtual.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!oficinaAtual,
  });

  // ── Top serviços (mês atual) ──────────────────────────────────
  const { data: topServices = [] } = useQuery({
    queryKey: ["dashboard", "topServices", oficinaAtual?.id],
    queryFn: async (): Promise<TopService[]> => {
      if (!oficinaAtual) return [];
      const inicioMes = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const fimMes = format(endOfMonth(new Date()), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("ordens_servico")
        .select("tipo_servico")
        .eq("oficina_id", oficinaAtual.id)
        .gte("data_servico", inicioMes)
        .lte("data_servico", fimMes);
      if (error) throw error;
      if (!data) return [];

      const grouped = data.reduce((acc, s) => {
        const tipo = s.tipo_servico || "Outros";
        acc[tipo] = (acc[tipo] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(grouped)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    },
    enabled: !!oficinaAtual,
  });

  // ── Top clientes (mês atual) ─────────────────────────────────
  const { data: topClients = [] } = useQuery({
    queryKey: ["dashboard", "topClients", oficinaAtual?.id],
    queryFn: async (): Promise<TopClient[]> => {
      if (!oficinaAtual) return [];
      const inicioMes = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const fimMes = format(endOfMonth(new Date()), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("ordens_servico")
        .select(`cliente_id, valor_servico, desconto, custo_servico, cliente:clientes(id, nome), itens_os(quantidade, valor_unitario, custo_unitario, valor_total)`)
        .eq("oficina_id", oficinaAtual.id)
        .eq("status", "finalizado")
        .gte("data_conclusao", inicioMes)
        .lte("data_conclusao", fimMes);
      
      if (error) throw error;
      if (!data) return [];

      const grouped = data.reduce((acc, s) => {
        const clienteId = (s as any).cliente_id;
        const clienteNome = (s as any).cliente?.nome || "Cliente";
        const itens = (s as any).itens_os || [];
        
        const faturamentoBruto = Number((s as any).valor_servico || 0);
        const faturamentoLiquido = faturamentoBruto - Number((s as any).desconto || 0);
        const custoItens = itens.reduce((sum: number, i: any) => sum + (Number(i.custo_unitario || 0) * Number(i.quantidade || 1)), 0);
        const lucroOperacional = faturamentoLiquido - custoItens;

        if (!acc[clienteId]) {
          acc[clienteId] = { id: clienteId, nome: clienteNome, totalServicos: 0, valorTotal: 0, lucroTotal: 0 };
        }
        acc[clienteId].totalServicos += 1;
        acc[clienteId].valorTotal += faturamentoLiquido;
        acc[clienteId].lucroTotal += lucroOperacional;
        return acc;
      }, {} as Record<string, TopClient>);

      return Object.values(grouped)
        .sort((a, b) => b.lucroTotal - a.lucroTotal)
        .slice(0, 5);
    },
    enabled: !!oficinaAtual,
  });

  const monthlyComparison = metrics && metricsPrev && stats ? {
    currentMonth: {
      servicos: stats.servicosAtual,
      faturamento: (metrics as any)?.faturamento?.liquido ?? 0,
      clientes: stats.novosClientesMes,
    },
    previousMonth: {
      servicos: stats.servicosPrev,
      faturamento: (metricsPrev as any)?.faturamento?.liquido ?? 0,
      clientes: stats.clientesPrev,
    },
  } : null;

  return {
    stats: {
      servicosHoje: stats?.servicosHoje ?? 0,
      servicosFinalizadosHoje: stats?.servicosFinalizadosHoje ?? 0,
      totalClientes: stats?.totalClientes ?? 0,
      novosClientesMes: stats?.novosClientesMes ?? 0,
      servicosAtrasados: stats?.servicosAtrasados ?? 0,
      estoqueBaixo: stats?.estoqueBaixo ?? 0,
      
      // MÉTRICAS UNIFICADAS (FASE 2)
      faturamentoMes: metrics?.faturamento?.liquido ?? 0,
      recebimentosMes: metrics?.caixa?.recebido_vinculado_competencia ?? 0,
      lucroCaixaMes: metrics?.caixa?.lucro_caixa_oficina_periodo ?? 0,
      lucroOperacionalMes: metrics?.operacional?.lucro_operacional ?? 0,
      pecasMes: metrics?.categorias?.pecas?.liquido ?? 0,
      servicosMaoObraMes: metrics?.categorias?.servicos?.liquido ?? 0,
      custoPecasMes: metrics?.operacional?.custo_pecas ?? 0,
      descontosMes: metrics?.faturamento?.descontos ?? 0,
      alertaItensSemCusto: (metrics?.auditoria?.total_itens_livres_sem_custo ?? 0) > 0,
      alertaLucroInflado: metrics?.auditoria?.alerta_lucro_inflado ?? false,
      
      lucroMes: metrics?.operacional?.lucro_operacional ?? 0,
      prejuizosMes: metrics?.caixa?.saidas_oficina_periodo ?? 0,
    },
    chartData,
    monthlyComparison,
    recentServices,
    topServices,
    topClients,
    error: metricsError || metricsPrevError || chartError || statsError,
    isLoading: statsLoading || recentLoading || metricsLoading || metricsPrevLoading || chartLoading,
  };
}

// Helper para capturar erros específicos (opcional)
function useDashboardError(queries: any[]) {
  return queries.find(q => q.isError)?.error;
}