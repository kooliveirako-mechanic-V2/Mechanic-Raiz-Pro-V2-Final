import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { startOfMonth, endOfMonth, format, subMonths } from "date-fns";

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
}

export interface MonthlyStats {
  servicos: number;
  faturamento: number;
  clientes: number;
}

/**
 * Dashboard hook otimizado.
 * 
 * PERF FIX: Dados financeiros agora vêm da RPC get_financeiro_resumo
 * (mesma query key "financeiro-resumo") — zero queries extras à tabela financeiro.
 * Queries não-financeiras (clientes, OS, estoque) continuam independentes.
 */
export function useDashboard() {
  const { oficinaAtual } = useOficina();

  // ── Financeiro consolidado (RPC) ──────────────────────────────
  const { data: finResumo } = useQuery({
    queryKey: ["financeiro-resumo", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return null;
      const { data, error } = await supabase.rpc("get_financeiro_resumo", {
        p_oficina_id: oficinaAtual.id,
        p_meses_historico: 6,
      });
      if (error) throw error;
      return data as unknown as {
        mes_atual: { entradas: number; saidas: number };
        mes_anterior: { entradas: number; saidas: number };
        mensal: Array<{ mes: string; entradas: number; saidas: number }>;
      };
    },
    enabled: !!oficinaAtual,
    staleTime: 30_000,
  });

  // ── Stats (non-financial queries) ─────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard", "stats", oficinaAtual?.id],
    queryFn: async (): Promise<Omit<DashboardStats, "faturamentoMes" | "lucroMes" | "prejuizosMes">> => {
      if (!oficinaAtual) {
        return {
          servicosHoje: 0,
          servicosFinalizadosHoje: 0,
          totalClientes: 0,
          novosClientesMes: 0,
          servicosAtrasados: 0,
          estoqueBaixo: 0,
        };
      }

      const hoje = format(new Date(), "yyyy-MM-dd");
      const inicioMes = format(startOfMonth(new Date()), "yyyy-MM-dd");

      const [servicosHojeRes, totalClientesRes, novosClientesMesRes, servicosAtrasadosRes, estoqueRes] = await Promise.all([
        supabase.from("ordens_servico").select("id, status").eq("oficina_id", oficinaAtual.id).eq("data_servico", hoje),
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("oficina_id", oficinaAtual.id),
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("oficina_id", oficinaAtual.id).gte("created_at", inicioMes),
        supabase.from("ordens_servico").select("id", { count: "exact", head: true }).eq("oficina_id", oficinaAtual.id).in("status", ["pendente", "em_andamento"]).lt("data_servico", hoje),
        supabase.from("estoque").select("id, quantidade, alerta_minimo").eq("oficina_id", oficinaAtual.id).eq("arquivado", false),
      ]);

      if (servicosHojeRes.error) throw servicosHojeRes.error;
      if (estoqueRes.error) throw estoqueRes.error;

      return {
        servicosHoje: servicosHojeRes.data?.length || 0,
        servicosFinalizadosHoje: servicosHojeRes.data?.filter((s) => s.status === "finalizado").length || 0,
        totalClientes: totalClientesRes.count || 0,
        novosClientesMes: novosClientesMesRes.count || 0,
        servicosAtrasados: servicosAtrasadosRes.count || 0,
        estoqueBaixo: estoqueRes.data?.filter((item) => item.quantidade <= item.alerta_minimo).length || 0,
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
        .select(`cliente_id, valor_servico, cliente:clientes(id, nome), itens_os(valor_total, quantidade, valor_unitario)`)
        .eq("oficina_id", oficinaAtual.id)
        .gte("data_servico", inicioMes)
        .lte("data_servico", fimMes);
      if (error) throw error;
      if (!data) return [];

      const grouped = data.reduce((acc, s) => {
        const clienteId = s.cliente_id;
        const clienteNome = (s.cliente as any)?.nome || "Cliente";
        const itens = (s as any).itens_os || [];
        const totalItens = itens.reduce((sum: number, item: any) =>
          sum + (item.valor_total ?? ((item.quantidade || 0) * (item.valor_unitario || 0))), 0);
        // CAUSA RAIZ: valor_servico JÁ inclui itens (via recalcOSTotals). Usar fallback apenas.
        const valorTotal = (Number(s.valor_servico) || 0) > 0 ? (Number(s.valor_servico) || 0) : totalItens;

        if (!acc[clienteId]) {
          acc[clienteId] = { id: clienteId, nome: clienteNome, totalServicos: 0, valorTotal: 0 };
        }
        acc[clienteId].totalServicos += 1;
        acc[clienteId].valorTotal += valorTotal;
        return acc;
      }, {} as Record<string, TopClient>);

      return Object.values(grouped)
        .sort((a, b) => b.totalServicos - a.totalServicos)
        .slice(0, 5);
    },
    enabled: !!oficinaAtual,
  });

  // ── Monthly comparison from RPC (zero extra queries) ──────────
  const { data: monthlyComparisonRaw } = useQuery({
    queryKey: ["dashboard", "monthlyComparison", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return null;

      const prevMonth = subMonths(new Date(), 1);
      const inicioRange = format(startOfMonth(prevMonth), "yyyy-MM-dd");
      const fimRange = format(endOfMonth(new Date()), "yyyy-MM-dd");

      const [servicosData, clientesData] = await Promise.all([
        supabase
          .from("ordens_servico")
          .select("id, data_servico")
          .eq("oficina_id", oficinaAtual.id)
          .eq("status", "finalizado")
          .gte("data_servico", inicioRange)
          .lte("data_servico", fimRange),
        supabase
          .from("clientes")
          .select("id, created_at")
          .eq("oficina_id", oficinaAtual.id)
          .gte("created_at", inicioRange),
      ]);

      const currentKey = format(new Date(), "yyyy-MM");
      const prevKey = format(prevMonth, "yyyy-MM");

      const getMonthServicos = (key: string) =>
        (servicosData.data || []).filter(s => s.data_servico.startsWith(key)).length;
      const getMonthClientes = (key: string) =>
        (clientesData.data || []).filter(c => c.created_at.startsWith(key)).length;

      return {
        servicosCurrentMonth: getMonthServicos(currentKey),
        servicosPrevMonth: getMonthServicos(prevKey),
        clientesCurrentMonth: getMonthClientes(currentKey),
        clientesPrevMonth: getMonthClientes(prevKey),
      };
    },
    enabled: !!oficinaAtual,
  });

  // ── Derive chart data from RPC mensal breakdown ───────────────
  const chartData: ChartData[] = (finResumo?.mensal ?? []).map((m) => {
    const date = new Date(m.mes + "-15"); // mid-month for formatting
    return {
      mes: format(date, "MMM"),
      faturamento: Number(m.entradas) || 0,
      lucro: (Number(m.entradas) || 0) - (Number(m.saidas) || 0),
    };
  });

  // ── Monthly comparison (merge financial from RPC + non-financial) ──
  const monthlyComparison = monthlyComparisonRaw && finResumo ? {
    currentMonth: {
      servicos: monthlyComparisonRaw.servicosCurrentMonth,
      faturamento: Number(finResumo.mes_atual?.entradas) || 0,
      clientes: monthlyComparisonRaw.clientesCurrentMonth,
    },
    previousMonth: {
      servicos: monthlyComparisonRaw.servicosPrevMonth,
      faturamento: Number(finResumo.mes_anterior?.entradas) || 0,
      clientes: monthlyComparisonRaw.clientesPrevMonth,
    },
  } : null;

  const faturamentoMes = Number(finResumo?.mes_atual?.entradas) || 0;
  const saidasMes = Number(finResumo?.mes_atual?.saidas) || 0;

  // Prejuízos do mês (Funcionalidade 2)
  const { data: prejuizosMes = 0 } = useQuery({
    queryKey: ["dashboard", "prejuizos-mes", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return 0;
      const inicio = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const fim = format(endOfMonth(new Date()), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("financeiro")
        .select("valor")
        .eq("oficina_id", oficinaAtual.id)
        .eq("tipo", "saida")
        .eq("categoria", "prejuizo")
        .gte("data", inicio)
        .lte("data", fim);
      if (error) return 0;
      return (data || []).reduce((s, r: any) => s + Number(r.valor || 0), 0);
    },
    enabled: !!oficinaAtual,
    staleTime: 30_000,
  });

  return {
    stats: {
      servicosHoje: stats?.servicosHoje ?? 0,
      servicosFinalizadosHoje: stats?.servicosFinalizadosHoje ?? 0,
      faturamentoMes,
      lucroMes: faturamentoMes - saidasMes,
      prejuizosMes,
      totalClientes: stats?.totalClientes ?? 0,
      novosClientesMes: stats?.novosClientesMes ?? 0,
      servicosAtrasados: stats?.servicosAtrasados ?? 0,
      estoqueBaixo: stats?.estoqueBaixo ?? 0,
    },
    chartData,
    recentServices,
    topServices,
    monthlyComparison,
    topClients,
    isLoading: statsLoading || recentLoading,
  };
}
