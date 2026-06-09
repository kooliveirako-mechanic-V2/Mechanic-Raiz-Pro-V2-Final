import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Wrench,
  Eye,
  EyeOff,
  Package,
  Receipt,
  Loader2,
  Trash2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Download,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
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
import { useFinanceiroPreFiscal } from "@/hooks/useFinanceiroPreFiscal";
import { useFinanceiroPreFiscalUnificado } from "@/hooks/useFinanceiroPreFiscalUnificado";
import { FEATURE_FLAGS_V2 } from "@/config/featureFlagsV2";
import { Shield } from "lucide-react";

import { format, subMonths, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FinanceiroPreFiscalModal } from "@/components/forms/FinanceiroPreFiscalModal";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { ComprasMaterialCard } from "@/components/financeiro/ComprasMaterialCard";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";

const ITEMS_PER_PAGE = 20;

export function MobileFinanceiroPreFiscal() {
  const [activeTab, setActiveTab] = useState("all");
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [financeiroModalOpen, setFinanceiroModalOpen] = useState(false);
  const [tipoModal, setTipoModal] = useState<"entrada" | "saida">("entrada");
  const [contadorOpen, setContadorOpen] = useState(false);
  const [contadorMonth, setContadorMonth] = useState(new Date());
  const [valoresOcultos, setValoresOcultos] = useState(() => sessionStorage.getItem("fin_hidden") === "true");

  const dataInicioContador = format(startOfMonth(contadorMonth), "yyyy-MM-dd");
  const dataFimContador = format(endOfMonth(contadorMonth), "yyyy-MM-dd");

  const { data: preFiscalContador, isLoading: isLoadingPreFiscal } = useFinanceiroPreFiscalUnificado(dataInicioContador, dataFimContador);

  const dataInicioAtual = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const dataFimAtual = format(endOfMonth(new Date()), "yyyy-MM-dd");
  const { data: metricsAtuais } = useFinanceiroPreFiscalUnificado(dataInicioAtual, dataFimAtual);

  const totalEntradas = metricsAtuais?.competencia.faturamentoBruto || 0;
  const totalSaidas = metricsAtuais?.caixa.saidasPagas || 0;
  const lucroTotal = metricsAtuais?.resultado.lucroOperacional || 0;

  const maskValue = (value: number) => valoresOcultos ? "••••••" : formatCurrency(value);
  
  const { 
    registros, 
    isLoading, 
    deleteRegistro 
  } = useFinanceiroPreFiscal();




  const handleExportContador = useCallback(() => {
    if (!preFiscalContador || preFiscalContador.analitico.length === 0) {
      toast.error("Nenhum registro neste mês");
      return;
    }
    const mesLabel = format(contadorMonth, "MMMM_yyyy", { locale: ptBR });
    const fmtVal = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const esc = (s: string | null | undefined) => s ? `"${s.replace(/"/g, '""')}"` : "";
    
    let csv = "\uFEFF"; // BOM
    csv += "Data Competência,Data Pagamento,Tipo,Categoria,Descrição,Valor Bruto,Desconto,Valor Líquido,Status,Documento,Ressalva Histórica\n";
    
    preFiscalContador.analitico.forEach(r => {
      csv += [
        format(parseISO(r.data_competencia), "dd/MM/yyyy"),
        r.data_pagamento ? format(parseISO(r.data_pagamento), "dd/MM/yyyy") : "",
        r.tipo === "entrada" ? "Receita" : "Despesa",
        esc(r.categoria),
        esc(r.descricao),
        fmtVal(Number(r.valor_bruto)),
        fmtVal(Number(r.desconto)),
        fmtVal(Number(r.valor_liquido)),
        esc(r.status),
        esc(r.numero_documento),
        preFiscalContador.alertas.historicoComRessalva ? "Sim" : "Não"
      ].join(",") + "\n";
    });

    csv += `\n,,RESUMO CAIXA (PAGOS)\n`;
    csv += `,,Entradas Pagas,,${fmtVal(preFiscalContador.caixa.entradasPagas)}\n`;
    csv += `,,Saídas Pagas,,${fmtVal(preFiscalContador.caixa.saidasPagas)}\n`;
    csv += `,,Saldo Caixa,,${fmtVal(preFiscalContador.caixa.lucroCaixa)}\n\n`;

    csv += `,,RESUMO COMPETÊNCIA (FINALIZADOS)\n`;
    csv += `,,Faturamento Bruto,,${fmtVal(preFiscalContador.competencia.faturamentoBruto)}\n`;
    csv += `,,Descontos,,${fmtVal(preFiscalContador.competencia.descontos)}\n`;
    csv += `,,Faturamento Líquido,,${fmtVal(preFiscalContador.competencia.faturamentoLiquido)}\n`;
    csv += `,,CMV Total,,${fmtVal(preFiscalContador.custos.cmvTotal)}\n`;
    csv += `,,Lucro Operacional,,${fmtVal(preFiscalContador.resultado.lucroOperacional)}\n`;
    csv += `,,Saldo a Receber,,${fmtVal(preFiscalContador.competencia.saldoAReceber)}\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_contador_${mesLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Relatório baixado!", { description: `relatorio_contador_${mesLabel}.csv` });
  }, [preFiscalContador, contadorMonth]);


  // Chart data - últimos 4 meses
  const chartData = useMemo(() => {
    const months = [];
    for (let i = 3; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const inicio = startOfMonth(monthDate);
      const fim = endOfMonth(monthDate);
      const receita = registros
        .filter(r => { const d = new Date(r.data); return d >= inicio && d <= fim && r.tipo === "entrada"; })
        .reduce((s, r) => s + Number(r.valor), 0);
      const despesa = registros
        .filter(r => { const d = new Date(r.data); return d >= inicio && d <= fim && r.tipo === "saida"; })
        .reduce((s, r) => s + Number(r.valor), 0);
      months.push({ month: format(monthDate, "MMM", { locale: ptBR }), receita, despesa });
    }
    return months;
  }, [registros]);

  // Variação mês anterior
  const variacao = useMemo(() => {
    const mesAtualInicio = startOfMonth(new Date());
    const mesAtualFim = endOfMonth(new Date());
    const mesAnteriorInicio = startOfMonth(subMonths(new Date(), 1));
    const mesAnteriorFim = endOfMonth(subMonths(new Date(), 1));
    const atual = registros.filter(r => { const d = new Date(r.data); return d >= mesAtualInicio && d <= mesAtualFim && r.tipo === "entrada"; }).reduce((s, r) => s + Number(r.valor), 0);
    const anterior = registros.filter(r => { const d = new Date(r.data); return d >= mesAnteriorInicio && d <= mesAnteriorFim && r.tipo === "entrada"; }).reduce((s, r) => s + Number(r.valor), 0);
    if (anterior === 0) return null;
    return ((atual - anterior) / anterior) * 100;
  }, [registros]);

  const transactions = useMemo(() => {
    return registros.map((r) => ({
      id: r.id,
      type: r.tipo as "entrada" | "saida",
      category: r.categoria_obj?.nome || r.origem,
      description: r.descricao || r.categoria_obj?.nome || r.origem,
      value: Number(r.valor),
      date: format(new Date(r.data), "dd/MM"),
      status: r.status,
    }));
  }, [registros]);

  const allFilteredTransactions = transactions.filter((t) => {
    if (activeTab === "all") return true;
    if (activeTab === "income") return t.type === "entrada";
    if (activeTab === "expense") return t.type === "saida";
    return true;
  });

  const filteredTransactions = allFilteredTransactions.slice(0, visibleCount);
  const hasMoreItems = allFilteredTransactions.length > visibleCount;
  
  const loadMore = () => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
  };

  const fmt = (v: number) => valoresOcultos ? "••••••" : formatCurrency(v);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      {/* ── MINI DASHBOARD ── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {/* Header com faturamento destacado */}
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground capitalize">
                {format(new Date(), "MMMM yyyy", { locale: ptBR })}
              </p>
              <button
                onClick={() => {
                  const next = !valoresOcultos;
                  setValoresOcultos(next);
                  sessionStorage.setItem("fin_hidden", String(next));
                }}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground"
              >
                {valoresOcultos ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {variacao !== null && (
              <div className={cn(
                "flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                variacao >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              )}>
                {variacao >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(variacao).toFixed(0)}% vs mês anterior
              </div>
            )}
          </div>
          <p className="text-2xl font-extrabold text-foreground">{fmt(totalEntradas)}</p>
          <p className="text-[11px] text-muted-foreground">Faturamento do mês</p>
        </div>

        {/* Mini gráfico */}
        <div className="h-20 px-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorReceitaMini" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Area
                type="monotone"
                dataKey="receita"
                stroke="hsl(var(--success))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorReceitaMini)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* KPIs em linha */}
        <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
          <div className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <TrendingUp className="w-3 h-3 text-success" />
              <p className="text-[10px] text-muted-foreground uppercase">Receita</p>
            </div>
            <p className="text-sm font-bold text-success">{fmt(totalEntradas)}</p>
          </div>
          <div className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <TrendingDown className="w-3 h-3 text-destructive" />
              <p className="text-[10px] text-muted-foreground uppercase">Despesa</p>
            </div>
            <p className="text-sm font-bold text-destructive">{fmt(totalSaidas)}</p>
          </div>
          <div className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Lucro</p>
            <p className={cn(
              "text-sm font-bold",
              lucroTotal >= 0 ? "text-success" : "text-destructive"
            )}>
              {lucroTotal >= 0 ? "+" : ""}{fmt(lucroTotal)}
            </p>
          </div>
        </div>
      </div>

      {/* Compras de Material no mês (insight do Moisés) */}
      <ComprasMaterialCard dateFilter={null} valoresOcultos={valoresOcultos} variant="mobile" />

      {FEATURE_FLAGS_V2.FINANCEIRO_V2_IGNORE_TEST_MANIFEST_ENABLED && metricsAtuais && (metricsAtuais as any).modo === "preview_limpeza_logica" && (
        <div className="bg-info/10 border border-info/30 rounded-xl p-3 flex items-start gap-3">
          <Shield className="w-5 h-5 text-info shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[10px] text-info uppercase font-bold tracking-wide">Modo V2 Limpo Ativo</p>
            <p className="text-[11px] text-info/90 leading-tight">
              Registros de teste ignorados por manifesto ({ (metricsAtuais as any).auditoria?.registros_ignorados_por_manifesto?.length || 0} itens). 
              Nenhum dado real foi alterado fisicamente.
            </p>
          </div>
        </div>
      )}



      {/* Botão principal único — Nova Movimentação */}
      <Button 
        className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base"
        onClick={() => setFinanceiroModalOpen(true)}
      >
        <Plus className="w-5 h-5 mr-2" />
      Nova Movimentação
      </Button>

      {/* Relatório pro Contador */}
      <button
        onClick={() => setContadorOpen(!contadorOpen)}
        className="w-full bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl border border-primary/20 p-3 text-left active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary/15 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground">Relatório pro Contador</h3>
            <p className="text-[11px] text-muted-foreground">Escolha o mês, confira o resumo e baixe o CSV</p>
          </div>
          <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", contadorOpen && "rotate-90")} />
        </div>
      </button>

      {contadorOpen && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Seletor de mês */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setContadorMonth(prev => subMonths(prev, 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-semibold text-sm text-foreground capitalize">
              {format(contadorMonth, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setContadorMonth(prev => {
                const next = subMonths(prev, -1);
                return next > new Date() ? prev : next;
              })}
              disabled={format(contadorMonth, "yyyy-MM") === format(new Date(), "yyyy-MM")}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Resumo do mês */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted/30 rounded-lg p-2">
              <p className="text-[10px] text-muted-foreground uppercase mb-1 font-semibold">Competência</p>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span>Faturamento:</span>
                  <span className="font-bold">{fmt(preFiscalContador?.competencia.faturamentoBruto || 0)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Lucro Oper.:</span>
                  <span className="font-bold text-success">{fmt(preFiscalContador?.resultado.lucroOperacional || 0)}</span>
                </div>
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg p-2">
              <p className="text-[10px] text-muted-foreground uppercase mb-1 font-semibold">Caixa</p>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span>Entradas:</span>
                  <span className="font-bold text-success">{fmt(preFiscalContador?.caixa.entradasPagas || 0)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Saídas:</span>
                  <span className="font-bold text-destructive">-{fmt(preFiscalContador?.caixa.saidasPagas || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Info registros */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>{preFiscalContador?.analitico.length || 0} lançamentos</span>
            <span className="text-amber-600 font-medium">Saldo a Receber: {fmt(preFiscalContador?.competencia.saldoAReceber || 0)}</span>
          </div>


          {/* Botão de download */}
          <Button
            className="w-full"
            variant="outline"
            onClick={handleExportContador}
            disabled={!preFiscalContador || preFiscalContador.analitico.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Baixar CSV — {format(contadorMonth, "MMM/yy", { locale: ptBR })}
          </Button>
        </div>
      )}

      <FinanceiroPreFiscalModal
        open={financeiroModalOpen}
        onOpenChange={setFinanceiroModalOpen}
      />

      {/* Lista de movimentações — limpa, tipo WhatsApp */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-3 pt-2">
            <TabsList className="w-full h-9 bg-muted/50 p-0.5">
              <TabsTrigger value="all" className="flex-1 h-8 text-sm">Todas</TabsTrigger>
              <TabsTrigger value="income" className="flex-1 h-8 text-sm">Entradas</TabsTrigger>
              <TabsTrigger value="expense" className="flex-1 h-8 text-sm">Saídas</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={activeTab} className="mt-0">
            <div className="divide-y divide-border">
              {filteredTransactions.length === 0 ? (
                <div className="p-8 text-center">
                  <Receipt className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma movimentação</p>
                </div>
              ) : (
                filteredTransactions.map((t) => (
                  <div key={t.id} className="px-3 py-3 flex items-center gap-3">
                    {/* Ícone pequeno */}
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      t.type === "entrada" ? "bg-success/10" : "bg-destructive/10"
                    )}>
                      {t.category.includes("Serviço") ? (
                        <Wrench className={cn("w-4 h-4", t.type === "entrada" ? "text-success" : "text-destructive")} />
                      ) : t.category.includes("peça") || t.category.includes("Estoque") ? (
                        <Package className={cn("w-4 h-4", t.type === "entrada" ? "text-success" : "text-destructive")} />
                      ) : (
                        <Receipt className={cn("w-4 h-4", t.type === "entrada" ? "text-success" : "text-destructive")} />
                      )}
                    </div>
                    {/* Texto: Nome maior, meta discreto */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {t.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.date} • {t.category}
                      </p>
                    </div>
                    {/* Valor alinhado à direita */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <p className={cn(
                        "text-sm font-bold tabular-nums",
                        t.type === "entrada" ? "text-success" : "text-destructive"
                      )}>
                        {t.type === "entrada" ? "+" : "-"}{fmt(t.value)}
                      </p>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-[90vw] rounded-xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteRegistro(t.id)}
                              className="w-full sm:w-auto bg-destructive hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))
              )}
              {hasMoreItems && (
                <div className="p-3 text-center">
                  <Button variant="outline" onClick={loadMore} className="w-full" size="sm">
                    Carregar mais ({allFilteredTransactions.length - visibleCount} restantes)
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
