import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useEstoque } from "@/hooks/useEstoque";
import { useOficina } from "@/contexts/OficinaContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
import { subDays, subMonths, format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FEATURE_FLAGS_V2 } from "@/config/featureFlagsV2";
import { Shield } from "lucide-react";
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Package,
  DollarSign,
  Info,
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
import { getUnifiedMetrics } from "@/services/financeiroService";
import { financeiroV2Service } from "@/services/financeiroV2Service";

// FEATURE FLAG: FINANCEIRO_V2_RELATORIOS_ENABLED
export const FINANCEIRO_V2_RELATORIOS_ENABLED = FEATURE_FLAGS_V2.RELATORIOS_V2_ENABLED;

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

// ─── RELATÓRIO 1: FATURAMENTO (FASE 2C / V2) ────────────────────────
function RelatorioFaturamento() {
  const { oficinaAtual } = useOficina();
  const [periodo, setPeriodo] = useState<PeriodoFilter>("3m");
  
  const { data: chartData = [], isLoading } = useQuery({
    queryKey: ["relatorio-faturamento-unificado", oficinaAtual?.id, periodo, FINANCEIRO_V2_RELATORIOS_ENABLED],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      const data = [];
      const numMonths = periodo === "30d" ? 1 : periodo === "3m" ? 3 : periodo === "6m" ? 6 : 12;
      
      for (let i = numMonths - 1; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const inicio = format(startOfMonth(date), "yyyy-MM-dd");
        const fim = format(endOfMonth(date), "yyyy-MM-dd");
        
        if (FINANCEIRO_V2_RELATORIOS_ENABLED) {
          const m = await financeiroV2Service.getMetrics(oficinaAtual.id, inicio, fim);
          data.push({
            mes: format(date, "MMM/yy", { locale: ptBR }),
            mao_obra: m.competencia.os_liquido,
            pecas: m.competencia.vendas_balcao_liquido,
            faturamento_bruto: m.competencia.faturamento_liquido,
            faturamento_liquido: m.competencia.faturamento_liquido,
            lucro_operacional: m.resultado.lucro_operacional,
            custo_total: m.custos.cmv_total,
            caixa_entradas: m.caixa.entradas_pagas_no_periodo,
            caixa_saidas: m.caixa.saidas_pagas_no_periodo,
            caixa_lucro: m.caixa.saldo_caixa_periodo,
            recebido_vinc: m.competencia.recebido_vinculado_competencia,
            saldo_rec: m.competencia.saldo_a_receber_competencia,
          });
        } else {
          const m = await getUnifiedMetrics({
            oficinaId: oficinaAtual.id,
            inicio,
            fim,
          });
          data.push({
            mes: format(date, "MMM/yy", { locale: ptBR }),
            mao_obra: m?.categorias?.servicos?.liquido ?? 0,
            pecas: m?.categorias?.pecas?.liquido ?? 0,
            faturamento_bruto: m?.faturamento?.bruto ?? 0,
            faturamento_liquido: m?.faturamento?.liquido ?? 0,
            lucro_operacional: m?.operacional?.lucro_operacional ?? 0,
            custo_total: m?.operacional?.custo_pecas ?? 0,
            caixa_entradas: m?.caixa?.entradas_oficina_periodo ?? 0,
            caixa_saidas: m?.caixa?.saidas_oficina_periodo ?? 0,
            caixa_lucro: m?.caixa?.lucro_caixa_oficina_periodo ?? 0,
          });
        }
      }
      return data;
    },
    enabled: !!oficinaAtual,
    staleTime: 60_000,
  });

  const totalFaturamento = chartData.reduce((s, r) => s + r.faturamento_liquido, 0);
  const totalLucro = chartData.reduce((s, r) => s + r.lucro_operacional, 0);

  return (
    <div className="space-y-4">
      {FINANCEIRO_V2_RELATORIOS_ENABLED && (
        <div className="space-y-3 mb-2">
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
            <Info className="w-3 h-3 mr-1" /> Modo Auditoria V2 Ativo
          </Badge>

          {FEATURE_FLAGS_V2.FINANCEIRO_V2_IGNORE_TEST_MANIFEST_ENABLED && (
            <div className="bg-info/10 border border-info/30 rounded-xl p-3 flex items-start gap-3">
              <Shield className="w-5 h-5 text-info shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[10px] text-info uppercase font-bold tracking-wide">Modo V2 Limpo Ativo</p>
                <p className="text-[11px] text-info/90 leading-tight">
                  Registros de teste ignorados por manifesto em todos os indicadores. Nenhum dado real foi alterado fisicamente.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4">
          <div className="border-l border-border pl-4">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Faturamento Líquido (Período)</p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalFaturamento)}</p>
          </div>
          <div className="border-l border-border pl-4">
            <p className="text-[10px] uppercase font-bold text-success">Lucro Operacional (Período)</p>
            <p className="text-xl font-bold text-success">{formatCurrency(totalLucro)}</p>
          </div>
        </div>
        <PeriodoSelector value={periodo} onChange={setPeriodo} />
      </div>

      {isLoading ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>
      ) : chartData.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
          Nenhum dado financeiro no período
        </div>
      ) : (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4}>
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === "mao_obra" ? "Serviços (Líq)" : 
                    name === "pecas" ? "Peças (Líq)" : 
                    name === "lucro_operacional" ? "Lucro Operacional" : "Lucro de Caixa",
                  ]}
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                />
                <Legend />
                <Bar dataKey="mao_obra" name="Serviços (Líq)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pecas" name="Peças (Líq)" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lucro_operacional" name="Lucro Operacional" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="caixa_lucro" name="Lucro de Caixa" fill="hsl(var(--primary))" opacity={0.6} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {FINANCEIRO_V2_RELATORIOS_ENABLED && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 p-4 rounded-2xl bg-muted/30 border border-border/50">
               <div>
                <p className="text-[9px] uppercase font-bold text-muted-foreground">Recebido Vinc.</p>
                <p className="text-sm font-semibold">{formatCurrency(chartData[chartData.length-1].recebido_vinc)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase font-bold text-muted-foreground">Saldo a Rec. (Comp)</p>
                <p className="text-sm font-semibold">{formatCurrency(chartData[chartData.length-1].saldo_rec)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase font-bold text-muted-foreground">Caixa Entradas</p>
                <p className="text-sm font-semibold">{formatCurrency(chartData[chartData.length-1].caixa_entradas)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase font-bold text-muted-foreground">Caixa Saídas</p>
                <p className="text-sm font-semibold">{formatCurrency(chartData[chartData.length-1].caixa_saidas)}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── RELATÓRIO 2: RANKING DE SERVIÇOS (FASE 2C) ──────────────
function RelatorioServicos() {
  const { oficinaAtual } = useOficina();
  const [periodo, setPeriodo] = useState<PeriodoFilter>("3m");
  
  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ["relatorio-servicos-ranking-unificado", oficinaAtual?.id, periodo],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      const now = new Date();
      const inicio = format(getDataInicio(periodo), "yyyy-MM-dd");
      const fim = format(now, "yyyy-MM-dd");
      
      const { data, error } = await supabase.rpc("get_financeiro_rankings_unificados", {
        p_oficina_id: oficinaAtual.id,
        p_data_inicio: inicio,
        p_data_fim: fim,
      });

      if (error) throw error;
      return (data as any)?.servicos || [];
    },
    enabled: !!oficinaAtual,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{ranking.length} categorias de serviço</p>
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
          {ranking.slice(0, 10).map((item: any, i: number) => (
            <div
              key={item.tipo_servico}
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/40"
            >
              <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.tipo_servico}</p>
                <p className="text-xs text-muted-foreground">
                  {item.total_os}x realizado
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-foreground">
                  {formatCurrency(item.faturamento_total)}
                </p>
                <p className="text-[10px] text-success font-medium">
                  Lucro: {formatCurrency(item.lucro_total)}
                </p>
              </div>
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