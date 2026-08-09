import { useState, useEffect, useRef, useCallback, useMemo } from "react";
// parseCurrency handles Brazilian thousand separators correctly (e.g. "1.500,50" → 1500.5)
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAutoSave } from "@/hooks/useAutoSave";
import { DraftPromptDialog } from "@/components/DraftPromptDialog";
import { rpcWithRetry } from "@/lib/rpcWithRetry";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { useOficina } from "@/contexts/OficinaContext";
import { useVeiculos } from "@/hooks/useVeiculos";
import { useQueryClient } from "@tanstack/react-query";
import { ClienteSelectWithCreate } from "@/components/forms/ClienteSelectWithCreate";
import { VeiculoSelectWithCreate } from "@/components/forms/VeiculoSelectWithCreate";
import { ServicoRapidoModal } from "@/components/servicos/ServicoRapidoModal";
import { useFormasPagamento } from "@/hooks/useFormasPagamento";
import { ResponsavelSelect } from "@/components/forms/ResponsavelSelect";
import { openWhatsAppOS } from "@/lib/whatsapp";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { trackFunnelEvent } from "@/lib/funnelTracking";
import { upsertFinanceiroOS } from "@/lib/financeiroOS";
import { logDetailedError } from "@/lib/errorHandling";
import { 
  Zap, 
  Loader2, 
  Check, 
  MessageCircle, 
  ChevronRight,
  DollarSign,
  Plus,
  Package,
  Trash2,
  PlayCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, parseCurrency } from "@/lib/formatters";
import { isChildModalActive } from "@/lib/childModalLock";
import { tiposServicoCarro, tiposServicoMoto, tiposServicoAutoEletrica } from "@/components/forms/os/OSFormConstants";
import { VoiceInputButton } from "@/components/servicos/VoiceInputButton";

// OSCriada uses the same shape expected by openWhatsAppOS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OSCriada = any;

interface OSRapidaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "cliente" | "servico" | "sucesso";
type OSMode = "finalizar" | "registrar";

// ─── Component ──────────────────────────────────────────────────────
export function OSRapidaModal({ open, onOpenChange }: OSRapidaModalProps) {
  const isMobile = useIsMobile();
  const { createOrdem } = useOrdensServico();
  const { formasPagamento } = useFormasPagamento();
  const { veiculos } = useVeiculos();
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState<Step>("cliente");
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  const [clienteId, setClienteId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [tiposServicoSelecionados, setTiposServicoSelecionados] = useState<string[]>([]);
  const [maoDeObraPorServico, setMaoDeObraPorServico] = useState<Record<string, string>>({});
  const [isCustomServico, setIsCustomServico] = useState(false);
  const [customServico, setCustomServico] = useState("");
  const [valorServico, setValorServico] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [osCreated, setOsCreated] = useState<OSCriada | null>(null);
  const [showServicoRapido, setShowServicoRapido] = useState(false);
  const servicoRapidoJustClosedRef = useRef<number>(0);
  const isChildCloseEcho = useCallback(() => {
    if (showServicoRapido) return true;
    if (isChildModalActive()) return true;
    return Date.now() - servicoRapidoJustClosedRef.current < 500;
  }, [showServicoRapido]);
  const handleServicoRapidoOpenChange = useCallback((v: boolean) => {
    if (!v) servicoRapidoJustClosedRef.current = Date.now();
    setShowServicoRapido(v);
  }, []);
  // P1 FIX #8: Allow choosing between finalize or register
  const [osMode, setOsMode] = useState<OSMode>("finalizar");
  const [formaPagamentoId, setFormaPagamentoId] = useState("");
  const isRestoringDraftRef = useRef(false);
  const [pendingItens, setPendingItens] = useState<Array<{
    nome_item: string;
    quantidade: number;
    valor_unitario: number;
    custo_unitario: number;
    valor_mao_obra?: number;
    estoque_id?: string | null;
    tipo?: "servico" | "produto";
  }>>([]);

  // ─── AutoSave: persist form data across app switches ─────────────
  const draftData = useMemo(() => ({
    step, clienteId, veiculoId, tiposServicoSelecionados,
    maoDeObraPorServico, isCustomServico, customServico,
    valorServico, responsavelId, osMode, pendingItens, formaPagamentoId,
  }), [step, clienteId, veiculoId, tiposServicoSelecionados,
    maoDeObraPorServico, isCustomServico, customServico,
    valorServico, responsavelId, osMode, pendingItens, formaPagamentoId]);

  const { hasDraft, restore, clearDraft } = useAutoSave({
    key: `os-rapida-${oficinaAtual?.id || "global"}`,
    data: draftData,
    enabled: open && step !== "sucesso",
    interval: 1500,
  });

  // BLINDAGEM UX: nunca restaurar rascunho automaticamente.
  // Usuário decide explicitamente via DraftPromptDialog.
  const [draftPromptOpen, setDraftPromptOpen] = useState(false);
  const draftPromptShownRef = useRef(false);
  

  const applyDraft = useCallback(() => {
    isRestoringDraftRef.current = true;
    const saved = restore();
    if (saved) {
      setStep(saved.step || "cliente");
      setClienteId(saved.clienteId || "");
      setVeiculoId(saved.veiculoId || "");
      setTiposServicoSelecionados(saved.tiposServicoSelecionados || []);
      setMaoDeObraPorServico(saved.maoDeObraPorServico || {});
      setIsCustomServico(saved.isCustomServico || false);
      setCustomServico(saved.customServico || "");
      setValorServico(saved.valorServico || "");
      setResponsavelId(saved.responsavelId || "");
      setOsMode(saved.osMode || "finalizar");
      setPendingItens(saved.pendingItens || []);
      setFormaPagamentoId(saved.formaPagamentoId || "");
    }
    queueMicrotask(() => {
      isRestoringDraftRef.current = false;
    });
    setDraftPromptOpen(false);
  }, [restore]);

  useEffect(() => {
    if (open && hasDraft && !draftPromptShownRef.current) {
      draftPromptShownRef.current = true;
      setDraftPromptOpen(true);
    }
    if (!open) {
      draftPromptShownRef.current = false;
      setDraftPromptOpen(false);
      isRestoringDraftRef.current = false;
    }
  }, [open, hasDraft]);

  const resetForm = useCallback(() => {
    setStep("cliente");
    setClienteId("");
    setVeiculoId("");
    setTiposServicoSelecionados([]);
    setMaoDeObraPorServico({});
    setIsCustomServico(false);
    setCustomServico("");
    setValorServico("");
    setResponsavelId("");
    setFieldErrors({});
    isSubmittingRef.current = false;
    setShowServicoRapido(false);
    setPendingItens([]);
    setOsMode("finalizar");
    setFormaPagamentoId("");
    clearDraft();
  }, [clearDraft]);

  // Reset on close — but only clear draft if form was submitted (step === "sucesso")
  useEffect(() => {
    if (!open) {
      // CAUSA RAIZ: Sempre limpar rascunho e estado ao fechar o modal.
      // O rascunho era mantido ao fechar sem submeter, causando reabertura
      // com dados antigos e impedindo criar uma nova OS.
      resetForm();
      setOsCreated(null);
    }
  }, [open, step, resetForm]);

  // ─── Derived values ───────────────────────────────────────────────
  const pendingItensTotal = pendingItens.reduce(
    (sum, item) => sum + (item.valor_unitario * item.quantidade) + (item.valor_mao_obra || 0), 0
  );
  const pendingItensCusto = pendingItens.reduce(
    (sum, item) => sum + (item.custo_unitario || 0) * item.quantidade, 0
  );

  const selectedFormaPagamento = formasPagamento.find((f) => f.id === formaPagamentoId);
  const veiculosDoCliente = veiculos.filter((v) => v.cliente_id === clienteId);
  const veiculoSelecionado = veiculos.find((v) => v.id === veiculoId);
  const tipoVeiculo = veiculoSelecionado?.tipo || "carro";
  const tipoOficina = oficinaAtual?.tipo || "ambos";
  
  const getTiposServico = () => {
    if (tipoOficina === "auto_eletrica") return tiposServicoAutoEletrica;
    if (tipoVeiculo === "moto") return tiposServicoMoto;
    return tiposServicoCarro;
  };
  const tiposServico = getTiposServico();

  useEffect(() => {
    if (isRestoringDraftRef.current) return;
    setVeiculoId("");
  }, [clienteId]);

  // Sync total labor field from itemized service labor values
  useEffect(() => {
    const totalMaoDeObra = tiposServicoSelecionados.reduce(
      (sum, tipo) => sum + parseCurrency(maoDeObraPorServico[tipo] || ""),
      0,
    );
    const formatted = totalMaoDeObra > 0 ? totalMaoDeObra.toFixed(2) : "";
    if (valorServico !== formatted) {
      setValorServico(formatted);
    }
  }, [tiposServicoSelecionados, maoDeObraPorServico, valorServico]);

  const handleClose = useCallback(() => {
    // Track abandonment if OS was not created
    if (!osCreated && oficinaAtual?.id && step !== "cliente") {
      trackFunnelEvent({
        event: "os_creation_abandoned",
        oficina_id: oficinaAtual.id,
        step,
        metadata: { had_cliente: !!clienteId, had_veiculo: !!veiculoId },
      });
    }
    resetForm();
    setOsCreated(null);
    onOpenChange(false);
  }, [onOpenChange, osCreated, oficinaAtual?.id, step, clienteId, veiculoId, resetForm]);

  const handleNextStep = useCallback(() => {
    if (step === "cliente") {
      const errors: Record<string, string> = {};
      if (!clienteId) errors.cliente = "Selecione um cliente";
      if (!veiculoId) errors.veiculo = "Selecione um veículo";
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) return;
      setStep("servico");
    }
  }, [step, clienteId, veiculoId]);

  const handleAddPendingItem = useCallback(async (item: {
    nome_item: string;
    quantidade: number;
    valor_unitario: number;
    custo_unitario: number;
    estoque_id?: string | null;
  }) => {
    setPendingItens(prev => [...prev, item]);
    toast.success(`${item.nome_item} adicionado`);
  }, []);

  const handleRemovePendingItem = useCallback((index: number) => {
    setPendingItens(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(async (modeOverride?: OSMode) => {
    const effectiveMode = modeOverride || osMode;
    if (modeOverride) setOsMode(modeOverride);
    const servicoFinal = tiposServicoSelecionados.join(", ");
    let activeRpc: string | null = null;
    let rpcPayload: Record<string, unknown> | null = null;

    const errors: Record<string, string> = {};
    if (!clienteId) {
      errors.cliente = "Selecione um cliente";
    }
    if (!veiculoId) {
      errors.veiculo = "Selecione um veículo";
    }
    if (!servicoFinal) {
      errors.servico = "Selecione pelo menos um tipo de serviço";
    }

    const valorMaoDeObra = parseCurrency(valorServico);
    const valorTotal = valorMaoDeObra + pendingItensTotal;
    if (effectiveMode === "finalizar" && valorTotal <= 0) {
      errors.valor = "Informe a mão de obra dos serviços ou adicione produtos";
    }
    if (effectiveMode === "finalizar" && !formaPagamentoId) {
      errors.formaPagamento = "Selecione a forma de pagamento";
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      if (errors.cliente || errors.veiculo) {
        setStep("cliente");
      }
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    if (isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const isFinalizar = effectiveMode === "finalizar";
      const osStatus = isFinalizar ? "finalizado" : "em_andamento";

      // Build itemized services as items
      const servicosItemizados = tiposServicoSelecionados
        .map((tipo) => {
          const maoDeObra = parseCurrency(maoDeObraPorServico[tipo] || "");
          return {
            nome_item: tipo,
            quantidade: 1,
            valor_unitario: 0,
            custo_unitario: 0,
            valor_mao_obra: maoDeObra,
            estoque_id: null,
          };
        })
        .filter((item) => (item.valor_mao_obra || 0) > 0);

      // Merge all items into a single JSONB array
      const allItens = [
        ...servicosItemizados.map((item) => ({
          nome_item: item.nome_item,
          quantidade: 1,
          valor_unitario: 0,
          valor_mao_obra: item.valor_mao_obra,
          custo_unitario: 0,
          estoque_id: null,
        })),
        ...pendingItens.map((item) => ({
          nome_item: item.nome_item,
          quantidade: Number(item.quantidade) || 1,
          valor_unitario: Number(item.valor_unitario) || 0,
          valor_mao_obra: Number(item.valor_mao_obra) || 0,
          custo_unitario: Number(item.custo_unitario) || 0,
          estoque_id: item.estoque_id || null,
          tipo: item.tipo || (item.estoque_id ? "produto" : "servico"),
        })),
      ];

      // ATOMIC RPC: Everything in a single transaction
      activeRpc = "criar_os_completa";
      rpcPayload = {
        p_oficina_id: oficinaAtual!.id,
        p_cliente_id: clienteId,
        p_veiculo_id: veiculoId,
        p_tipo_servico: servicoFinal,
        p_responsavel_id: responsavelId && responsavelId !== "none" ? responsavelId : null,
        p_data_servico: new Date().toISOString().split("T")[0],
        p_hora_agendamento: new Date().toTimeString().slice(0, 5),
        p_status: osStatus,
        p_valor_mao_de_obra: 0,
        p_custo_servico: pendingItensCusto,
        p_itens: allItens,
        p_forma_pagamento: isFinalizar ? (selectedFormaPagamento?.nome || null) : null,
        p_forma_pagamento_id: isFinalizar ? (formaPagamentoId || null) : null,
      };

      const { data: rpcResult, error: rpcError } = await rpcWithRetry(
        "criar_os_completa",
        rpcPayload,
      );

      if (rpcError) {
        throw rpcError;
      }

      const result = rpcResult as { success: boolean; os_id: string; numero: number; valor_total: number; status: string; total_itens_inseridos: number };

      if (!result.success) {
        toast.error("Erro ao criar OS", { description: "Nenhum dado foi salvo." });
        return;
      }

      // Invalidate all relevant caches
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
      queryClient.invalidateQueries({ queryKey: ["ordens_servico_count"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-resumo"] });
      queryClient.invalidateQueries({ queryKey: ["veiculos"] });

      // Fetch client data for success screen
      const { data: clienteData } = await supabase
        .from("clientes")
        .select("id, nome, telefone")
        .eq("id", clienteId)
        .single();

      const veiculoData = veiculos.find(v => v.id === veiculoId);

      const ordemCompleta: OSCriada = {
        id: result.os_id,
        numero: result.numero,
        cliente: clienteData || { id: clienteId, nome: "Cliente", telefone: null },
        veiculo: veiculoData || { id: veiculoId, tipo: "carro", marca: "", modelo: "", placa: null },
        valor_servico: result.valor_total,
        status: result.status,
        data_servico: new Date().toISOString().split("T")[0],
        tipo_servico: servicoFinal,
      };

      setOsCreated(ordemCompleta);
      clearDraft();
      setStep("sucesso");

      toast.success(isFinalizar ? "OS criada e finalizada!" : "OS registrada com sucesso!", {
        description: isFinalizar
          ? `${result.total_itens_inseridos} item(ns) · ${formatCurrency(result.valor_total)} · Estoque e financeiro atualizados.`
          : `${result.total_itens_inseridos} item(ns) registrado(s). Complete quando o serviço terminar.`,
      });
    } catch (error: unknown) {
      const diagnostics = logDetailedError("[OSRapida] OSRapidaModal.handleSubmit", error, {
        handler: "OSRapidaModal.handleSubmit",
        rpc: activeRpc,
        payload: rpcPayload,
        clienteId,
        veiculoId,
        osMode,
      });
      import("@/lib/sentry").then(({ Sentry }) => Sentry.captureException(error, { extra: { clienteId, veiculoId, osMode, context: "OSRapidaModal.handleSubmit" } }));
      toast.error(`Erro ao criar OS: ${diagnostics.message}`);
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  }, [tiposServicoSelecionados, maoDeObraPorServico, valorServico, loading, clienteId, veiculoId, createOrdem, oficinaAtual, veiculos, queryClient, pendingItens, pendingItensTotal, pendingItensCusto, osMode, responsavelId, clearDraft, formaPagamentoId, selectedFormaPagamento]);

  const handleWhatsApp = useCallback(() => {
    if (osCreated) {
      const servicosForWhatsApp = tiposServicoSelecionados
        .map((tipo, i) => {
          const maoDeObra = parseCurrency(maoDeObraPorServico[tipo] || "");
          return {
            id: `servico-${i}`,
            ordem_servico_id: osCreated.id,
            estoque_id: null,
            nome_item: tipo,
            tipo: "servico" as const,
            quantidade: 1,
            valor_unitario: 0,
            valor_mao_obra: maoDeObra,
            valor_total: maoDeObra,
            custo_unitario: 0,
            created_at: new Date().toISOString(),
          };
        })
        .filter((item) => item.valor_total > 0);

      const itensForWhatsApp = [
        ...servicosForWhatsApp,
        ...pendingItens.map((item, i) => ({
          id: `pending-${i}`,
          ordem_servico_id: osCreated.id,
          estoque_id: item.estoque_id || null,
          nome_item: item.nome_item,
          tipo: (item.estoque_id ? "produto" : "servico") as "servico" | "produto",
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          valor_mao_obra: item.valor_mao_obra || 0,
          valor_total: (item.quantidade * item.valor_unitario) + (item.valor_mao_obra || 0),
          custo_unitario: item.custo_unitario || 0,
          created_at: new Date().toISOString(),
        })),
      ];

      openWhatsAppOS(osCreated, oficinaAtual?.nome || "Oficina", oficinaAtual?.telefone, itensForWhatsApp);
    }
  }, [osCreated, oficinaAtual, pendingItens, tiposServicoSelecionados, maoDeObraPorServico]);

  const canProceedStep1 = clienteId && veiculoId;
  const canProceedStep2 = tiposServicoSelecionados.length > 0;

  // ─── Step Indicator ─────────────────────────────────────────────
  const StepIndicator = (
    <div className="flex items-center justify-center gap-2 pb-2">
      {(["cliente", "servico", "sucesso"] as Step[]).map((s) => (
        <div
          key={s}
          className={cn(
            "h-2 rounded-full transition-all duration-300",
            step === s 
              ? "bg-accent w-6" 
              : (step === "sucesso" || (step === "servico" && s === "cliente"))
                ? "bg-success w-2"
                : "bg-muted w-2"
          )}
        />
      ))}
    </div>
  );

  // ─── Step 1: Cliente/Veículo ──────────────────────────────────────
  const StepCliente = (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="font-semibold text-lg">Quem é o cliente?</h3>
        <p className="text-sm text-muted-foreground">
          Selecione ou crie um novo cliente
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label className={fieldErrors.cliente ? "text-destructive" : ""}>Cliente *</Label>
          <div className={fieldErrors.cliente ? "ring-2 ring-destructive rounded-lg" : ""}>
            <ClienteSelectWithCreate
              value={clienteId}
              onValueChange={(v) => {
                setClienteId(v);
                setFieldErrors(prev => { const { cliente, ...rest } = prev; return rest; });
              }}
              required
            />
          </div>
          {fieldErrors.cliente && <p className="text-xs text-destructive font-medium">{fieldErrors.cliente}</p>}
        </div>

        {clienteId && (
          <div className="space-y-2">
            <Label className={fieldErrors.veiculo ? "text-destructive" : ""}>Veículo *</Label>
            <div className={fieldErrors.veiculo ? "ring-2 ring-destructive rounded-lg" : ""}>
              <VeiculoSelectWithCreate
                value={veiculoId}
                onValueChange={(v) => {
                  setVeiculoId(v);
                  setFieldErrors(prev => { const { veiculo, ...rest } = prev; return rest; });
                }}
                clienteId={clienteId}
                veiculosDoCliente={veiculosDoCliente}
                required
              />
            </div>
            {fieldErrors.veiculo && <p className="text-xs text-destructive font-medium">{fieldErrors.veiculo}</p>}
          </div>
        )}
      </div>

      <Button
        onClick={handleNextStep}
        disabled={!canProceedStep1}
        className="w-full h-12 bg-accent hover:bg-accent/90 font-semibold text-base"
      >
        Próximo
        <ChevronRight className="w-5 h-5 ml-2" />
      </Button>
    </div>
  );

  // ─── Step 2: Serviço ──────────────────────────────────────────────
  const valorMaoDeObra = parseCurrency(valorServico);
  const valorTotalGeral = valorMaoDeObra + pendingItensTotal;

  const StepServico = (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="font-semibold text-lg">Qual o serviço?</h3>
        <p className="text-sm text-muted-foreground">
          Selecione o tipo e adicione produtos se necessário
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className={fieldErrors.servico ? "text-destructive" : ""}>Tipo de Serviço *</Label>
            {tiposServicoSelecionados.length > 0 && (
              <span className="text-xs font-medium text-muted-foreground">
                {tiposServicoSelecionados.length} adicionado(s)
              </span>
            )}
          </div>

          {!isCustomServico ? (
            <Select
              value=""
              onValueChange={(val) => {
                setFieldErrors((prev) => {
                  const { servico, ...rest } = prev;
                  return rest;
                });

                if (val === "__outro__") {
                  setIsCustomServico(true);
                  return;
                }

                if (!tiposServicoSelecionados.includes(val)) {
                  setTiposServicoSelecionados((prev) => [...prev, val]);
                }
              }}
            >
              <SelectTrigger className={cn("h-12 text-base", fieldErrors.servico && "ring-2 ring-destructive")}>
                <SelectValue
                  placeholder={
                    tiposServicoSelecionados.length > 0
                      ? "Adicionar outro serviço..."
                      : "Selecione o tipo"
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-[50vh] z-[9999] bg-background" position="popper" sideOffset={4}>
                {tiposServico.map((tipo) => (
                  <SelectItem key={tipo} value={tipo} disabled={tiposServicoSelecionados.includes(tipo)}>
                    {tipo}
                  </SelectItem>
                ))}
                <SelectItem value="__outro__">+ Outro serviço...</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Descreva o serviço realizado..."
                  value={customServico}
                  onChange={(e) => {
                    setCustomServico(e.target.value);
                    setFieldErrors((prev) => {
                      const { servico, ...rest } = prev;
                      return rest;
                    });
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const novoServico = customServico.trim();
                    if (!novoServico) return;
                    if (!tiposServicoSelecionados.includes(novoServico)) {
                      setTiposServicoSelecionados((prev) => [...prev, novoServico]);
                    }
                    setCustomServico("");
                    setIsCustomServico(false);
                  }}
                  className={cn("h-12 flex-1 text-base", fieldErrors.servico && "ring-2 ring-destructive")}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-12 px-3 shrink-0"
                  disabled={!customServico.trim()}
                  onClick={(e) => {
                    e.preventDefault();
                    const novoServico = customServico.trim();
                    if (!novoServico) return;
                    if (!tiposServicoSelecionados.includes(novoServico)) {
                      setTiposServicoSelecionados((prev) => [...prev, novoServico]);
                    }
                    setCustomServico("");
                    setIsCustomServico(false);
                  }}
                >
                  Adicionar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-12 px-3 shrink-0 text-base"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsCustomServico(false);
                    setCustomServico("");
                  }}
                >
                  Voltar
                </Button>
              </div>

              {/* TESTE (conta admin apenas) — ditado por voz nativo do navegador.
                  Preenche o mesmo estado do input acima. Sem IA, sem custo.
                  O próprio componente se esconde para outros usuários e onde
                  o navegador não suporta. */}
              <VoiceInputButton
                onTranscript={(texto) => {
                  if (!texto) return;
                  setCustomServico(texto);
                  setFieldErrors((prev) => {
                    const { servico, ...rest } = prev;
                    return rest;
                  });
                }}
              />
            </div>
          )}

          {tiposServicoSelecionados.length > 0 && (
            <div className="space-y-2 pt-1">
              {tiposServicoSelecionados.map((tipo) => (
                <div key={tipo} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{tipo}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Label className="text-[11px] text-muted-foreground">M.O.</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={maoDeObraPorServico[tipo] || ""}
                      onChange={(e) => {
                        setMaoDeObraPorServico((prev) => ({ ...prev, [tipo]: e.target.value }));
                        setFieldErrors((prev) => {
                          const { valor, ...rest } = prev;
                          return rest;
                        });
                      }}
                      className="h-9 w-24 text-base font-medium"
                    />
                    <button
                      type="button"
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setTiposServicoSelecionados((prev) => prev.filter((t) => t !== tipo));
                        setMaoDeObraPorServico((prev) => {
                          const next = { ...prev };
                          delete next[tipo];
                          return next;
                        });
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Você pode adicionar mais de um tipo de serviço na mesma OS.</p>
          {fieldErrors.servico && <p className="text-xs text-destructive font-medium">{fieldErrors.servico}</p>}
        </div>

        <div className="space-y-2">
          <Label className={cn("font-semibold", fieldErrors.valor ? "text-destructive" : "text-foreground")}>
            💰 Mão de Obra Total (R$)
          </Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={valorServico}
              readOnly
              className={cn(
                "pl-10 h-14 text-lg font-bold border-2 bg-muted/30",
                fieldErrors.valor ? "border-destructive ring-2 ring-destructive" : "border-border"
              )}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Total calculado automaticamente pela soma da mão de obra de cada serviço acima.
          </p>
          {fieldErrors.valor && <p className="text-xs text-destructive font-medium">{fieldErrors.valor}</p>}
        </div>

        {/* ── Peças e Produtos ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5">
              <Package className="w-4 h-4 text-primary" />
               Peças e Serviços
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => setShowServicoRapido(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </Button>
          </div>

          {pendingItens.length > 0 ? (
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
              {pendingItens.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50 border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.nome_item}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantidade}x {formatCurrency(item.valor_unitario)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold">
                      {formatCurrency((item.quantidade * item.valor_unitario) + (item.valor_mao_obra || 0))}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleRemovePendingItem(idx)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              Nenhum produto adicionado (opcional)
            </p>
          )}
        </div>
      </div>

      {/* ── Resumo Total ── */}
      {valorTotalGeral > 0 && (
        <div className="p-3 rounded-lg bg-accent/10 border border-accent/30">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total:</span>
            <span className="text-lg font-bold text-accent">
              {formatCurrency(valorTotalGeral)}
            </span>
          </div>
          {pendingItens.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1 flex justify-between">
              <span>Serviços: {formatCurrency(valorMaoDeObra)}</span>
              <span>Peças/itens: {formatCurrency(pendingItensTotal)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Responsável (opcional) ── */}
      <ResponsavelSelect
        value={responsavelId}
        onValueChange={setResponsavelId}
        label="Mecânico Responsável"
        placeholder="Opcional — para comissão"
      />

      {/* Forma de Pagamento — obrigatória para Finalizar, opcional para Registrar */}
      <div className="space-y-2">
          <Label className={cn("text-sm font-semibold", fieldErrors.formaPagamento && "text-destructive")}>
            💳 Forma de Pagamento
          </Label>
          <Select value={formaPagamentoId} onValueChange={(v) => {
            setFormaPagamentoId(v);
            setFieldErrors((prev) => { const { formaPagamento, ...rest } = prev; return rest; });
          }}>
            <SelectTrigger className={cn("h-12 text-base", fieldErrors.formaPagamento && "ring-2 ring-destructive")}>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent className="z-[9999] bg-background" position="popper" sideOffset={4}>
              {formasPagamento.map((fp) => (
                <SelectItem key={fp.id} value={fp.id} className="py-3">
                  {fp.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.formaPagamento && <p className="text-xs text-destructive font-medium">{fieldErrors.formaPagamento}</p>}
        </div>

      <div className="sticky bottom-0 bg-background border-t border-border/60 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setStep("cliente")}
            className="h-12 text-base px-4"
          >
            Voltar
          </Button>
          <Button
            onClick={() => handleSubmit("finalizar")}
            disabled={!canProceedStep2 || loading}
            className="flex-1 h-12 font-semibold text-base bg-accent hover:bg-accent/90"
          >
            {loading && osMode === "finalizar" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Check className="w-5 h-5 mr-2" />
                Finalizar
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSubmit("registrar")}
            disabled={!canProceedStep2 || loading}
            className="flex-1 h-12 font-semibold text-base"
          >
            {loading && osMode === "registrar" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <PlayCircle className="w-5 h-5 mr-2" />
                Registrar p/ depois
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  // ─── Step 3: Sucesso ──────────────────────────────────────────────
  const StepSucesso = (
    <div className="space-y-4 text-center">
      <div className={cn(
        "w-20 h-20 mx-auto rounded-full flex items-center justify-center",
        osMode === "finalizar" ? "bg-success/10" : "bg-primary/10"
      )}>
        {osMode === "finalizar" 
          ? <Check className="w-10 h-10 text-success" />
          : <PlayCircle className="w-10 h-10 text-primary" />
        }
      </div>

      <div>
        <h3 className={cn("font-bold text-xl", osMode === "finalizar" ? "text-success" : "text-primary")}>
          {osMode === "finalizar" ? "OS Finalizada!" : "OS Registrada!"}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {osMode === "finalizar" ? "Serviço registrado com sucesso" : "Complete a OS quando o serviço terminar"}
        </p>
      </div>

      {valorTotalGeral > 0 && (
        <div className="p-4 bg-accent/5 rounded-lg">
          <p className="text-sm text-muted-foreground">Valor Total</p>
          <p className="text-2xl font-bold text-accent">
            {formatCurrency(valorTotalGeral)}
          </p>
        </div>
      )}

      <div className="space-y-2 pt-2">
        <Button
          onClick={handleWhatsApp}
          className="w-full h-12 bg-success hover:bg-success/90 text-success-foreground font-semibold text-base"
        >
          <MessageCircle className="w-5 h-5 mr-2" />
          Enviar por WhatsApp
        </Button>
        <Button
          variant="outline"
          onClick={handleClose}
          className="w-full h-12 text-base"
        >
          Concluir
        </Button>
      </div>
    </div>
  );

  // ─── Header ───────────────────────────────────────────────────────
  const HeaderContent = (
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
        <Zap className="w-5 h-5 text-accent" />
      </div>
      <span>OS Rápida</span>
    </div>
  );

  // ─── Content ──────────────────────────────────────────────────────
  const ModalContent = (
    <div className="space-y-4">
      {StepIndicator}
      {step === "cliente" && StepCliente}
      {step === "servico" && StepServico}
      {step === "sucesso" && StepSucesso}
    </div>
  );

  const servicoRapidoRender = (
    <ServicoRapidoModal
      open={showServicoRapido}
      onOpenChange={handleServicoRapidoOpenChange}
      onAddItem={handleAddPendingItem}
    />
  );

  // ─── Render ───────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={(isOpen) => {
          if (!isOpen && isChildCloseEcho()) return;
          onOpenChange(isOpen);
        }}>
          <DrawerContent className="px-4 pb-6 max-h-[92dvh]">
            <DrawerHeader className="text-left px-0 shrink-0">
              <DrawerTitle className="flex items-center gap-2">
                {HeaderContent}
              </DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto flex-1 min-h-0 overscroll-contain touch-pan-y" style={{ WebkitOverflowScrolling: "touch" }}>
              {ModalContent}
            </div>
          </DrawerContent>
        </Drawer>
        {servicoRapidoRender}
        <DraftPromptDialog
          open={draftPromptOpen}
          label="OS rápida"
          savedAt={null}
          onResume={applyDraft}
          onDiscard={() => { clearDraft(); setDraftPromptOpen(false); }}
        />
      </>
    );
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen && isChildCloseEcho()) return;
          onOpenChange(isOpen);
        }}
        modal={!showServicoRapido}
      >
        <DialogContent
          className="sm:max-w-md max-h-[90vh] flex flex-col"
          onInteractOutside={(e) => { if (isChildCloseEcho()) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (isChildCloseEcho()) e.preventDefault(); }}
          onPointerDownOutside={(e) => { if (isChildCloseEcho()) e.preventDefault(); }}
          onFocusOutside={(e) => { if (isChildCloseEcho()) e.preventDefault(); }}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {HeaderContent}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0">
            {ModalContent}
          </div>
        </DialogContent>
      </Dialog>
      {servicoRapidoRender}
      <DraftPromptDialog
        open={draftPromptOpen}
        label="OS rápida"
        savedAt={null}
        onResume={applyDraft}
        onDiscard={() => { clearDraft(); setDraftPromptOpen(false); }}
      />
    </>
  );
}
