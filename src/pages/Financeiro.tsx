import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { MobileFinanceiroPreFiscal } from "@/components/financeiro/MobileFinanceiroPreFiscal";
import { VendaBalcaoDetalheModal } from "@/components/vendas/VendaBalcaoDetalheModal";
import { FinanceiroFilter } from "@/components/financeiro/FinanceiroFilter";
import { FinanceiroPreFiscalExport } from "@/components/financeiro/FinanceiroPreFiscalExport";
import { FinanceiroAlerts } from "@/components/financeiro/FinanceiroAlerts";
import { ClassificacaoFilter } from "@/components/financeiro/ClassificacaoFilter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Wrench,
  Package,
  Receipt,
  Loader2,
  Plus,
  Trash2,
  Clock,
  Building2,
  User,
  FileText,
  Eye,
  EyeOff,
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
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFinanceiroPreFiscal } from "@/hooks/useFinanceiroPreFiscal";
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FinanceiroPreFiscalModal } from "@/components/forms/FinanceiroPreFiscalModal";
import { RelatorioContadorModal } from "@/components/financeiro/RelatorioContadorModal";
import { Badge } from "@/components/ui/badge";
import { ComprasMaterialCard } from "@/components/financeiro/ComprasMaterialCard";

export default function Financeiro() {
  const [activeTab, setActiveTab] = useState("all");
  const [financeiroModalOpen, setFinanceiroModalOpen] = useState(false);
  const [tipoModal, setTipoModal] = useState<"entrada" | "saida" | undefined>(undefined);
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string } | null>(null);
  const [classificacaoFilter, setClassificacaoFilter] = useState<"todos" | "empresa" | "pessoal">("todos");
  const [origemFilter, setOrigemFilter] = useState("todos");
  const [relatorioModalOpen, setRelatorioModalOpen] = useState(false);
  const [valoresOcultos, setValoresOcultos] = useState(() => sessionStorage.getItem("fin_hidden") === "true");
  const [prefiscalDismissed, setPrefiscalDismissed] = useState(() => sessionStorage.getItem("prefiscal_dismissed") === "1");
  const [prejuizosBannerDismissed, setPrejuizosBannerDismissed] = useState(() => sessionStorage.getItem("prejuizos_banner_dismissed") === "1");
  const [vendaDetalheId, setVendaDetalheId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const maskValue = (value: number) => valoresOcultos ? "••••••" : `R$ ${value.toLocaleString("pt-BR")}`;
  
  const { 
    registros, 
    allRegistros,
    totalEntradas, 
    totalSaidas, 
    lucroTotal, 
    totalAReceber,
    totalAPagar,
    totaisEmpresa,
    totaisPessoal,
    percentualMudanca, 
    porCategoria,
    totalPrejuizos,
    lucroLiquidoReal,
    registrosPrejuizo,
    isLoading, 
    deleteRegistro 
  } = useFinanceiroPreFiscal(dateFilter);

  const handleOpenModal = (tipo?: "entrada" | "saida") => {
    setTipoModal(tipo);
    setFinanceiroModalOpen(true);
  };

  // Filter by classificacao
  const filteredByClassificacao = useMemo(() => {
    let filtered = registros;
    if (classificacaoFilter !== "todos") {
      filtered = filtered.filter(r => r.classificacao === classificacaoFilter);
    }
    if (origemFilter === "os") {
      filtered = filtered.filter(r => r.ordem_servico_id != null);
    } else if (origemFilter === "manual") {
      filtered = filtered.filter(r => r.ordem_servico_id == null);
    }
    return filtered;
  }, [registros, classificacaoFilter, origemFilter]);

  // Transform data for display
  const transactions = useMemo(() => {
    return filteredByClassificacao.map((r) => ({
      id: r.id,
      type: r.tipo as "entrada" | "saida",
      category: r.categoria_obj?.nome || r.origem,
      categoryColor: r.categoria_obj?.cor || "#6B7280",
      description: r.descricao || r.categoria_obj?.nome || r.origem,
      value: Number(r.valor),
      date: format(new Date(r.data), "dd/MM/yyyy"),
      hora: r.created_at ? format(new Date(r.created_at), "HH:mm") : null,
      status: r.status,
      classificacao: r.classificacao,
      reference: r.ordem_servico_id ? `OS-${r.ordem_servico_id.slice(0, 8)}` : undefined,
      formaPagamento: r.forma_pagamento?.nome,
      categoria: (r as any).categoria,
      origem: r.origem,
    }));
  }, [filteredByClassificacao]);


  // Generate chart data
  const chartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const inicio = startOfMonth(monthDate);
      const fim = endOfMonth(monthDate);
      
      const monthRegistros = allRegistros.filter((r) => {
        const data = new Date(r.data);
        return data >= inicio && data <= fim && (classificacaoFilter === "todos" || r.classificacao === classificacaoFilter);
      });
      
      const receita = monthRegistros
        .filter((r) => r.tipo === "entrada")
        .reduce((sum, r) => sum + Number(r.valor), 0);
      
      const despesa = monthRegistros
        .filter((r) => r.tipo === "saida")
        .reduce((sum, r) => sum + Number(r.valor), 0);
      
      months.push({
        month: format(monthDate, "MMM", { locale: ptBR }),
        receita,
        despesa,
      });
    }
    return months;
  }, [allRegistros, classificacaoFilter]);

  // Generate pie data - Priorizar categorias críticas de gasto
  const pieData = useMemo(() => {
    // Cores com destaque para categorias críticas (vermelho/laranja para gastos pesados)
    const criticalCategories = ["Salários", "Aluguel", "Impostos", "Manutenção", "Fornecedores"];
    const categoryColors: Record<string, string> = {
      "Salários": "hsl(0, 84%, 55%)",      // Vermelho - maior gasto
      "Aluguel": "hsl(24, 95%, 53%)",       // Laranja - custo fixo pesado
      "Impostos": "hsl(350, 80%, 50%)",    // Vermelho-rosado
      "Fornecedores": "hsl(35, 90%, 50%)", // Âmbar
      "Manutenção": "hsl(280, 50%, 55%)",  // Roxo
    };
    const defaultColors = [
      "hsl(220, 70%, 50%)",
      "hsl(190, 60%, 45%)",
      "hsl(160, 55%, 45%)",
      "hsl(140, 50%, 45%)",
      "hsl(100, 45%, 45%)",
    ];
    
    const entries = Object.entries(porCategoria)
      .map(([name, values]) => ({
        name,
        value: values.entrada + values.saida,
        isCritical: criticalCategories.some(cat => name.toLowerCase().includes(cat.toLowerCase())),
      }))
      .sort((a, b) => b.value - a.value) // Ordenar por valor (maior primeiro)
      .slice(0, 6);
    
    let defaultIndex = 0;
    return entries.map((entry) => ({
      name: entry.name,
      value: entry.value,
      isCritical: entry.isCritical,
      color: categoryColors[entry.name] || defaultColors[defaultIndex++ % defaultColors.length],
    }));
  }, [porCategoria]);

  const filteredTransactions = transactions.filter((t) => {
    if (activeTab === "all") return true;
    if (activeTab === "income") return t.type === "entrada";
    if (activeTab === "expense") return t.type === "saida";
    if (activeTab === "pending") return t.status === "a_receber" || t.status === "a_pagar";
    if (activeTab === "prejuizo") {
      const original = registros.find((r) => r.id === t.id);
      return original?.categoria === "prejuizo";
    }
    return true;
  });

  // Mobile view
  if (isMobile) {
    return (
      <MainLayout>
        <MobileFinanceiroPreFiscal />
      </MainLayout>
    );
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        {/* Header Otimizado - 2 linhas claras */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 dark:from-slate-900 dark:via-slate-800/80 dark:to-slate-900 p-5 border border-slate-700/50 shadow-2xl"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
          
          <div className="relative space-y-4">
            {/* Linha 1: Título + Ações principais */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div 
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                  className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-lg border border-slate-600/50"
                >
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </motion.div>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    Controle Financeiro
                  </h1>
                  <p className="text-slate-400 text-xs">
                    Visão completa do caixa
                  </p>
                </div>
              </div>
              
              {/* Ações principais lado a lado */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const next = !valoresOcultos;
                    setValoresOcultos(next);
                    sessionStorage.setItem("fin_hidden", String(next));
                  }}
                  className="text-slate-300 hover:text-white hover:bg-slate-700/50 h-9 w-9"
                  title={valoresOcultos ? "Mostrar valores" : "Ocultar valores"}
                >
                  {valoresOcultos ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button 
                    onClick={() => handleOpenModal("entrada")} 
                    size="sm"
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25 font-semibold h-9"
                  >
                    <ArrowUpRight className="w-4 h-4 mr-1.5" />
                    Entrada
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenModal("saida")} 
                    className="border-red-400 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold h-9"
                  >
                    <ArrowDownRight className="w-4 h-4 mr-1.5" />
                    Despesa
                  </Button>
                </motion.div>
              </div>
            </div>
            
            {/* Linha 2: Filtros e opções secundárias */}
            <div className="flex items-center justify-between border-t border-slate-700/50 pt-3">
              <ClassificacaoFilter value={classificacaoFilter} onChange={setClassificacaoFilter} />
              
              <div className="flex items-center gap-2">
                <FinanceiroFilter dateRange={dateFilter} onFilterChange={setDateFilter} origemFilter={origemFilter} onOrigemFilterChange={setOrigemFilter}>
                  <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700/50 h-8 text-xs">
                    <Calendar className="w-3.5 h-3.5 mr-1.5" />
                    {dateFilter 
                      ? `${format(parseISO(dateFilter.start), "dd/MM")} - ${format(parseISO(dateFilter.end), "dd/MM")}`
                      : format(new Date(), "MMM yyyy", { locale: ptBR })
                    }
                  </Button>
                </FinanceiroFilter>
                <FinanceiroPreFiscalExport registros={filteredByClassificacao} dateRange={dateFilter} />
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setRelatorioModalOpen(true)}
                  className="text-slate-300 hover:text-white hover:bg-slate-700/50 h-8 text-xs"
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  Contador
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Resumo Pré-Fiscal do Mês */}
        {totaisEmpresa.entradas > 0 && !prefiscalDismissed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 truncate">
                  Este mês você possui {valoresOcultos ? "••••••" : `R$ ${totaisEmpresa.entradas.toLocaleString("pt-BR")}`} organizados em dados pré-fiscais
                </p>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                  Dados prontos para emissão de nota fiscal ou envio ao contador
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRelatorioModalOpen(true)}
                className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
              >
                Ver dados pré-fiscais
              </Button>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => { sessionStorage.setItem("prefiscal_dismissed", "1"); setPrefiscalDismissed(true); }}
                className="rounded-md p-1.5 text-emerald-700/70 hover:bg-emerald-500/10 dark:text-emerald-400/70"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* Bloco de Prejuízos do mês (Funcionalidade 2) */}
        {totalPrejuizos > 0 && !prejuizosBannerDismissed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center text-xl shrink-0">⚠️</div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-destructive truncate">
                  Prejuízos / Retrabalho no período: {valoresOcultos ? "••••••" : `R$ ${totalPrejuizos.toLocaleString("pt-BR")}`}
                </p>
                <p className="text-xs text-destructive/80">
                  Lucro líquido real (descontando prejuízos): {valoresOcultos ? "••••••" : `R$ ${lucroLiquidoReal.toLocaleString("pt-BR")}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setActiveTab("prejuizo")} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                Ver detalhes
              </Button>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => { sessionStorage.setItem("prejuizos_banner_dismissed", "1"); setPrejuizosBannerDismissed(true); }}
                className="rounded-md p-1.5 text-destructive/70 hover:bg-destructive/10"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* Alerts */}
        <FinanceiroAlerts
          lucroTotal={lucroTotal}
          totalSaidas={totalSaidas}
          totalEntradas={totalEntradas}
          totalAPagar={totalAPagar}
          totalAReceber={totalAReceber}
          percentualMudanca={percentualMudanca}
        />

        {/* Premium Stats */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* Receita */}
          <motion.div 
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="group bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/50 dark:to-emerald-900/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 p-5 relative overflow-hidden shadow-lg shadow-emerald-500/10"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1">Receita</p>
                <p className="text-2xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                  {maskValue(totalEntradas)}
                </p>
                {totalAReceber > 0 && !valoresOcultos && (
                  <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    R$ {totalAReceber.toLocaleString("pt-BR")} a receber
                  </p>
                )}
              </div>
              <motion.div 
                whileHover={{ rotate: 12 }}
                className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30"
              >
                <ArrowUpRight className="w-6 h-6 text-white" />
              </motion.div>
            </div>
          </motion.div>

          {/* Despesas */}
          <motion.div 
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="group bg-gradient-to-br from-red-50 to-rose-100/50 dark:from-red-950/50 dark:to-rose-900/30 rounded-2xl border border-red-200 dark:border-red-800/50 p-5 relative overflow-hidden shadow-lg shadow-red-500/10"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-red-500/20 to-rose-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Despesas</p>
                <p className="text-2xl font-extrabold bg-gradient-to-r from-red-600 to-rose-500 dark:from-red-400 dark:to-rose-400 bg-clip-text text-transparent">
                  {maskValue(totalSaidas)}
                </p>
                {totalAPagar > 0 && !valoresOcultos && (
                  <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    R$ {totalAPagar.toLocaleString("pt-BR")} a pagar
                  </p>
                )}
              </div>
              <motion.div 
                whileHover={{ rotate: -12 }}
                className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-lg shadow-red-500/30"
              >
                <ArrowDownRight className="w-6 h-6 text-white" />
              </motion.div>
            </div>
          </motion.div>

          {/* Lucro */}
          <motion.div 
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ type: "spring", stiffness: 300 }}
            className={cn(
              "rounded-2xl p-5 relative overflow-hidden transition-all duration-300",
              lucroTotal >= 0 
                ? "bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 text-white shadow-2xl shadow-emerald-500/40" 
                : "bg-gradient-to-br from-red-500 via-rose-500 to-pink-600 text-white shadow-2xl shadow-red-500/40"
            )}
          >
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.15, 0.1] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" 
            />
            
            <div className="relative flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold opacity-90">Lucro Líquido</p>
                  {lucroTotal >= 0 && (
                    <span className="px-2 py-0.5 bg-white/25 backdrop-blur-sm rounded-full text-xs font-bold">
                      💰
                    </span>
                  )}
                </div>
                <motion.p 
                  key={lucroTotal}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-3xl font-black tracking-tight"
                >
                  {valoresOcultos ? "••••••" : `R$ ${Math.abs(lucroTotal).toLocaleString("pt-BR")}`}
                </motion.p>
              </div>
              <motion.div 
                whileHover={{ rotate: 12 }}
                className="w-12 h-12 rounded-xl bg-white/25 backdrop-blur-sm flex items-center justify-center"
              >
                {lucroTotal >= 0 ? (
                  <TrendingUp className="w-6 h-6" />
                ) : (
                  <TrendingDown className="w-6 h-6" />
                )}
              </motion.div>
            </div>
          </motion.div>

          {/* Separação Empresa/Pessoal */}
          <motion.div 
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="bg-gradient-to-br from-card to-muted/30 rounded-2xl border border-border p-5 relative overflow-hidden shadow-lg"
          >
            <p className="text-sm font-medium text-muted-foreground mb-3">Separação</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <Building2 className="w-4 h-4 text-primary" />
                  Empresa
                </span>
                <span className="font-bold text-foreground">
                  R$ {(totaisEmpresa.entradas - totaisEmpresa.saidas).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  Pessoal
                </span>
                <span className="font-bold text-muted-foreground">
                  R$ {(totaisPessoal.entradas - totaisPessoal.saidas).toLocaleString("pt-BR")}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Compras de Material no período (insight do Moisés) */}
        <ComprasMaterialCard dateFilter={dateFilter} valoresOcultos={valoresOcultos} variant="desktop" />


        {/* Charts */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid lg:grid-cols-3 gap-6"
        >
          {/* Revenue Chart - Clareza visual imediata */}
          <div className="lg:col-span-2 bg-gradient-to-br from-card via-card to-muted/30 rounded-2xl border border-border p-6 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-red-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <div className="relative flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center shadow-lg">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Receita vs Despesa</h2>
              </div>
              {/* Legenda clara */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Receita</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">Despesa</span>
                </div>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(152, 76%, 40%)" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="hsl(152, 76%, 40%)" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0, 75%, 55%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(0, 75%, 55%)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontWeight: 500 }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} tickFormatter={(value) => `R$${value / 1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
                    labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                    formatter={(value: number, name: string) => [
                      `R$ ${value.toLocaleString("pt-BR")}`,
                      name === "receita" ? "💰 Receita" : "📉 Despesa"
                    ]}
                  />
                  <Area type="monotone" dataKey="receita" stroke="hsl(152, 76%, 40%)" strokeWidth={3} fillOpacity={1} fill="url(#colorReceita)" name="receita" />
                  <Area type="monotone" dataKey="despesa" stroke="hsl(0, 75%, 55%)" strokeWidth={3} fillOpacity={1} fill="url(#colorDespesa)" name="despesa" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart - Onde seu dinheiro está indo */}
          <div className="bg-gradient-to-br from-card via-card to-red-500/5 rounded-2xl border border-border p-6 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-red-500/10 to-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />
            <div className="relative flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-lg border border-slate-600/30">
                  <Receipt className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Onde Vai o Dinheiro?</h2>
                  <p className="text-xs text-muted-foreground">Gastos por categoria</p>
                </div>
              </div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Lista de categorias com destaque para gastos críticos */}
            <div className="space-y-1.5 mt-4">
              {pieData.map((item, index) => (
                <motion.div 
                  key={item.name} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-lg transition-colors",
                    item.isCritical 
                      ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50" 
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                    <span className={cn(
                      "text-sm font-medium",
                      item.isCritical ? "text-red-700 dark:text-red-400" : "text-muted-foreground"
                    )}>
                      {item.name}
                    </span>
                    {item.isCritical && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 rounded font-bold">
                        CUSTO FIXO
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    "text-sm font-bold tabular-nums",
                    item.isCritical ? "text-red-600 dark:text-red-400" : "text-foreground"
                  )}>
                    {valoresOcultos ? "••••••" : `R$ ${item.value.toLocaleString("pt-BR")}`}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Transactions */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-card via-card to-muted/30 rounded-2xl border border-border overflow-hidden shadow-lg"
        >
          <div className="p-6 border-b border-border bg-gradient-to-r from-primary/5 via-transparent to-accent/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Movimentações</h2>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="px-6 pt-4">
              <TabsList className="bg-muted/50 p-1 rounded-xl">
                <TabsTrigger value="all" className="data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-lg">
                  Todas
                </TabsTrigger>
                <TabsTrigger value="income" className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-900/50 dark:data-[state=active]:text-emerald-300 rounded-lg">
                  Entradas
                </TabsTrigger>
                <TabsTrigger value="expense" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-700 dark:data-[state=active]:bg-red-900/50 dark:data-[state=active]:text-red-300 rounded-lg">
                  Saídas
                </TabsTrigger>
                <TabsTrigger value="pending" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700 dark:data-[state=active]:bg-amber-900/50 dark:data-[state=active]:text-amber-300 rounded-lg">
                  Pendentes
                </TabsTrigger>
                <TabsTrigger value="prejuizo" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-700 dark:data-[state=active]:bg-red-900/50 dark:data-[state=active]:text-red-300 rounded-lg">
                  ⚠️ Prejuízos {totalPrejuizos > 0 && `(${registrosPrejuizo.length})`}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value={activeTab} className="mt-0">
              <div className="divide-y divide-border">
                {filteredTransactions.length === 0 ? (
                  <div className="p-12 text-center">
                    <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhuma movimentação encontrada</p>
                  </div>
                ) : (
                  filteredTransactions.slice(0, 20).map((transaction, index) => {
                    const isVendaBalcao = transaction.categoria === "venda_balcao" || transaction.origem === "Venda Balcão";
                    return (
                    <div
                      key={transaction.id}
                      className={cn(
                        "p-4 md:p-6 hover:bg-muted/30 transition-colors animate-slide-up",
                        isVendaBalcao && "cursor-pointer",
                      )}
                      style={{ animationDelay: `${index * 30}ms` }}
                      onClick={() => isVendaBalcao && setVendaDetalheId(transaction.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            transaction.type === "entrada" ? "bg-success/10" : "bg-destructive/10"
                          )}
                        >
                          {isVendaBalcao ? (
                            <Package className={cn("w-5 h-5", "text-success")} />
                          ) : transaction.category.includes("Serviço") ? (
                            <Wrench className={cn("w-5 h-5", transaction.type === "entrada" ? "text-success" : "text-destructive")} />
                          ) : transaction.category.includes("peça") || transaction.category.includes("Estoque") ? (
                            <Package className={cn("w-5 h-5", transaction.type === "entrada" ? "text-success" : "text-destructive")} />
                          ) : (
                            <Receipt className={cn("w-5 h-5", transaction.type === "entrada" ? "text-success" : "text-destructive")} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground truncate">{transaction.description}</p>
                            {isVendaBalcao && (
                              <Badge variant="secondary" className="text-[10px] uppercase">Venda Balcão</Badge>
                            )}
                            {transaction.classificacao === "pessoal" && (
                              <Badge variant="outline" className="text-xs">Pessoal</Badge>
                            )}
                            {transaction.status !== "pago" && (
                              <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                                {transaction.status === "a_receber" ? "A receber" : "A pagar"}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: transaction.categoryColor }} />
                              {transaction.category}
                            </span>
                            {transaction.formaPagamento && (
                              <>
                                <span>•</span>
                                <span>{transaction.formaPagamento}</span>
                              </>
                            )}
                            {transaction.reference && (
                              <>
                                <span>•</span>
                                <span className="font-mono">{transaction.reference}</span>
                              </>
                            )}
                            {isVendaBalcao && (
                              <>
                                <span>•</span>
                                <button
                                  className="text-accent underline font-medium"
                                  onClick={(e) => { e.stopPropagation(); setVendaDetalheId(transaction.id); }}
                                >
                                  Ver itens
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <div>
                            <p className={cn("text-lg font-bold", transaction.type === "entrada" ? "text-success" : "text-destructive")}>
                              {valoresOcultos ? "••••••" : `${transaction.type === "entrada" ? "+" : "-"}R$ ${transaction.value.toLocaleString("pt-BR")}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {transaction.date}{transaction.hora ? ` • ${transaction.hora}` : ""}
                            </p>
                          </div>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. O lançamento "{transaction.description}" de R$ {transaction.value.toLocaleString("pt-BR")} será removido.
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
                      </div>
                    </div>
                  );})

                )}
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>

      <FinanceiroPreFiscalModal
        open={financeiroModalOpen}
        onOpenChange={setFinanceiroModalOpen}
        tipo={tipoModal}
      />

      <RelatorioContadorModal
        open={relatorioModalOpen}
        onOpenChange={setRelatorioModalOpen}
      />

      <VendaBalcaoDetalheModal
        open={!!vendaDetalheId}
        onOpenChange={(o) => { if (!o) setVendaDetalheId(null); }}
        financeiroId={vendaDetalheId}
      />

    </MainLayout>
  );
}
