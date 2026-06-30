import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrcamentos, useItensOrcamento, Orcamento, StatusOrcamento } from "@/hooks/useOrcamentos";
import { useVeiculos } from "@/hooks/useVeiculos";
import { useIsMobile } from "@/hooks/use-mobile";
import { ItemSelector } from "@/components/orcamentos/ItemSelector";
import { InlineItemForm, PendingItem } from "@/components/orcamentos/InlineItemForm";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ClienteSelectWithCreate } from "./ClienteSelectWithCreate";
import { VeiculoSelectWithCreate } from "./VeiculoSelectWithCreate";
import { formatCurrency } from "@/lib/formatters";
import { 
  Loader2, 
  FileText, 
  Plus, 
  Trash2, 
  Package, 
  Wrench,
  Send,
  CheckCircle,
  XCircle,
  ArrowRightCircle,
  MessageCircle,
  Link2,
  CreditCard,
  Check
} from "lucide-react";
import { useOficina } from "@/contexts/OficinaContext";
import { openWhatsAppOrcamento } from "@/lib/whatsapp";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { rpcWithRetry } from "@/lib/rpcWithRetry";
import { useOrcamentoPagamento } from "@/hooks/useOrcamentoPagamento";
import { getPublicOrcamentoLink } from "@/utils/url";
import { format } from "date-fns";
import { handleFormKeyDown } from "@/lib/formGuard";
import { useAutoSave } from "@/hooks/useAutoSave";
import { SavingIndicator } from "@/components/ui/saving-indicator";

interface OrcamentoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orcamento?: Orcamento | null;
  initialClienteId?: string;
  initialVeiculoId?: string;
}

const statusConfig: Record<StatusOrcamento, { label: string; color: string; icon: any }> = {
  rascunho: { label: "Rascunho", color: "bg-muted text-muted-foreground", icon: FileText },
  enviado: { label: "Enviado", color: "bg-info/15 text-info", icon: Send },
  aprovado: { label: "Aprovado", color: "bg-success/15 text-success", icon: CheckCircle },
  rejeitado: { label: "Rejeitado", color: "bg-destructive/15 text-destructive", icon: XCircle },
  convertido: { label: "Convertido em OS", color: "bg-primary/15 text-primary", icon: ArrowRightCircle },
};

export function OrcamentoFormModal({ open, onOpenChange, orcamento, initialClienteId, initialVeiculoId }: OrcamentoFormModalProps) {
  const { createOrcamento, updateOrcamento, deleteOrcamento, updateStatus, recalcularTotais } = useOrcamentos();
  const { veiculos } = useVeiculos();
  const { oficinaAtual } = useOficina();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { generateAndCopyLink, generateAndShareWhatsApp, loading: paymentLoading } = useOrcamentoPagamento();
  
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertLoading, setConvertLoading] = useState(false);
  const [itemSelectorOpen, setItemSelectorOpen] = useState(false);
  const [createdOrcamentoId, setCreatedOrcamentoId] = useState<string | null>(null);

  // BLINDAGEM: Proteção contra duplo clique
  const isSubmittingRef = useRef(false);
  const lastSubmitRef = useRef<number>(0);
  const formRef = useRef<HTMLFormElement>(null);
  
  // Pending items for new budgets (before saving)
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  
  // Form state
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [validade, setValidade] = useState("");
  const [desconto, setDesconto] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const isEditing = !!orcamento;
  const activeOrcamentoId = orcamento?.id || createdOrcamentoId;
  const draftRestoreAttemptedRef = useRef(false);
  const draftKey = `orcamento-form-${oficinaAtual?.id || "global"}-${orcamento?.id || "new"}`;
  const draftData = useMemo(() => ({
    titulo,
    descricao,
    clienteId,
    veiculoId,
    validade,
    desconto,
    observacoes,
    pendingItems,
  }), [titulo, descricao, clienteId, veiculoId, validade, desconto, observacoes, pendingItems]);
  const hasDraftContent = Boolean(
    titulo.trim() || descricao.trim() || clienteId || veiculoId || validade || desconto || observacoes.trim() || pendingItems.length > 0
  );

  const applyDraft = useCallback((draft: typeof draftData) => {
    setTitulo(draft.titulo || "");
    setDescricao(draft.descricao || "");
    setClienteId(draft.clienteId || "");
    setVeiculoId(draft.veiculoId || "");
    setValidade(draft.validade || "");
    setDesconto(draft.desconto || "");
    setObservacoes(draft.observacoes || "");
    setPendingItems(draft.pendingItems || []);
  }, []);

  const { hasDraft, lastSaved, restore, clearDraft, saveNow, isSaving } = useAutoSave({
    key: draftKey,
    data: draftData,
    enabled: open && !isEditing && !createdOrcamentoId && hasDraftContent,
    interval: 1500,
    onRestore: applyDraft,
  });
  
  const { itens, addItem, removeItem, valorTotal, custoTotal } = useItensOrcamento(activeOrcamentoId || undefined);

  const veiculosDoCliente = veiculos.filter((v) => v.cliente_id === clienteId);

  // Reset form completely when opening modal for new orcamento
  useEffect(() => {
    if (!open) return; // Only act when opening
    
    if (orcamento) {
      setTitulo(orcamento.titulo);
      setDescricao(orcamento.descricao || "");
      setClienteId(orcamento.cliente_id || "");
      setVeiculoId(orcamento.veiculo_id || "");
      setValidade(orcamento.validade || "");
      setDesconto(orcamento.desconto?.toString() || "");
      setObservacoes(orcamento.observacoes || "");
      setCreatedOrcamentoId(null);
      setPendingItems([]);
    } else {
      if (!draftRestoreAttemptedRef.current) {
        draftRestoreAttemptedRef.current = true;
        if (restore()) return;
      }
      resetForm();
    }
  }, [orcamento, open, restore]); // eslint-disable-line react-hooks/exhaustive-deps

  // Also reset when modal closes to prevent stale state
  useEffect(() => {
    if (!open) {
      // Small delay to allow closing animation
      const timer = setTimeout(() => {
        setCreatedOrcamentoId(null);
        setPendingItems([]);
        setItemSelectorOpen(false);
        draftRestoreAttemptedRef.current = false;
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const resetForm = () => {
    setTitulo("");
    setDescricao("");
    setClienteId(initialClienteId || "");
    setVeiculoId(initialVeiculoId || "");
    setValidade("");
    setDesconto("");
    setObservacoes("");
    setCreatedOrcamentoId(null);
    setPendingItems([]);
    setItemSelectorOpen(false);
    setDeleteDialogOpen(false);
    setConvertDialogOpen(false);
  };
  
  // Handle pending items for new budgets
  const handleAddPendingItem = (item: Omit<PendingItem, "id" | "valor_total">) => {
    const maoObra = item.valor_mao_obra || 0;
    const newItem: PendingItem = {
      ...item,
      id: crypto.randomUUID(),
      valor_total: (item.quantidade * item.valor_unitario) + maoObra,
    };
    setPendingItems((prev) => [...prev, newItem]);
  };
  
  const handleRemovePendingItem = (id: string) => {
    setPendingItems((prev) => prev.filter((item) => item.id !== id));
  };

  const validateForm = useCallback((): boolean => {
    const errors: string[] = [];
    if (!titulo.trim() || titulo.trim().length < 2) {
      errors.push("Título deve ter pelo menos 2 caracteres");
    }
    if (errors.length > 0) {
      toast.error("Corrija os erros no formulário", {
        description: errors.join(" • "),
      });
      // Scroll to title field
      if (formRef.current) {
        const el = formRef.current.querySelector("#titulo") as HTMLElement;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
        }
      }
      return false;
    }
    return true;
  }, [titulo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // BLINDAGEM MOBILE: blur teclado antes de processar
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (!validateForm()) return;

    // BLINDAGEM CONTRA PERDA: antes de chamar o servidor, força uma cópia local
    // do orçamento completo. Se a RPC falhar, o rascunho continua recuperável.
    if (!isEditing && !createdOrcamentoId && hasDraftContent) {
      saveNow();
    }

    // BLINDAGEM: Proteção contra duplo clique/submit
    const now = Date.now();
    if (isSubmittingRef.current || now - lastSubmitRef.current < 1000) {
      console.log("[Orcamento Form] Submit bloqueado - ação já em andamento");
      return;
    }

    isSubmittingRef.current = true;
    lastSubmitRef.current = now;
    setLoading(true);

    const data = {
      titulo,
      descricao: descricao || undefined,
      cliente_id: clienteId || undefined,
      veiculo_id: veiculoId || undefined,
      validade: validade || undefined,
      desconto: desconto ? parseFloat(desconto) : undefined,
      observacoes: observacoes || undefined,
    };

    try {
      if (isEditing && orcamento) {
        await updateOrcamento.mutateAsync({ id: orcamento.id, ...data });
        await recalcularTotais.mutateAsync(orcamento.id);
      } else if (createdOrcamentoId) {
        await updateOrcamento.mutateAsync({ id: createdOrcamentoId, ...data });
        await recalcularTotais.mutateAsync(createdOrcamentoId);
      } else {
        // ARQUITETURA ATÔMICA: Criar orçamento + itens em transação única via RPC
        if (pendingItems.length > 0 && oficinaAtual) {
          const itensPayload = pendingItems.map(item => ({
            nome_item: item.nome_item,
            tipo: item.tipo || 'produto',
            quantidade: Number(item.quantidade) || 1,
            valor_unitario: Number(item.valor_unitario) || 0,
            valor_mao_obra: Number((item as any).valor_mao_obra) || 0,
            custo_unitario: Number(item.custo_unitario) || 0,
            estoque_id: item.estoque_id || null,
          }));

          const { data: rpcResult, error: rpcError } = await rpcWithRetry(
            'criar_orcamento_completo',
            {
              p_oficina_id: oficinaAtual.id,
              p_titulo: titulo,
              p_cliente_id: clienteId || null,
              p_veiculo_id: veiculoId || null,
              p_descricao: descricao || null,
              p_validade: validade || null,
              p_desconto: desconto ? parseFloat(desconto) : 0,
              p_observacoes: observacoes || null,
              p_itens: itensPayload,
            }
          );

          if (rpcError) throw rpcError;
          const result = rpcResult as any;
          clearDraft();
          toast.success(`Orçamento #${result.numero} criado com ${result.itens_inseridos} iten(s)!`);
        } else {
          // Sem itens pendentes — criar apenas o cabeçalho
          await createOrcamento.mutateAsync(data);
          clearDraft();
        }
      }
      onOpenChange(false);
    } catch (error: any) {
      console.error("[OrcamentoForm] Erro ao salvar orçamento:", error);
      const msg = error?.message || "Erro ao salvar orçamento";
      toast.error("Orçamento não foi salvo", {
        description: `${msg}. O rascunho foi mantido para tentar novamente.`,
      });
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!orcamento) return;
    await deleteOrcamento.mutateAsync(orcamento.id);
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (!isEditing) {
      clearDraft();
      resetForm();
    }
    onOpenChange(false);
  };

  const handleAddItem = async (item: any) => {
    if (!activeOrcamentoId) return;
    await addItem.mutateAsync({
      orcamento_id: activeOrcamentoId,
      ...item,
    });
    await recalcularTotais.mutateAsync(activeOrcamentoId);
  };

  const handleRemoveItem = async (itemId: string) => {
    await removeItem.mutateAsync(itemId);
    if (activeOrcamentoId) {
      await recalcularTotais.mutateAsync(activeOrcamentoId);
    }
  };

  const handleStatusChange = async (newStatus: StatusOrcamento) => {
    if (!orcamento) return;
    
    if (newStatus === "convertido") {
      // Show confirmation dialog instead of converting directly
      setConvertDialogOpen(true);
      return;
    }
    
    await updateStatus.mutateAsync({ id: orcamento.id, status: newStatus });
  };

  const handleConvertToOS = async () => {
    if (!orcamento || !oficinaAtual) return;
    
    // Validate required fields
    if (!orcamento.cliente_id || !orcamento.veiculo_id) {
      toast.error("Cliente e veículo são obrigatórios para criar uma OS");
      setConvertDialogOpen(false);
      return;
    }
    
    setConvertLoading(true);
    
    try {
      // ARQUITETURA ATÔMICA: Tudo em uma única transação via RPC
      const { data: rpcResult, error: rpcError } = await rpcWithRetry(
        'converter_orcamento_em_os',
        {
          p_orcamento_id: orcamento.id,
          p_oficina_id: oficinaAtual.id,
        }
      );

      if (rpcError) throw rpcError;

      const result = rpcResult as any;
      
      toast.success("Orçamento convertido em OS!", {
        description: `${result.itens_copiados} iten(s) copiados — ${formatCurrency(Number(result.valor_total))}`
      });
      
      setConvertDialogOpen(false);
      onOpenChange(false);
      
      // Invalidar caches
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
      
      // Abrir a OS recém-criada para revisão
      navigate(`/servicos?os=${result.os_id}`);
    } catch (error: any) {
      toast.error("Erro ao converter orçamento", { description: error.message });
    } finally {
      setConvertLoading(false);
    }
  };

  const handleWhatsApp = () => {
    if (!orcamento) return;
    openWhatsAppOrcamento(orcamento, oficinaAtual?.nome || "Oficina", oficinaAtual?.telefone, itens);
  };

  const handleCopyLink = () => {
    if (!orcamento) return;
    // CAUSA RAIZ: Usava window.location.origin diretamente.
    const url = getPublicOrcamentoLink(orcamento.oficina_id, orcamento.id);
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!", { description: "Envie para o cliente visualizar o orçamento" });
  };

  // Payment link handlers
  const handleGeneratePaymentLink = async () => {
    if (!orcamento) return;
    const valorFinalCalc = (orcamento.valor_total || 0) - (orcamento.desconto || 0);
    if (valorFinalCalc <= 0) {
      toast.error("Valor do orçamento deve ser maior que zero para gerar link de pagamento");
      return;
    }
    try {
      await generateAndCopyLink({
        orcamentoId: orcamento.id,
        valor: valorFinalCalc,
        titulo: orcamento.titulo,
        clienteNome: orcamento.cliente?.nome || undefined,
      });
    } catch {
      toast.error("Erro ao gerar link de pagamento. Tente novamente.");
    }
  };

  const handlePaymentWhatsApp = async () => {
    if (!orcamento) return;
    const valorFinalCalc = (orcamento.valor_total || 0) - (orcamento.desconto || 0);
    if (valorFinalCalc <= 0) {
      toast.error("Valor do orçamento deve ser maior que zero para gerar link de pagamento");
      return;
    }
    try {
      await generateAndShareWhatsApp(
        {
          orcamentoId: orcamento.id,
          valor: valorFinalCalc,
          titulo: orcamento.titulo,
          clienteNome: orcamento.cliente?.nome || undefined,
        },
        orcamento.cliente?.telefone || undefined
      );
    } catch {
      toast.error("Erro ao gerar link de pagamento. Tente novamente.");
    }
  };

  // Check if payment button should show (approved and not converted/paid)
  const showPaymentButton = orcamento?.status === "aprovado";

  // Include pending items (not yet saved) in the total for new orçamentos
  const pendingItemsTotal = pendingItems.reduce((acc, item) => acc + (item.valor_total || 0), 0);
  const pendingItemsCusto = pendingItems.reduce((acc, item) => acc + ((item.custo_unitario || 0) * item.quantidade), 0);
  const displayValorTotal = valorTotal + pendingItemsTotal;
  const displayCustoTotal = custoTotal + pendingItemsCusto;
  const valorFinal = displayValorTotal - (parseFloat(desconto) || 0);
  const lucroEstimado = valorFinal - displayCustoTotal;

  // P0 FIX: Adaptive modal (Dialog for desktop, Drawer for mobile)
  const FormContent = (
    <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto space-y-6">
      {/* Status Badge and Actions for editing */}
      {isEditing && orcamento && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge className={statusConfig[orcamento.status].color}>
              {statusConfig[orcamento.status].label}
            </Badge>
            {orcamento.status !== "convertido" && (
              <Select value={orcamento.status} onValueChange={(v) => handleStatusChange(v as StatusOrcamento)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[9999] bg-background" position="popper">
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="enviado">Enviar ao Cliente</SelectItem>
                  <SelectItem value="aprovado">Marcar Aprovado</SelectItem>
                  <SelectItem value="rejeitado">Marcar Rejeitado</SelectItem>
                  <SelectItem value="convertido">Converter em OS</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          
          {/* WhatsApp and Link actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 text-success border-success/30 hover:bg-success/10"
              onClick={handleWhatsApp}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Enviar WhatsApp
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleCopyLink}
            >
              <Link2 className="w-4 h-4 mr-2" />
              Copiar Link
            </Button>
          </div>

          {/* Payment Button - Only for approved budgets */}
          {showPaymentButton && (
            <div className="p-3 mt-2 bg-accent/10 border border-accent/30 rounded-lg space-y-3">
              <p className="text-sm font-medium text-accent flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Link de Pagamento (Mercado Pago)
              </p>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 min-h-[40px]"
                  onClick={handleGeneratePaymentLink}
                  disabled={paymentLoading}
                >
                  {paymentLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Link2 className="w-4 h-4 mr-2" />
                  )}
                  Copiar Link MP
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1 min-h-[40px] bg-success hover:bg-success/90 text-success-foreground"
                  onClick={handlePaymentWhatsApp}
                  disabled={paymentLoading}
                >
                  {paymentLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <MessageCircle className="w-4 h-4 mr-2" />
                  )}
                  WhatsApp MP
                </Button>
              </div>
            </div>
          )}

          {/* Botão de Conversão em OS — visível para orçamentos aprovados */}
          {orcamento.status === "aprovado" && (
            <Button
              type="button"
              className="w-full h-12 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-base"
              onClick={() => setConvertDialogOpen(true)}
            >
              <ArrowRightCircle className="w-5 h-5 mr-2" />
              Converter em Ordem de Serviço
            </Button>
          )}
        </div>
      )}

      {/* Basic Info */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="titulo">Título do Orçamento *</Label>
          <Input
            id="titulo"
            placeholder="Ex: Revisão completa - Uno 2020"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
            className="h-12 text-base"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <ClienteSelectWithCreate
              value={clienteId}
              onValueChange={setClienteId}
            />
          </div>

          <div className="space-y-2">
            <Label>Veículo</Label>
            <VeiculoSelectWithCreate
              value={veiculoId}
              onValueChange={setVeiculoId}
              clienteId={clienteId}
              veiculosDoCliente={veiculosDoCliente}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="descricao">Descrição</Label>
          <Textarea
            id="descricao"
            placeholder="Descrição geral do orçamento..."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            className="text-base"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="validade">Válido até</Label>
            <Input
              id="validade"
              type="date"
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desconto">Desconto (R$)</Label>
            <Input
              id="desconto"
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0.00"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              className="h-12 text-base"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Items Section - Inline form for new budgets, modal for existing */}
      <div className="space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Package className="w-4 h-4" />
          Itens do Orçamento
        </h3>
        
        {/* For NEW budgets: show inline form */}
        {!activeOrcamentoId && (
          <InlineItemForm
            pendingItems={pendingItems}
            onAddItem={handleAddPendingItem}
            onRemoveItem={handleRemovePendingItem}
            desconto={parseFloat(desconto) || 0}
          />
        )}
        
        {/* For EXISTING budgets: show items list with modal add */}
        {activeOrcamentoId && (
          <>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItemSelectorOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Item
              </Button>
            </div>

            {itens.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum item adicionado</p>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setItemSelectorOpen(true)}
                >
                  Adicionar primeiro item
                </Button>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                <div className="space-y-2">
                  {itens.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg gap-2"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {item.tipo === "produto" ? (
                          <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <Wrench className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{item.nome_item}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.quantidade}x {formatCurrency(item.valor_unitario)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-semibold text-sm">{formatCurrency(item.valor_total)}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveItem(item.id); }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Totals for existing budget */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{formatCurrency(displayValorTotal)}</span>
              </div>
              {parseFloat(desconto) > 0 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>Desconto:</span>
                  <span>- {formatCurrency(parseFloat(desconto))}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>{formatCurrency(valorFinal)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Custo estimado:</span>
                <span>{formatCurrency(displayCustoTotal)}</span>
              </div>
              <div className={`flex justify-between text-sm font-medium ${lucroEstimado >= 0 ? "text-success" : "text-destructive"}`}>
                <span>Lucro estimado:</span>
                <span>{formatCurrency(lucroEstimado)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Observations */}
      <div className="space-y-2">
        <Label htmlFor="obs">Observações</Label>
        <Textarea
          id="obs"
          placeholder="Condições, prazos, etc..."
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          className="text-base"
        />
      </div>
      </div>{/* end scrollable area */}

      <Separator className="my-3" />

      {/* Actions - sticky footer */}
      <div className="sticky bottom-0 bg-background pt-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] flex justify-between gap-2">
        <div>
          {isEditing && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </Button>
          )}
          {!isEditing && (
            <SavingIndicator isSaving={isSaving} lastSaved={lastSaved} hasDraft={hasDraft && !loading} />
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleCancel} className="h-12">
            Cancelar
          </Button>
          <Button type="submit" className="bg-accent hover:bg-accent/90 h-12 font-semibold" disabled={loading || !titulo.trim()}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : isEditing || createdOrcamentoId ? (
              "Salvar"
            ) : (
              "Criar Orçamento"
            )}
          </Button>
        </div>
      </div>
    </form>
  );

  const HeaderTitle = (
    <div className="flex items-center gap-2">
      <FileText className="w-5 h-5 text-accent" />
      {isEditing ? `Orçamento #${orcamento.numero}` : createdOrcamentoId ? "Adicionar Itens" : "Novo Orçamento"}
    </div>
  );

  // P0 FIX: Adaptive rendering - Drawer for mobile, Dialog for desktop
  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="max-h-[90dvh] px-4 pb-6 flex flex-col">
            <DrawerHeader className="text-left px-0 shrink-0 flex items-center justify-between">
              <DrawerTitle>{HeaderTitle}</DrawerTitle>
              <Button
                type="button"
                size="sm"
                className="bg-accent hover:bg-accent/90 min-h-[44px] min-w-[44px]"
                disabled={loading || !titulo.trim()}
                onClick={() => formRef.current?.requestSubmit()}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </Button>
            </DrawerHeader>
            {FormContent}
          </DrawerContent>
        </Drawer>

        <ItemSelector
          open={itemSelectorOpen}
          onOpenChange={setItemSelectorOpen}
          onAddItem={handleAddItem}
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Excluir Orçamento"
          description="Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita."
          confirmText="Excluir"
          onConfirm={handleDelete}
          variant="destructive"
        />

        <ConfirmDialog
          open={convertDialogOpen}
          onOpenChange={setConvertDialogOpen}
          title="Converter em Ordem de Serviço"
          description={`Ao converter, uma nova OS será criada automaticamente com os dados deste orçamento${orcamento?.cliente?.nome ? ` para ${orcamento.cliente.nome}` : ''}. O estoque dos itens será atualizado.`}
          confirmText={convertLoading ? "Convertendo..." : "Converter em OS"}
          onConfirm={handleConvertToOS}
          isLoading={convertLoading}
        />
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{HeaderTitle}</DialogTitle>
          </DialogHeader>
          {FormContent}
        </DialogContent>
      </Dialog>

      <ItemSelector
        open={itemSelectorOpen}
        onOpenChange={setItemSelectorOpen}
        onAddItem={handleAddItem}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Orçamento"
        description="Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        onConfirm={handleDelete}
        variant="destructive"
      />

      <ConfirmDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        title="Converter em Ordem de Serviço"
        description={`Ao converter, uma nova OS será criada automaticamente com os dados deste orçamento${orcamento?.cliente?.nome ? ` para ${orcamento.cliente.nome}` : ''}. O estoque dos itens será atualizado.`}
        confirmText={convertLoading ? "Convertendo..." : "Converter em OS"}
        onConfirm={handleConvertToOS}
        isLoading={convertLoading}
      />
    </>
  );
}
