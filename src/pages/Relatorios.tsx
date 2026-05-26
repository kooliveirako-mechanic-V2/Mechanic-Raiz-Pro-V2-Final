import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import { useEstoque } from "@/hooks/useEstoque";
import { useOficina } from "@/contexts/OficinaContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
import { subDays, subMonths, format, startOfMonth, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Package,
  Wrench,
  DollarSign,
} from "lucide-react";
import { ExportPDFButton } from "@/components/relatorios/ExportPDFButton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type PeriodoFilter = "30d" | "3m" | "6m" | "1a";

const periodoOptions: { value: PeriodoFilter; label: string }[] = [
  { value: "30d", label: "30 dias" },
  { value: "3m", label: "3 meses" },
  { value: "6m", label: "6 meses" },
  { value: "1a", label: "1 ano" },
];

function getDataInicio(periodo: PeriodoFilter): Date {
  const now = new Date();
  switch (periodo) {
    case "30d": return subDays(now, 30);
    case "3m": return subMonths(now, 3);
    case "6m": return subMonths(now, 6);
    case "1a": return subMonths(now, 12);
  }
}

function PeriodoSelector({ value, onChange }: { value: PeriodoFilter; onChange: (v: PeriodoFilter) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {periodoOptions.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ReportSection({
  title,
  icon: Icon,
  iconColor,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: any;
  iconColor: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 md:p-5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
        </div>
        {open ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>
      {open && <CardContent className="pt-0 pb-5 px-4 md:px-5">{children}</CardContent>}
    </Card>
  );
}

// ─── RELATÓRIO 1: FATURAMENTO ──────────────────────────────
function RelatorioFaturamento() {
  const { oficinaAtual } = useOficina();
  const [periodo, setPeriodo] = useState<PeriodoFilter>("3m");
  const dataInicio = getDataInicio(periodo);

  const { data: financeiro = [], isLoading } = useQuery({
    queryKey: ["relatorio-faturamento", oficinaAtual?.id, periodo],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      const { data, error } = await supabase
        .from("financeiro")
        .select("valor, data, origem, tipo")
        .eq("oficina_id", oficinaAtual.id)
        .eq("tipo", "entrada")
        .gte("data", format(dataInicio, "yyyy-MM-dd"))
        .order("data", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!oficinaAtual,
    staleTime: 60_000,
  });

  const chartData = useMemo(() => {
    const months: Record<string, { mes: string; mao_obra: number; pecas: number }> = {};

    financeiro.forEach((r) => {
      const mesKey = format(new Date(r.data), "yyyy-MM");
      const mesLabel = format(new Date(r.data), "MMM/yy", { locale: ptBR });
      if (!months[mesKey]) months[mesKey] = { mes: mesLabel, mao_obra: 0, pecas: 0 };

      const origem = (r.origem || "").toLowerCase();
      if (origem.includes("comissão")) return; // skip commissions
      if (origem.includes("venda") || origem.includes("peça") || origem.includes("peca")) {
        months[mesKey].pecas += Number(r.valor);
      } else {
        months[mesKey].mao_obra += Number(r.valor);
      }
    });

    return Object.values(months);
  }, [financeiro]);

  const totalPeriodo = financeiro.reduce((s, r) => s + Number(r.valor), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Total no período</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(totalPeriodo)}</p>
        </div>
        <PeriodoSelector value={periodo} onChange={setPeriodo} />
      </div>

      {isLoading ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>
      ) : chartData.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
          Nenhum faturamento no período
        </div>
      ) : (
        <div className="h-56 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name === "mao_obra" ? "Mão de obra" : "Peças",
                ]}
                contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              />
              <Legend formatter={(v) => (v === "mao_obra" ? "Mão de obra" : "Peças")} />
              <Bar dataKey="mao_obra" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pecas" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── RELATÓRIO 2: SERVIÇOS MAIS REALIZADOS ─────────────────
function RelatorioServicos() {
  const { oficinaAtual } = useOficina();
  const [periodo, setPeriodo] = useState<PeriodoFilter>("3m");
  const dataInicio = getDataInicio(periodo);

  const { data: servicos = [], isLoading } = useQuery({
    queryKey: ["relatorio-servicos", oficinaAtual?.id, periodo],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("tipo_servico, valor_servico, status, itens_os(valor_total, quantidade, valor_unitario)")
        .eq("oficina_id", oficinaAtual.id)
        .gte("data_servico", format(dataInicio, "yyyy-MM-dd"));
      if (error) throw error;
      return (data || []).map((s: any) => {
        const totalItens = (s.itens_os || []).reduce((acc: number, item: any) =>
          acc + (item.valor_total ?? ((item.quantidade || 0) * (item.valor_unitario || 0))), 0);
        // CAUSA RAIZ: valor_servico JÁ inclui itens (via recalcOSTotals). Usar fallback apenas.
        return { ...s, valor_total_real: (Number(s.valor_servico) || 0) > 0 ? (Number(s.valor_servico) || 0) : totalItens };
      });
    },
    enabled: !!oficinaAtual,
  });

  const ranking = useMemo(() => {
    const map: Record<string, { nome: string; qtd: number; valor: number }> = {};
    servicos.forEach((s: any) => {
      const key = s.tipo_servico;
      if (!map[key]) map[key] = { nome: key, qtd: 0, valor: 0 };
      map[key].qtd++;
      map[key].valor += Number(s.valor_total_real || s.valor_servico || 0);
    });
    return Object.values(map).sort((a, b) => b.qtd - a.qtd);
  }, [servicos]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{servicos.length} serviços no período</p>
        <PeriodoSelector value={periodo} onChange={setPeriodo} />
      </div>

      {isLoading ? (
        <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>
      ) : ranking.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
          Nenhum serviço no período
        </div>
      ) : (
        <div className="space-y-2">
          {ranking.slice(0, 10).map((item, i) => (
            <div
              key={item.nome}
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/40"
            >
              <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {item.qtd}x realizado
                </p>
              </div>
              <p className="text-sm font-semibold text-foreground shrink-0">
                {formatCurrency(item.valor)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RELATÓRIO 3: ESTOQUE CRÍTICO ──────────────────────────
function RelatorioEstoqueCritico() {
  const navigate = useNavigate();
  const { itensAlertaBaixo } = useEstoque();

  if (itensAlertaBaixo.length === 0) {
    return (
      <div className="py-8 text-center">
        <Package className="w-10 h-10 text-success mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Todo estoque está acima do mínimo!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-3">
        <Badge variant="destructive" className="mr-2">{itensAlertaBaixo.length}</Badge>
        itens abaixo do mínimo
      </p>

      {itensAlertaBaixo.map((item) => {
        const diferenca = item.alerta_minimo - item.quantidade;
        return (
          <div
            key={item.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-destructive/5 border border-destructive/20"
          >
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.nome}</p>
              <p className="text-xs text-muted-foreground">
                Atual: <span className="font-semibold text-destructive">{item.quantidade}</span> · Mínimo: {item.alerta_minimo} · Faltam: {diferenca}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 text-xs h-8"
              onClick={() => navigate("/estoque")}
            >
              Repor
            </Button>
          </div>
        );
      })}
    </div>
  );
}

// ─── PAGE ──────────────────────────────────────────────────
export default function Relatorios() {
  const isMobile = useIsMobile();

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Relatórios</h1>
          </div>
          <ExportPDFButton />
        </div>

        <ReportSection
          title="Faturamento por Período"
          icon={DollarSign}
          iconColor="bg-success/10 text-success"
          defaultOpen={true}
        >
          <RelatorioFaturamento />
        </ReportSection>

        <ReportSection
          title="Serviços Mais Realizados"
          icon={TrendingUp}
          iconColor="bg-primary/10 text-primary"
        >
          <RelatorioServicos />
        </ReportSection>

        <ReportSection
          title="Estoque Crítico"
          icon={AlertTriangle}
          iconColor="bg-destructive/10 text-destructive"
        >
          <RelatorioEstoqueCritico />
        </ReportSection>
      </div>
    </MainLayout>
  );
}
