import { useState, useMemo, useCallback, useEffect, useRef, useDeferredValue, startTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useModalUrl } from "@/hooks/useModalUrl";
// upsertFinanceiroOS no longer needed here — Kanban uses finalizar_os_atomica RPC
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Plus, Clock, CheckCircle2, AlertCircle, PlayCircle, Car, Bike, Wrench, LayoutGrid, List, MessageCircle, Link2, Package, MoreVertical, User, ChevronRight, Zap, Eye, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrdensServico, OrdemServico, StatusOS } from "@/hooks/useOrdensServico";
import { useOSSearch } from "@/hooks/useOSSearch";
import { useSearchParams } from "react-router-dom";
import { OrdemServicoFormModal } from "@/components/forms/OrdemServicoFormModal";
import { DraftResumeBanner } from "@/components/DraftResumeBanner";
import { KanbanView } from "@/components/servicos/KanbanView";
import { OSRapidaModal } from "@/components/servicos/OSRapidaModal";
import { OSVisualizacaoModal } from "@/components/servicos/OSVisualizacaoModal";
import { OSFinalizadaModal } from "@/components/servicos/OSFinalizadaModal";
import { KanbanFinalizarModal } from "@/components/servicos/KanbanFinalizarModal";
import { OSStatusTimeline } from "@/components/servicos/OSStatusTimeline";
import { format } from "date-fns";
import { getPublicOSLink } from "@/utils/url";
import { motion } from "framer-motion";
import { PageLoader } from "@/components/ui/loading-states";
import { useOficina } from "@/contexts/OficinaContext";
import { useOficinaLabels } from "@/hooks/useOficinaLabels";
import { openWhatsAppOS } from "@/lib/whatsapp";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getTimeSinceUpdate } from "@/lib/osUtils";

// Labels dinâmicos serão aplicados via hook useOficinaLabels
const getStatusConfig = (isAutoEletrica: boolean): Record<StatusOS, { label: string; icon: typeof Clock; className: string }> => ({
  aberto: {
    label: "Aberto",
    icon: Clock,
    className: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  },
  pendente: {
    label: isAutoEletrica ? "Aguardando Análise" : "Aguardando",
    icon: Clock,
    className: "bg-warning/15 text-warning border-warning/30",
  },
  em_diagnostico: {
    label: "Em Diagnóstico",
    icon: Wrench,
    className: "bg-accent/15 text-accent border-accent/30",
  },
  em_andamento: {
    label: isAutoEletrica ? "Em Execução" : "Em Andamento",
    icon: PlayCircle,
    className: "bg-info/15 text-info border-info/30",
  },
  aguardando_peca: {
    label: isAutoEletrica ? "Aguard. Componente" : "Aguard. Peça",
    icon: Package,
    className: "bg-highlight/15 text-highlight border-highlight/30",
  },
  finalizado: {
    label: "Finalizado",
    icon: CheckCircle2,
    className: "bg-success/15 text-success border-success/30",
  },
  cancelado: {
    label: "Cancelado",
    icon: AlertCircle,
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
});

type TabValue = "all" | StatusOS | "overdue" | "minhas";

export default function Servicos() {
  const { ordens, isLoading, updateOrdem, totalCount, hasNextPage, isFetchingNextPage, fetchNextPage } = useOrdensServico();
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { labels, isAutoEletrica } = useOficinaLabels();
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [activeTab, setActiveTab] = useState<TabValue>(() => {
    // Default to "Abertas" for returning users (most useful view)
    return "em_andamento";
  });
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [ordemEdit, setOrdemEdit] = useState<OrdemServico | null>(null);
  const [osRapidaOpen, setOsRapidaOpen] = useModalUrl("os-rapida");
  const [osVisualizacaoOpen, setOsVisualizacaoOpen] = useState(false);
  const [ordemVisualizacao, setOrdemVisualizacao] = useState<OrdemServico | null>(null);
  const [osFinalizadaOpen, setOsFinalizadaOpen] = useState(false);
  const [ordemFinalizada, setOrdemFinalizada] = useState<OrdemServico | null>(null);
  const [kanbanFinalizarOpen, setKanbanFinalizarOpen] = useState(false);
  const [kanbanFinalizarOrdem, setKanbanFinalizarOrdem] = useState<OrdemServico | null>(null);
  const [kanbanFinalizarValor, setKanbanFinalizarValor] = useState(0);

  const [searchParams, setSearchParams] = useSearchParams();

  // ═══════════════════════════════════════════════════════════════
  // CAUSA RAIZ DO CRASH "removeChild":
  // O Radix Dialog/Drawer usa portais que manipulam o DOM durante a
  // montagem. Quando o componente já está montado com open=false e
  // muda para open=true, o React tenta reconciliar o DOM da árvore
  // principal ao mesmo tempo que o portal monta nós em document.body,
  // causando conflito no commitDeletionEffects (removeChild).
  //
  // FIX: Montar o OrdemServicoFormModal condicionalmente. Quando
  // modalOpen=true, o componente monta fresco com open=true desde o
  // início, eliminando a transição false→true que causa o conflito.
  // ═══════════════════════════════════════════════════════════════
  const handleOpenModal = useCallback((ordem?: OrdemServico | null) => {
    setOrdemEdit(ordem || null);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback((open: boolean) => {
    setModalOpen(open);
    if (!open) {
      setOrdemEdit(null);
      // Limpar param de URL se existir, mas só após o modal desmontar
      setTimeout(() => {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (next.has("os")) {
            next.delete("os");
            return next;
          }
          return prev;
        }, { replace: true });
      }, 300);
    }
  }, [setSearchParams]);

  // Restore modal state from URL on mount / when ordens load
  useEffect(() => {
    const osParam = searchParams.get("os");
    const novaParam = searchParams.get("nova");

    // Wizard sends ?nova=rapida to auto-open OS Rápida
    if (novaParam === "rapida") {
      // Merge both operations: set modal param AND delete nova in one call
      // to avoid race condition where deleting nova overwrites modal param
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("nova");
        next.set("modal", "os-rapida");
        return next;
      }, { replace: true });
      return;
    }

    // Legacy: BottomNav sends ?nova=completa
    if (novaParam === "completa") {
      setOrdemEdit(null);
      setModalOpen(true);
      const params = new URLSearchParams(searchParams);
      params.delete("nova");
      params.set("os", "nova");
      setSearchParams(params, { replace: true });
      return;
    }

    if (!osParam || modalOpen) return;

    if (osParam === "nova") {
      setOrdemEdit(null);
      setModalOpen(true);
    } else {
      // Primeiro tenta encontrar na lista paginada
      const found = ordens.find(o => o.id === osParam);
      if (found) {
        setOrdemEdit(found);
        setModalOpen(true);
      } else if (ordens.length > 0) {
        // CAUSA RAIZ: OS pode não estar na lista paginada.
        // Buscar diretamente no servidor para não perder o deep-link.
        supabase
          .from("ordens_servico")
          .select(`*, cliente:clientes(id, nome, telefone), veiculo:veiculos(id, tipo, marca, modelo, placa)`)
          .eq("id", osParam)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setOrdemEdit(data as OrdemServico);
              setModalOpen(true);
            } else {
              // OS realmente não existe, limpar URL
              const params = new URLSearchParams(searchParams);
              params.delete("os");
              setSearchParams(params, { replace: true });
            }
          });
      }
    }
  }, [searchParams, ordens.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const hoje = format(new Date(), "yyyy-MM-dd");

  // Contagem de OS paradas (sem atualização > 24h e não finalizadas)
  const staleCount = useMemo(() => 
    ordens.filter(o => 
      o.status !== "finalizado" && o.status !== "cancelado" && 
      getTimeSinceUpdate(o.updated_at).isStale
    ).length, 
    [ordens]
  );

  const isOverdue = (ordem: OrdemServico) => 
    ordem.data_servico < hoje && ordem.status !== "finalizado" && ordem.status !== "cancelado";

  // P1 FIX #5: Unified "Abertas" filter — same logic for tab AND count
  const abertasStatuses: StatusOS[] = ["pendente", "em_andamento", "em_diagnostico", "aguardando_peca"];
  const isAberta = (ordem: OrdemServico) => abertasStatuses.includes(ordem.status);

  // CAUSA RAIZ: Busca server-side para encontrar OS além das paginadas
  const { results: searchResults, isSearching: hasActiveSearch } = useOSSearch(deferredSearchTerm);

  // Fonte de dados: server-side quando há busca ativa, paginados quando não
  const sourceOrdens = hasActiveSearch ? searchResults : ordens;

  const filteredOrdens = useMemo(() => sourceOrdens.filter((ordem) => {
    // Quando a busca é server-side, não precisa filtrar por texto novamente
    if (activeTab === "all") return true;
    if (activeTab === "overdue") return isOverdue(ordem);
    if (activeTab === "minhas") return ordem.responsavel_id === user?.id;
    if (activeTab === "em_andamento") return isAberta(ordem);
    return ordem.status === activeTab;
  }), [sourceOrdens, activeTab, user?.id]);

  const minhasCount = ordens.filter(o => o.responsavel_id === user?.id).length;

  const counts = {
    all: ordens.length,
    pendente: ordens.filter((s) => s.status === "pendente").length,
    em_diagnostico: ordens.filter((s) => s.status === "em_diagnostico").length,
    em_andamento: ordens.filter((s) => s.status === "em_andamento").length,
    aguardando_peca: ordens.filter((s) => s.status === "aguardando_peca").length,
    finalizado: ordens.filter((s) => s.status === "finalizado").length,
    overdue: ordens.filter((s) => isOverdue(s)).length,
  };

  const handleEdit = (ordem: OrdemServico) => {
    handleOpenModal(ordem);
  };

  const handleNew = () => {
    handleOpenModal(null);
  };

  const handleUpdateStatus = async (id: string, status: StatusOS) => {
    const ordem = ordens.find(o => o.id === id);
    if (!ordem) return;

    // Para finalização via Kanban: abrir modal de confirmação com pagamento
    if (status === "finalizado") {
      // Buscar total de itens da OS
      const { data: itensOS } = await supabase
        .from("itens_os")
        .select("valor_total, quantidade, valor_unitario")
        .eq("ordem_servico_id", id);
      
      const totalItens = (itensOS || []).reduce((acc, item) => acc + (item.valor_total ?? ((item.quantidade || 0) * (item.valor_unitario || 0))), 0);
      
      // CAUSA RAIZ: valor_servico JÁ contém a soma dos itens (via recalcOSTotals).
      // Usar o MAIOR entre valor_servico e totalItens como fallback,
      // NÃO somar os dois (isso causava double-counting no financeiro).
      const valorTotal = (ordem.valor_servico || 0) > 0 ? (ordem.valor_servico || 0) : totalItens;
      
      if (valorTotal <= 0) {
        toast.error("⚠️ Não é possível finalizar sem valor", {
          description: "Abra a OS e adicione o valor do serviço ou itens/peças antes de finalizar.",
          duration: 6000,
        });
        handleOpenModal(ordem);
        return;
      }

      // Abrir modal de confirmação com forma de pagamento e parcelas
      setKanbanFinalizarOrdem(ordem);
      setKanbanFinalizarValor(valorTotal);
      setKanbanFinalizarOpen(true);
      return;
    }

    // Para outros status, atualizar diretamente
    try {
      await updateOrdem.mutateAsync({ id, status } as any);
    } catch (error) {
      console.error("[Servicos] handleUpdateStatus:", error);
      import("@/lib/sentry").then(({ Sentry }) => Sentry.captureException(error, { extra: { osId: id, status, context: "handleUpdateStatus" } }));
      toast.error("Erro ao atualizar status da OS");
    }
  };

  const handleKanbanFinalizar = async (formaPagamentoId: string, formaPagamentoNome: string, numeroParcelas: number) => {
    const ordem = kanbanFinalizarOrdem;
    if (!ordem || !oficinaAtual?.id) return;

    try {
      // ATOMIC RPC: Everything in a single transaction
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "finalizar_os_atomica" as any,
        {
          p_os_id: ordem.id,
          p_forma_pagamento: formaPagamentoNome,
          p_forma_pagamento_id: formaPagamentoId,
          p_numero_parcelas: numeroParcelas,
        }
      );

      if (rpcError) {
        console.error("[Servicos] RPC finalizar_os_atomica error:", rpcError.message);
        toast.error(`Erro ao finalizar OS: ${rpcError.message}`);
        return;
      }

      const result = rpcResult as { success: boolean; os_id: string; valor_total: number; status: string };

      if (!result.success) {
        toast.error("Erro ao finalizar OS", { description: "Nenhuma alteração foi salva." });
        return;
      }

      // Invalidate all relevant caches
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
      queryClient.invalidateQueries({ queryKey: ["ordens_servico_count"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-resumo"] });
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas"] });

      setKanbanFinalizarOpen(false);
      setOrdemFinalizada({ ...ordem, status: "finalizado", valor_servico: result.valor_total } as OrdemServico);
      setOsFinalizadaOpen(true);
    } catch (error) {
      console.error("[Servicos] handleKanbanFinalizar:", error);
      import("@/lib/sentry").then(({ Sentry }) => Sentry.captureException(error, { extra: { osId: ordem.id, context: "handleKanbanFinalizar" } }));
      toast.error("Erro ao finalizar OS");
    }
  };

  const handleWhatsApp = (e: React.MouseEvent, ordem: OrdemServico) => {
    e.stopPropagation();
    openWhatsAppOS(ordem, oficinaAtual?.nome || "Oficina", oficinaAtual?.telefone);
    toast.success(`📱 WhatsApp — ${ordem.veiculo?.modelo || ordem.tipo_servico}`, {
      description: `Mensagem para ${ordem.cliente?.nome} preparada.`,
    });
  };

  // CAUSA RAIZ: Reabrir OS usa RPC atômica que reverte estoque e financeiro
  const handleReopenOS = async (ordem: OrdemServico) => {
    try {
      const { data: result, error } = await supabase.rpc(
        "reabrir_os_atomica" as any,
        { p_os_id: ordem.id }
      );

      if (error) {
        // Se tem parcelas pagas, o RPC bloqueia
        if (error.message?.includes("parcela")) {
          toast.error("Não é possível reabrir", {
            description: "Existem parcelas já pagas. Estorne antes de reabrir.",
            duration: 6000,
          });
        } else {
          toast.error(`Erro ao reabrir: ${error.message}`);
        }
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-resumo"] });
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas"] });
      toast.success("OS reaberta com sucesso!", {
        description: "Estoque e financeiro foram revertidos.",
      });
    } catch (err) {
      console.error("[Servicos] handleReopenOS:", err);
      toast.error("Erro ao reabrir OS");
    }
  };

  // Cancelar OS — atualiza status diretamente (trigger no banco valida transição)
  const handleCancelOS = async (ordem: OrdemServico) => {
    if (!confirm(`Deseja realmente cancelar a OS de ${ordem.cliente?.nome || "cliente"}?`)) return;
    try {
      await updateOrdem.mutateAsync({ id: ordem.id, status: "cancelado" } as any);
      toast.success("OS cancelada");
    } catch (error: any) {
      console.error("[Servicos] handleCancelOS:", error);
      toast.error(`Erro ao cancelar: ${error?.message || "Erro desconhecido"}`);
    }
  };

  const handleCopyLink = (e: React.MouseEvent, ordem: OrdemServico) => {
    e.stopPropagation();
    const url = getPublicOSLink(String(ordem.numero || ordem.id));
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!", {
      description: "Envie para o cliente acompanhar.",
    });
  };

  const handleViewOS = (e: React.MouseEvent, ordem: OrdemServico) => {
    e.stopPropagation();
    setOrdemVisualizacao(ordem);
    setOsVisualizacaoOpen(true);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <PageLoader message="Carregando serviços..." />
      </MainLayout>
    );
  }

  // Tabs visuais para status - adaptados para Auto Elétrica
  // Tabs simplificadas: 4 tabs essenciais (mobile-friendly)
  // P1 FIX #5: abertasCount uses same statuses as filter
  const abertasCount = ordens.filter(o => isAberta(o)).length;
  
  const tabs: { value: TabValue; label: string; count: number; className?: string }[] = [
    { value: "em_andamento", label: "Abertas", count: abertasCount },
    { value: "all", label: "Todas", count: counts.all },
    { value: "finalizado", label: "Finalizadas", count: counts.finalizado },
  ];

  if (minhasCount > 0) {
    tabs.splice(1, 0, { value: "minhas", label: "Minhas", count: minhasCount });
  }

  if (counts.overdue > 0) {
    tabs.push({ value: "overdue", label: "Atrasadas", count: counts.overdue, className: "text-destructive" });
  }

  return (
    <>
      <MainLayout>
        <div className="space-y-4">
          {/* BLINDAGEM: Banners de retomada de rascunho (OS completa + OS rápida) */}
          <DraftResumeBanner
            draftKey={`os-form-${oficinaAtual?.id || "new"}-new`}
            label="ordem de serviço"
            hidden={modalOpen || osRapidaOpen}
            onResume={() => handleOpenModal()}
          />
          <DraftResumeBanner
            draftKey={`os-rapida-${oficinaAtual?.id || "global"}`}
            label="OS rápida"
            hidden={modalOpen || osRapidaOpen}
            onResume={() => setOsRapidaOpen(true)}
          />
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                {isAutoEletrica && <Zap className="w-5 h-5 text-warning" />}
                {isAutoEletrica ? "Diagnósticos" : "Ordens de Serviço"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {totalCount > ordens.length ? `Exibindo ${ordens.length} de ${totalCount}` : `${ordens.length} registradas`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* View Toggle - escondido no mobile para economizar espaço */}
              <div className="hidden sm:flex bg-muted/50 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    viewMode === "list" ? "bg-background shadow-sm" : "text-muted-foreground"
                  )}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("kanban")}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    viewMode === "kanban" ? "bg-background shadow-sm" : "text-muted-foreground"
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
              {/* Botão OS Rápida - sempre visível com texto */}
              <Button 
                onClick={() => setOsRapidaOpen(true)} 
                variant="outline"
                size="sm"
                className="border-accent/50 text-accent hover:bg-accent/5"
              >
                <Zap className="w-4 h-4 sm:mr-2" />
                <span className="hidden xs:inline sm:inline">Rápida</span>
              </Button>
              {/* Botão Nova OS */}
              <Button 
                onClick={handleNew}
                size="sm"
                className={cn(
                  "shadow-md",
                  isAutoEletrica 
                    ? "bg-warning hover:bg-warning/90 shadow-warning/20" 
                    : "bg-accent hover:bg-accent/90 shadow-accent/20"
                )}
              >
                {isAutoEletrica ? <Zap className="w-4 h-4 sm:mr-2" /> : <Plus className="w-4 h-4 sm:mr-2" />}
                <span className="hidden sm:inline">{labels.novaOS}</span>
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, serviço ou placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-base"
            />
          </div>

          {/* Tabs Visuais - scroll horizontal no mobile */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
                  activeTab === tab.value
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted",
                  tab.className
                )}
              >
                {tab.label}
                <span className={cn(
                  "px-1.5 py-0.5 text-xs rounded-full min-w-[20px] text-center",
                  activeTab === tab.value ? "bg-background/20" : "bg-muted-foreground/10"
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Alerta consolidado: OS que precisam de atenção */}
          {(() => {
            const semValorCount = ordens.filter(o => o.status !== "finalizado" && o.status !== "cancelado" && (o.valor_servico || 0) === 0).length;
            const alertParts: string[] = [];
            if (staleCount > 0) alertParts.push(`${staleCount} parada${staleCount > 1 ? 's' : ''} há 24h+`);
            if (semValorCount > 0) alertParts.push(`${semValorCount} sem valor`);
            if (counts.overdue > 0 && activeTab !== "overdue") alertParts.push(`${counts.overdue} atrasada${counts.overdue > 1 ? 's' : ''}`);
            
            return alertParts.length > 0 ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                <span className="text-sm text-warning dark:text-warning">
                  <strong>Atenção:</strong> {alertParts.join(' · ')}
                </span>
              </div>
            ) : null;
          })()}

          {/* Kanban View */}
          {viewMode === "kanban" ? (
            <KanbanView
              ordens={filteredOrdens}
              onEdit={handleEdit}
              onUpdateStatus={handleUpdateStatus}
              filtroResponsavel={filtroResponsavel}
              onFiltroResponsavelChange={setFiltroResponsavel}
            />
          ) : (
            /* List View */
            <>
              {filteredOrdens.length === 0 ? (
                <div className="bg-card rounded-xl border border-border p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
                    <Wrench className="w-8 h-8 text-primary" />
                  </div>
                  {ordens.length === 0 ? (
                    <>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">Nenhuma OS cadastrada ainda</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Crie sua primeira Ordem de Serviço e veja o financeiro funcionando automaticamente
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 justify-center">
                        <Button onClick={() => setOsRapidaOpen(true)} className="bg-accent hover:bg-accent/90">
                          <Zap className="w-4 h-4 mr-2" /> OS Rápida (30 segundos)
                        </Button>
                        <Button onClick={handleNew} variant="outline">
                          <Plus className="w-4 h-4 mr-2" /> OS Completa
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Nenhum resultado para esta busca.</p>
                  )}
                </div>
              ) : (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="divide-y divide-border/50">
                      {filteredOrdens.map((ordem) => {
                      const statusConfig = getStatusConfig(isAutoEletrica);
                      const status = statusConfig[ordem.status];
                      const StatusIcon = status.icon;
                      const overdue = isOverdue(ordem);
                      const isMoto = ordem.veiculo?.tipo === "moto";

                      return (
                        <div
                          key={ordem.id}
                          className="flex items-center gap-3 p-3 sm:p-4 cursor-pointer transition-colors hover:bg-muted/30"
                          onClick={() => {
                            if (ordem.status === "finalizado") {
                              setOrdemVisualizacao(ordem);
                              setOsVisualizacaoOpen(true);
                            } else {
                              handleEdit(ordem);
                            }
                          }}
                        >
                          {/* Ícone Veículo — menor no mobile */}
                          <div className={cn(
                            "w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center flex-shrink-0",
                            isMoto ? "bg-primary/10" : "bg-primary/10"
                          )}>
                            {isMoto ? (
                              <Bike className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                            ) : (
                              <Car className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                            )}
                          </div>

                          {/* Info — compacto */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] h-5 px-1.5",
                                  overdue ? "bg-destructive/15 border-destructive/30 text-destructive" : status.className
                                )}
                              >
                                <StatusIcon className="w-2.5 h-2.5 mr-0.5" />
                                {overdue ? "Atrasado" : status.label}
                              </Badge>
                              {ordem.status !== "finalizado" && ordem.status !== "cancelado" && (ordem.valor_servico || 0) === 0 && (
                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-warning/15 text-warning border-warning/30">
                                  ⚠️ S/ valor
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-medium text-foreground truncate">
                                {ordem.cliente?.nome || "Cliente"}
                              </h3>
                              {ordem.numero && (
                                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1 py-0.5 rounded flex-shrink-0">
                                  #{ordem.numero}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {ordem.veiculo?.placa && (
                                <span className="font-mono bg-muted/80 px-1 py-0.5 rounded mr-1">
                                  {ordem.veiculo.placa}
                                </span>
                              )}
                              {ordem.veiculo?.marca} {ordem.veiculo?.modelo} • {ordem.tipo_servico}
                              {ordem.created_at && (
                                <span className="ml-1 opacity-70">
                                  • {(() => {
                                    const days = Math.floor((Date.now() - new Date(ordem.created_at).getTime()) / 86400000);
                                    if (days === 0) return "Hoje";
                                    if (days === 1) return "Ontem";
                                    return `${days}d atrás`;
                                  })()}
                                </span>
                              )}
                            </p>
                          </div>

                          {/* Quick Actions — escondidas no mobile, visíveis no desktop */}
                          <div className="hidden sm:flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-success"
                              onClick={(e) => handleWhatsApp(e, ordem)}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => handleViewOS(e as unknown as React.MouseEvent, ordem)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Ver OS
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => handleCopyLink(e as unknown as React.MouseEvent, ordem)}>
                                  <Link2 className="w-4 h-4 mr-2" />
                                  Copiar link
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {ordem.status !== "finalizado" && ordem.status !== "cancelado" && (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleUpdateStatus(ordem.id, "finalizado"); }}>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Finalizar
                                  </DropdownMenuItem>
                                )}
                                {ordem.status === "finalizado" && (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleReopenOS(ordem); }}>
                                    <PlayCircle className="w-4 h-4 mr-2" />
                                    Reabrir OS
                                  </DropdownMenuItem>
                                )}
                                {ordem.status !== "finalizado" && ordem.status !== "cancelado" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={(e) => { e.stopPropagation(); handleCancelOS(ordem); }}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <XCircle className="w-4 h-4 mr-2" />
                                      Cancelar OS
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Valor Total */}
                          {(ordem.valor_servico || 0) > 0 && (
                            <span className="text-sm font-semibold text-foreground flex-shrink-0 whitespace-nowrap hidden xs:inline sm:inline">
                              R$ {(ordem.valor_servico || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          )}

                          <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Load more button */}
              {hasNextPage && (
                <div className="flex justify-center py-4">
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="min-w-[200px]"
                  >
                    {isFetchingNextPage ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Carregando...
                      </>
                    ) : (
                      "Carregar mais"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </MainLayout>

      {/* FIX removeChild: Montagem condicional dos modais.
          Quando modalOpen=true, o componente monta fresco com open=true,
          eliminando a transição false→true que causava conflito de portal. */}
      {modalOpen && <OrdemServicoFormModal open={true} onOpenChange={handleCloseModal} ordem={ordemEdit} />}
      {osRapidaOpen && <OSRapidaModal open={osRapidaOpen} onOpenChange={setOsRapidaOpen} />}
      {osVisualizacaoOpen && (
        <OSVisualizacaoModal 
          open={true} 
          onOpenChange={setOsVisualizacaoOpen} 
          ordem={ordemVisualizacao}
          oficinaNome={oficinaAtual?.nome}
          oficinaTelefone={oficinaAtual?.telefone}
          onEdit={() => {
            setOsVisualizacaoOpen(false);
            if (ordemVisualizacao) {
              handleOpenModal(ordemVisualizacao);
            }
          }}
        />
      )}
      {osFinalizadaOpen && (
        <OSFinalizadaModal
          open={true}
          onOpenChange={setOsFinalizadaOpen}
          ordem={ordemFinalizada}
          oficinaNome={oficinaAtual?.nome}
          oficinaTelefone={oficinaAtual?.telefone}
          onEdit={() => {
            setOsFinalizadaOpen(false);
            if (ordemFinalizada) {
              handleOpenModal(ordemFinalizada);
            }
          }}
        />
      )}

      {/* Modal de confirmação para finalizar via Kanban */}
      <KanbanFinalizarModal
        open={kanbanFinalizarOpen}
        onOpenChange={setKanbanFinalizarOpen}
        ordem={kanbanFinalizarOrdem}
        valorTotal={kanbanFinalizarValor}
        onConfirm={handleKanbanFinalizar}
      />
    </>
  );
}
