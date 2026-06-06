import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
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
import { useOrcamentos, Orcamento, StatusOrcamento } from "@/hooks/useOrcamentos";
import { getPublicOrcamentoLink } from "@/utils/url";
import { useQueryClient } from "@tanstack/react-query";
import { castRpcResult, type ConverterOrcamentoEmOSResult } from "@/lib/rpcTypes";

import { OrcamentoFormModal } from "@/components/forms/OrcamentoFormModal";
import { DraftResumeBanner } from "@/components/DraftResumeBanner";
import { 
  Plus, 
  Search, 
  FileText, 
  User, 
  Car, 
  DollarSign,
  Send,
  CheckCircle,
  XCircle,
  ArrowRightCircle,
  Clock,
  MessageCircle,
  Link2,
  MoreVertical,
  Wrench,
  ChevronRight
} from "lucide-react";
import { useOficina } from "@/contexts/OficinaContext";
import { openWhatsAppOrcamento } from "@/lib/whatsapp";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePlan } from "@/hooks/usePlan";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { PageLoader } from "@/components/ui/loading-states";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

const statusConfig: Record<StatusOrcamento, { label: string; color: string; icon: any }> = {
  rascunho: { label: "Rascunho", color: "bg-muted text-muted-foreground border-muted", icon: FileText },
  enviado: { label: "Enviado", color: "bg-info/15 text-info border-info/30", icon: Send },
  aprovado: { label: "Aprovado", color: "bg-success/15 text-success border-success/30", icon: CheckCircle },
  rejeitado: { label: "Rejeitado", color: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
  convertido: { label: "Convertido", color: "bg-primary/15 text-primary border-primary/30", icon: ArrowRightCircle },
};

type TabValue = "todos" | StatusOrcamento;

export default function Orcamentos() {
  const { orcamentos, isLoading, updateStatus } = useOrcamentos();
  
  const { oficinaAtual } = useOficina();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasFeature, isLoading: planLoading } = usePlan();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOrcamento, setSelectedOrcamento] = useState<Orcamento | null>(null);
  const [statusFilter, setStatusFilter] = useState<TabValue>("todos");

  // Auto-open orçamento from URL (?new=1 or ?edit=ID) so mobile/PWA reload keeps the form open.
  useEffect(() => {
    const newParam = searchParams.get("new");
    const editId = searchParams.get("edit");

    if (newParam === "1" && !modalOpen) {
      setSelectedOrcamento(null);
      setModalOpen(true);
      return;
    }

    if (editId && orcamentos.length > 0 && !modalOpen) {
      const found = orcamentos.find(o => o.id === editId);
      if (found) {
        setSelectedOrcamento(found);
        setModalOpen(true);
      }
      const params = new URLSearchParams(searchParams);
      params.delete("edit");
      setSearchParams(params, { replace: true });
    }
  }, [searchParams, orcamentos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredOrcamentos = orcamentos.filter((orc) => {
    const matchesSearch = 
      orc.titulo.toLowerCase().includes(search.toLowerCase()) ||
      orc.cliente?.nome?.toLowerCase().includes(search.toLowerCase()) ||
      orc.numero?.toString().includes(search);
    const matchesStatus = statusFilter === "todos" || orc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenModal = (orcamento?: Orcamento) => {
    setSelectedOrcamento(orcamento || null);
    const params = new URLSearchParams(searchParams);
    params.delete("new");
    params.delete("edit");
    if (orcamento?.id) params.set("edit", orcamento.id);
    else params.set("new", "1");
    setSearchParams(params, { replace: true });
    setModalOpen(true);
  };

  const handleModalChange = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      setSelectedOrcamento(null);
      const params = new URLSearchParams(searchParams);
      params.delete("new");
      params.delete("edit");
      setSearchParams(params, { replace: true });
    }
  };

  const handleWhatsApp = async (e: React.MouseEvent, orcamento: Orcamento) => {
    e.stopPropagation();
    // Fetch items before sending to include in WhatsApp message
    try {
      const { data: itensData } = await supabase
        .from("itens_orcamento")
        .select("*")
        .eq("orcamento_id", orcamento.id);
      openWhatsAppOrcamento(orcamento, oficinaAtual?.nome || "Oficina", oficinaAtual?.telefone, (itensData as any[]) || []);
    } catch {
      openWhatsAppOrcamento(orcamento, oficinaAtual?.nome || "Oficina", oficinaAtual?.telefone);
    }
  };

  const handleCopyLink = (e: React.MouseEvent, orcamento: Orcamento) => {
    e.stopPropagation();
    // CAUSA RAIZ: Usava window.location.origin diretamente, ignorando a lógica de domínio customizado.
    // Agora usa getPublicOrcamentoLink que possui a blindagem necessária.
    const url = getPublicOrcamentoLink(orcamento.numero || orcamento.id);
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const handleStatusChange = async (e: React.MouseEvent, orcamento: Orcamento, status: StatusOrcamento) => {
    e.stopPropagation();
    await updateStatus.mutateAsync({ id: orcamento.id, status });
  };

  const handleConvertToOS = async (e: React.MouseEvent, orcamento: Orcamento) => {
    e.stopPropagation();
    if (!orcamento.cliente_id || !orcamento.veiculo_id) {
      toast.error("Orçamento incompleto", { description: "Adicione cliente e veículo antes de converter." });
      return;
    }
    if (orcamento.status === "convertido") {
      toast.info("Este orçamento já foi convertido em OS.");
      return;
    }
    if (!oficinaAtual) return;
    try {
      // ARQUITETURA ATÔMICA: tudo em uma única transação PostgreSQL.
      // RPC faz lock (FOR UPDATE) + valida status + cria OS + copia itens + marca convertido.
      // Em qualquer falha, rollback automático — nada de OS órfã.
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        'converter_orcamento_em_os' as any,
        {
          p_orcamento_id: orcamento.id,
          p_oficina_id: oficinaAtual.id,
        }
      );

      if (rpcError) throw rpcError;
      const result = castRpcResult<ConverterOrcamentoEmOSResult>(rpcResult);

      // Invalida caches pra UI refletir o novo status sem F5
      queryClient.invalidateQueries({ queryKey: ["orcamentos", oficinaAtual.id] });
      queryClient.invalidateQueries({ queryKey: ["ordens-servico"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      toast.success("OS criada com sucesso!", {
        description: `${result.itens_copiados} iten(s) copiados — ${formatCurrency(Number(result.valor_total))}`
      });
      navigate(`/servicos?os=${result.os_id}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao converter orçamento";
      toast.error("Erro ao converter orçamento", { description: msg });
    }
  };

  if (isLoading || planLoading) {
    return (
      <MainLayout>
        <PageLoader message="Carregando orçamentos..." />
      </MainLayout>
    );
  }

  if (!hasFeature("orcamentos")) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <UpgradePrompt feature="orcamentos" />
        </div>
      </MainLayout>
    );
  }

  // Stats
  const stats = {
    total: orcamentos.length,
    pendentes: orcamentos.filter((o) => o.status === "rascunho" || o.status === "enviado").length,
    aprovados: orcamentos.filter((o) => o.status === "aprovado").length,
    valorAprovado: orcamentos
      .filter((o) => o.status === "aprovado" || o.status === "convertido")
      .reduce((acc, o) => acc + ((o.valor_total || 0) - (o.desconto || 0)), 0),
  };

  // Tabs para status
  const tabs: { value: TabValue; label: string; count: number }[] = [
    { value: "todos", label: "Todos", count: stats.total },
    { value: "rascunho", label: "Rascunho", count: orcamentos.filter(o => o.status === "rascunho").length },
    { value: "enviado", label: "Enviado", count: orcamentos.filter(o => o.status === "enviado").length },
    { value: "aprovado", label: "Aprovado", count: stats.aprovados },
  ];

  return (
    <MainLayout>
      <div className="space-y-4 w-full max-w-full overflow-x-hidden">
        {/* Header - Responsivo */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">Orçamentos</h1>
            <p className="text-sm text-muted-foreground">{orcamentos.length} cadastrados</p>
          </div>
          <Button onClick={() => handleOpenModal()} className="bg-accent hover:bg-accent/90 flex-shrink-0">
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Novo Orçamento</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>

        {/* BLINDAGEM: Banner de retomada de rascunho */}
        <DraftResumeBanner
          draftKey={`orcamento-form-${oficinaAtual?.id || "global"}-new`}
          label="orçamento"
          hidden={modalOpen}
          onResume={() => handleOpenModal()}
        />

        {/* Stats compactas - Responsivo */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-card rounded-lg border border-border p-2 sm:p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-warning flex-shrink-0" />
              <span className="text-[10px] sm:text-xs text-muted-foreground truncate">Pendentes</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-foreground">{stats.pendentes}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-2 sm:p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success flex-shrink-0" />
              <span className="text-[10px] sm:text-xs text-muted-foreground truncate">Aprovados</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-foreground">{stats.aprovados}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-2 sm:p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent flex-shrink-0" />
              <span className="text-[10px] sm:text-xs text-muted-foreground truncate">Aprovado</span>
            </div>
            <p className="text-base sm:text-xl font-bold text-foreground truncate">
              <span className="hidden sm:inline">R$ </span><span className="sm:hidden text-sm">R$</span>{formatCurrency(stats.valorAprovado).replace('R$\u00a0', '')}
            </p>
          </div>
        </div>

        {/* Busca + Filtros */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, cliente ou número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabs de Status */}
        <div className="w-full overflow-x-auto scrollbar-none">
          <div className="flex gap-2 w-max pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
                  statusFilter === tab.value
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {tab.label}
                <span className={cn(
                  "px-1.5 py-0.5 text-xs rounded-full",
                  statusFilter === tab.value ? "bg-background/20" : "bg-muted-foreground/10"
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        {filteredOrcamentos.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-4">
              {search ? "Nenhum resultado." : "Nenhum orçamento cadastrado."}
            </p>
            {!search && (
              <Button onClick={() => handleOpenModal()} size="sm">
                <Plus className="w-4 h-4 mr-2" /> Criar orçamento
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="divide-y divide-border">
              {filteredOrcamentos.map((orcamento) => {
                const StatusIcon = statusConfig[orcamento.status].icon;
                const valorFinal = (orcamento.valor_total || 0) - (orcamento.desconto || 0);
                
                return (
                  <motion.div
                    key={orcamento.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3 p-3 sm:p-4 cursor-pointer transition-colors hover:bg-muted/30"
                    onClick={() => handleOpenModal(orcamento)}
                  >
                    {/* Número */}
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-xs sm:text-sm font-bold text-muted-foreground">#{orcamento.numero}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", statusConfig[orcamento.status].color)}>
                          <StatusIcon className="w-2.5 h-2.5 mr-0.5" />
                          {statusConfig[orcamento.status].label}
                        </Badge>
                      </div>
                      <h3 className="text-sm font-medium text-foreground truncate">{orcamento.titulo}</h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {orcamento.cliente?.nome || ""}
                        {orcamento.veiculo ? ` • ${orcamento.veiculo.marca} ${orcamento.veiculo.modelo}` : ""}
                      </p>
                    </div>

                    {/* Valor + Converter */}
                    <div className="text-right flex-shrink-0 space-y-1">
                      <p className="text-sm font-bold text-primary tabular-nums">
                        {formatCurrency(valorFinal)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(orcamento.created_at), "dd/MM/yy", { locale: ptBR })}
                      </p>
                      {orcamento.status === "aprovado" && (
                        <Button
                          size="sm"
                          className="h-7 text-xs px-2 bg-accent hover:bg-accent/90 w-full"
                          onClick={(e) => handleConvertToOS(e, orcamento)}
                        >
                          <Wrench className="w-3 h-3 mr-1" />
                          Criar OS
                        </Button>
                      )}
                    </div>

                    {/* Quick Actions — desktop only */}
                    <div className="hidden sm:flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-success"
                        onClick={(e) => handleWhatsApp(e, orcamento)}
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
                          <DropdownMenuItem onClick={(e) => handleCopyLink(e as unknown as React.MouseEvent, orcamento)}>
                            <Link2 className="w-4 h-4 mr-2" />
                            Copiar link
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {orcamento.status !== "aprovado" && (
                            <DropdownMenuItem onClick={(e) => handleStatusChange(e as unknown as React.MouseEvent, orcamento, "aprovado")}>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Aprovar
                            </DropdownMenuItem>
                          )}
                          {orcamento.status === "aprovado" && (
                            <DropdownMenuItem onClick={(e) => handleConvertToOS(e as unknown as React.MouseEvent, orcamento)}>
                              <Wrench className="w-4 h-4 mr-2" />
                              Criar OS
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <OrcamentoFormModal 
        open={modalOpen} 
        onOpenChange={handleModalChange} 
        orcamento={selectedOrcamento} 
      />
    </MainLayout>
  );
}
