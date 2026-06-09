import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Wrench,
  Package,
  Receipt,
  BarChart3,
  Loader2,
  TrendingUp,
  Trash2,
  FileText,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import { formatCurrency } from "@/lib/formatters";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { getUnifiedSeries } from "@/services/financeiroService";
import { FinanceiroFormModal } from "@/components/forms/FinanceiroFormModal";
import { FinanceiroPreFiscalExport } from "@/components/financeiro/FinanceiroPreFiscalExport";
import { VendaBalcaoDetalheModal } from "@/components/vendas/VendaBalcaoDetalheModal";
import { DraftResumeBanner } from "@/components/DraftResumeBanner";
import { useOficina } from "@/contexts/OficinaContext";
import { useMobileV2 } from "@/hooks/useMobileV2";
import { FEATURE_FLAGS_V2 } from "@/config/featureFlagsV2";
import { Shield } from "lucide-react";

// FEATURE FLAG: FINANCEIRO_V2_MOBILE_ENABLED
export const FINANCEIRO_V2_MOBILE_ENABLED = FEATURE_FLAGS_V2.MOBILE_V2_ENABLED;

export function MobileFinanceiro() {
  const [activeTab, setActiveTab] = useState("all");
  const [showChart, setShowChart] = useState(true);
  const [financeiroModalOpen, setFinanceiroModalOpen] = useState(false);
  const [vendaDetalheId, setVendaDetalheId] = useState<string | null>(null);
  const [tipoModal, setTipoModal] = useState<"entrada" | "saida">("entrada");
  const { 
    registros, 
    totalEntradas, 
    totalSaidas, 
    lucroTotal, 
    faturamentoMes,
    lucroOperacional,
    cmvTotal,
    perdasOperacionais,
    saldoAReceber,
    isLoading, 
    deleteRegistro 
  } = useFinanceiro();
  const { oficinaAtual } = useOficina();

  // Hook V2 (condicional)
  const { metrics: metricsV2, history: historyV2, isLoading: isLoadingV2 } = useMobileV2();

  const isV2 = FINANCEIRO_V2_MOBILE_ENABLED;

  const handleOpenModal = (tipo: "entrada" | "saida") => {
    setTipoModal(tipo);
    setFinanceiroModalOpen(true);
  };

  // Transform real data for display
  const transactions = useMemo(() => {
    return registros.slice(0, 10).map((r) => ({
      id: r.id,
      type: r.tipo as "entrada" | "saida",
      category: r.origem,
      description: r.descricao || r.origem,
      value: Number(r.valor),
      date: format(new Date(r.data), "dd/MM"),
      hora: r.created_at ? format(new Date(r.created_at), "HH:mm") : null,
      isVendaBalcao: (r as any).categoria === "venda_balcao" || r.origem === "Venda Balcão",
    }));
  }, [registros]);


  // BLOQUEIO 1: Gráfico usando Fonte Única (RPC get_financeiro_series_unificadas)
  const { data: chartData = [] } = useQuery({
    queryKey: ["financeiro-series-mobile", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      const inicio = format(subMonths(startOfMonth(new Date()), 5), "yyyy-MM-dd");
      const fim = format(endOfMonth(new Date()), "yyyy-MM-dd");
      
      const series = await getUnifiedSeries({
        oficinaId: oficinaAtual.id,
        inicio,
        fim
      });

      return series.map(s => ({
        month: s.label,
        receita: s.entradas_caixa // Mobile Financeiro foca em Fluxo de Caixa (Entradas)
      }));
    },
    enabled: !!oficinaAtual,
  });

  const filteredTransactions = transactions.filter((t) => {
    if (activeTab === "all") return true;
    if (activeTab === "income") return t.type === "entrada";
    if (activeTab === "expense") return t.type === "saida";
    return true;
  });

  // CAUSA RAIZ: Usar helper centralizado em vez de formatação local sem decimais

  if (isLoading || (isV2 && isLoadingV2)) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // Mapeamento de métricas conforme flag
  const displayMetrics = isV2 && metricsV2 ? {
    faturamentoMes: metricsV2.competencia.faturamento_liquido,
    lucroOperacional: metricsV2.resultado.lucro_operacional,
    cmvTotal: metricsV2.custos.cmv_total,
    saldoAReceber: metricsV2.competencia.saldo_a_receber_competencia,
    totalEntradas: metricsV2.caixa.entradas_pagas_no_periodo,
    totalSaidas: metricsV2.caixa.saidas_pagas_no_periodo,
    lucroTotal: metricsV2.caixa.saldo_caixa_periodo,
    recebidoVinculado: metricsV2.competencia.recebido_vinculado_competencia,
  } : {
    faturamentoMes,
    lucroOperacional,
    cmvTotal,
    saldoAReceber,
    totalEntradas,
    totalSaidas,
    lucroTotal,
    recebidoVinculado: 0 // Legado não tem esse campo
  };

  const displayChartData = isV2 ? historyV2.map(s => ({
    month: s.mes,
    receita: s.caixa.entradas_pagas_no_periodo
  })) : chartData;

  return (
    <div className="space-y-4 pb-24 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Financeiro</h1>
          <p className="text-xs text-muted-foreground capitalize">{format(new Date(), "MMMM yyyy", { locale: ptBR })}</p>
        </div>
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl"
            onClick={() => setShowChart(!showChart)}
          >
            <BarChart3 className={cn("w-5 h-5", showChart && "text-accent")} />
          </Button>
        </div>
      </div>

      {/* Resumo Financeiro Oficial (V2 ou Legado) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Faturamento</p>
          <p className="text-base font-bold text-foreground">{formatCurrency(displayMetrics.faturamentoMes)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Competência (OS+Vendas)</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Lucro Operacional</p>
          <p className={cn(
            "text-base font-bold",
            displayMetrics.lucroOperacional >= 0 ? "text-success" : "text-destructive"
          )}>
            {formatCurrency(displayMetrics.lucroOperacional)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Margem Real</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">CMV (Custo)</p>
          <p className="text-base font-bold text-destructive">{formatCurrency(displayMetrics.cmvTotal)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Total em peças</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Saldo a Receber</p>
          <p className="text-base font-bold text-accent">{formatCurrency(displayMetrics.saldoAReceber)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {isV2 ? "Da Competência" : "Pendências"}
          </p>
        </div>
      </div>

      {isV2 && (
        <div className="space-y-3">
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-3">
             <p className="text-[10px] text-primary uppercase font-bold tracking-wide">Recebido Vinc. Competência</p>
             <p className="text-sm font-bold text-primary">{formatCurrency(displayMetrics.recebidoVinculado)}</p>
          </div>

          {FEATURE_FLAGS_V2.FINANCEIRO_V2_IGNORE_TEST_MANIFEST_ENABLED && metricsV2 && (metricsV2 as any).modo === "preview_limpeza_logica" && (
            <div className="bg-info/10 border border-info/30 rounded-xl p-3 flex items-start gap-3">
              <Shield className="w-5 h-5 text-info shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[10px] text-info uppercase font-bold tracking-wide">Modo V2 Limpo Ativo</p>
                <p className="text-[11px] text-info/90 leading-tight">
                  Registros de teste ignorados por manifesto ({(metricsV2.auditoria as any).registros_ignorados_por_manifesto?.length || 0} itens). 
                  Nenhum dado real foi alterado fisicamente.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fluxo de Caixa do Período */}
      <div className="flex items-center gap-3 bg-muted/30 rounded-xl border border-border p-3">
        <div className="flex-1 text-center min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Entradas</p>
          <p className="text-xs font-bold text-success truncate">{formatCurrency(displayMetrics.totalEntradas)}</p>
        </div>
        <div className="w-px h-6 bg-border flex-shrink-0" />
        <div className="flex-1 text-center min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Saídas</p>
          <p className="text-xs font-bold text-destructive truncate">{formatCurrency(displayMetrics.totalSaidas)}</p>
        </div>
        <div className="w-px h-6 bg-border flex-shrink-0" />
        <div className="flex-1 text-center min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Saldo Caixa</p>
          <p className={cn(
            "text-xs font-bold truncate",
            displayMetrics.lucroTotal >= 0 ? "text-success" : "text-destructive"
          )}>
            {formatCurrency(displayMetrics.lucroTotal)}
          </p>
        </div>
      </div>


      {/* Botão principal único */}
      <Button 
        className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base"
        onClick={() => handleOpenModal("entrada")}
      >
        <Plus className="w-5 h-5 mr-2" />
        Nova Movimentação
      </Button>

      <FinanceiroFormModal
        open={financeiroModalOpen}
        onOpenChange={setFinanceiroModalOpen}
      />

      {/* BLINDAGEM: banner de retomada de rascunho */}
      <DraftResumeBanner
        draftKey={`financeiro-form-${oficinaAtual?.id || "global"}-new`}
        label="lançamento financeiro"
        hidden={financeiroModalOpen}
        onResume={() => handleOpenModal("entrada")}
      />


      {/* Chart (Collapsible) */}
      {showChart && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-card rounded-xl border border-border p-3"
        >
          <h3 className="text-sm font-semibold text-foreground mb-2">Receita Mensal</h3>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayChartData}>
                <defs>
                  <linearGradient id="colorReceitaMobile" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Area
                  type="monotone"
                  dataKey="receita"
                  stroke="hsl(var(--accent))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorReceitaMobile)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Transactions */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-3 border-b border-border">
          <h3 className="font-semibold text-sm text-foreground">Movimentações</h3>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-3 pt-2">
            <TabsList className="w-full h-8 bg-muted/50 p-0.5">
              <TabsTrigger value="all" className="flex-1 h-7 text-xs">Todas</TabsTrigger>
              <TabsTrigger value="income" className="flex-1 h-7 text-xs">Entradas</TabsTrigger>
              <TabsTrigger value="expense" className="flex-1 h-7 text-xs">Saídas</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={activeTab} className="mt-0">
            <div className="divide-y divide-border">
              {filteredTransactions.length === 0 ? (
                <div className="p-6 text-center">
                  <Receipt className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma movimentação</p>
                </div>
              ) : (
                filteredTransactions.map((transaction, index) => (
                  <motion.div
                    key={transaction.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={cn("p-3 flex items-center gap-2", transaction.isVendaBalcao && "cursor-pointer active:bg-muted/40")}
                    onClick={() => transaction.isVendaBalcao && setVendaDetalheId(transaction.id)}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        transaction.type === "entrada" ? "bg-success/10" : "bg-destructive/10"
                      )}
                    >
                      {transaction.isVendaBalcao ? (
                        <Package className={cn("w-4 h-4 text-success")} />
                      ) : transaction.category === "Serviço" || transaction.category === "servico" ? (
                        <Wrench className={cn(
                          "w-4 h-4",
                          transaction.type === "entrada" ? "text-success" : "text-destructive"
                        )} />
                      ) : transaction.category === "Estoque" || transaction.category === "estoque" ? (
                        <Package className={cn(
                          "w-4 h-4",
                          transaction.type === "entrada" ? "text-success" : "text-destructive"
                        )} />
                      ) : (
                        <Receipt className={cn(
                          "w-4 h-4",
                          transaction.type === "entrada" ? "text-success" : "text-destructive"
                        )} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {transaction.description}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {transaction.category} • {transaction.date}{transaction.hora ? ` ${transaction.hora}` : ""}
                        {transaction.isVendaBalcao && " • toque p/ ver itens"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <p
                        className={cn(
                          "text-xs font-bold whitespace-nowrap",
                          transaction.type === "entrada" ? "text-success" : "text-destructive"
                        )}
                      >
                        {transaction.type === "entrada" ? "+" : "-"}{formatCurrency(transaction.value)}
                      </p>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 min-w-[32px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. O lançamento "{transaction.description}" de {formatCurrency(transaction.value)} será removido permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => deleteRegistro(transaction.id)}
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <VendaBalcaoDetalheModal
        open={!!vendaDetalheId}
        onOpenChange={(o) => { if (!o) setVendaDetalheId(null); }}
        financeiroId={vendaDetalheId}
      />
    </div>
  );
}

