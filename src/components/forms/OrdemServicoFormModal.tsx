import { useState, useEffect, useRef, useCallback, useReducer } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useOrdensServico, OrdemServico, OrdemServicoInput, StatusOS } from "@/hooks/useOrdensServico";
import { useVeiculos } from "@/hooks/useVeiculos";
import { useOficina } from "@/contexts/OficinaContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFormasPagamento } from "@/hooks/useFormasPagamento";
import { supabase } from "@/integrations/supabase/client";
import { createEmptyElectricDVIData, ElectricDVIData } from "./ElectricDVIWizard";
import { ConclusaoSection } from "@/components/servicos/ConclusaoSection";
import { ItensOSList } from "@/components/servicos/ItensOSList";
import { OSResumoValores } from "@/components/servicos/OSResumoValores";
import { OSDescontoSection } from "@/components/servicos/OSDescontoSection";
import { parseCurrency } from "@/lib/formatters";
import { OSPagamentoParcial } from "@/components/servicos/OSPagamentoParcial";
import { OSSinalInicialBlock, emptySinalInicial, type SinalInicial } from "@/components/servicos/OSSinalInicialBlock";
import { OSFinalizadaModal } from "@/components/servicos/OSFinalizadaModal";
import { ResumoFiscalModal } from "@/components/servicos/ResumoFiscalModal";
import { ServicoRapidoModal } from "@/components/servicos/ServicoRapidoModal";
import { ParcelasManager } from "@/components/financeiro/ParcelasManager";
import { useAutoSave } from "@/hooks/useAutoSave";
import { logBusinessEvent, logDetailedError } from "@/lib/errorHandling";
import { SavingIndicator } from "@/components/ui/saving-indicator";
import { handleFormKeyDown } from "@/lib/formGuard";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Wrench, MessageCircle, Link2, Receipt, Eye } from "lucide-react";
import { openWhatsAppOS } from "@/lib/whatsapp";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/formatters";

// Sub-components
import { OSFormClienteSection } from "./os/OSFormClienteSection";
import { OSFormServicoSection } from "./os/OSFormServicoSection";
import { OSFormValoresSection } from "./os/OSFormValoresSection";
import { OSFormVistoriaSection } from "./os/OSFormVistoriaSection";
import { OSFormPendingItens, PendingItem } from "./os/OSFormPendingItens";
import { tiposServicoCarro, tiposServicoMoto, tiposServicoAutoEletrica } from "./os/OSFormConstants";

// ═══════════════════════════════════════════════════════════════
// CONSOLIDATED FORM STATE
// Replaces ~34 individual useState calls with a single useReducer.
// This eliminates the cascade of setState calls during modal opening
// that caused the React 18 "removeChild" DOM reconciliation crash.
// ═══════════════════════════════════════════════════════════════

interface OSFormState {
  clienteId: string;
  veiculoId: string;
  responsavelId: string;
  dataServico: string;
  horaAgendamento: string;
  tiposServicoSelecionados: string[];
  isCustomTipoServico: boolean;
  customTipoServico: string;
  maoDeObraPorServico: Record<string, string>;
  descricao: string;
  kmNoServico: string;
  status: StatusOS;
  valorServico: string;
  custoServico: string;
  temGarantia: boolean;
  diasGarantia: string;
  formaPagamento: string;
  numeroParcelas: number;
  observacoes: string;
  checklistCombustivel: string;
  checklistRiscos: boolean;
  checklistEstepe: boolean;
  checklistSom: boolean;
  checklistLuzes: boolean;
  fotosEntrada: string[];
  assinaturaClienteUrl: string | null;
  fotosSaida: string[];
  observacoesConclusao: string;
  electricDVIData: ElectricDVIData;
  electricDVIOpen: boolean;
  showChecklist: boolean;
  showFotos: boolean;
  showAssinatura: boolean;
  pendingItens: PendingItem[];
  servicoRapidoOpen: boolean;
  descontoValor: string;
  descontoMotivo: string;
}

type OSFormAction =
  | { type: "SET_ALL"; payload: OSFormState }
  | { type: "PATCH"; payload: Partial<OSFormState> }
  | { type: "PATCH_FN"; updater: (prev: OSFormState) => Partial<OSFormState> };

function osFormReducer(state: OSFormState, action: OSFormAction): OSFormState {
  switch (action.type) {
    case "SET_ALL":
      return action.payload;
    case "PATCH":
      return { ...state, ...action.payload };
    case "PATCH_FN":
      return { ...state, ...action.updater(state) };
    default:
      return state;
  }
}

function createDefaultState(opts?: { initialDate?: string; initialClienteId?: string; initialVeiculoId?: string }): OSFormState {
  return {
    clienteId: opts?.initialClienteId || "",
    veiculoId: opts?.initialVeiculoId || "",
    responsavelId: "",
    dataServico: opts?.initialDate || new Date().toISOString().split("T")[0],
    horaAgendamento: "",
    tiposServicoSelecionados: [],
    isCustomTipoServico: false,
    customTipoServico: "",
    maoDeObraPorServico: {},
    descricao: "",
    kmNoServico: "",
    status: "pendente",
    valorServico: "",
    custoServico: "",
    temGarantia: false,
    diasGarantia: "90",
    formaPagamento: "",
    numeroParcelas: 1,
    observacoes: "",
    checklistCombustivel: "",
    checklistRiscos: false,
    checklistEstepe: false,
    checklistSom: false,
    checklistLuzes: false,
    fotosEntrada: [],
    assinaturaClienteUrl: null,
    fotosSaida: [],
    observacoesConclusao: "",
    electricDVIData: createEmptyElectricDVIData(),
    electricDVIOpen: false,
    showChecklist: false,
    showFotos: false,
    showAssinatura: false,
    pendingItens: [],
    servicoRapidoOpen: false,
    descontoValor: "",
    descontoMotivo: "",
  };
}

function buildStateFromOrdem(ordemData: OrdemServico): OSFormState {
  const ordemAny = ordemData as any;
  const savedTipos = ordemData.tipo_servico.split(", ").map((t) => t.trim()).filter(Boolean);
  const maoDeObraSalva = Number(ordemAny.valor_mao_obra ?? 0);
  return {
    clienteId: ordemData.cliente_id,
    veiculoId: ordemData.veiculo_id,
    responsavelId: ordemData.responsavel_id || "",
    dataServico: ordemData.data_servico,
    horaAgendamento: ordemData.hora_agendamento || "",
    tiposServicoSelecionados: savedTipos.filter((t) => t !== "Outro"),
    isCustomTipoServico: false,
    customTipoServico: "",
    maoDeObraPorServico: {},
    descricao: ordemData.descricao || "",
    kmNoServico: ordemData.km_no_servico?.toString() || "",
    status: ordemData.status,
    // CAUSA RAIZ: campo "Mão de Obra" carrega SOMENTE valor_mao_obra.
    // Nunca usar valor_servico como fallback aqui, pois valor_servico é o Total Mestre
    // (mão de obra + peças) e isso faz o total virar mão de obra/lucro na edição.
    valorServico: maoDeObraSalva.toString(),
    custoServico: ordemData.custo_servico?.toString() || "",
    temGarantia: ordemData.tem_garantia,
    diasGarantia: ordemData.dias_garantia?.toString() || "90",
    formaPagamento: ordemData.forma_pagamento || "",
    numeroParcelas: 1,
    observacoes: ordemData.observacoes || "",
    checklistCombustivel: ordemAny.checklist_combustivel || "",
    checklistRiscos: ordemAny.checklist_riscos || false,
    checklistEstepe: ordemAny.checklist_estepe || false,
    checklistSom: ordemAny.checklist_som || false,
    checklistLuzes: ordemAny.checklist_luzes || false,
    fotosEntrada: ordemAny.fotos_entrada || [],
    assinaturaClienteUrl: ordemAny.assinatura_cliente_url || null,
    fotosSaida: ordemAny.fotos_saida || [],
    observacoesConclusao: ordemAny.observacoes_conclusao || "",
    electricDVIData: {
      voltagemBateria: ordemAny.checklist_voltagem_bateria || "",
      cargaBateria: ordemAny.checklist_carga_bateria || "",
      bateriaStatus: "",
      alternadorOk: ordemAny.checklist_alternador_ok || false,
      alternadorVoltagem: "",
      alternadorStatus: "",
      motorPartidaOk: ordemAny.checklist_motor_partida_ok || false,
      motorPartidaAmperagem: "",
      motorPartidaStatus: "",
      fusiveisOk: ordemAny.checklist_fusiveis_ok || false,
      relesOk: false,
      iluminacaoOk: ordemAny.checklist_luzes || false,
      codigosObd: ordemAny.codigos_obd_lista || [],
      modulosTestados: ordemAny.modulos_testados || [],
      hipoteseDiagnostico: ordemAny.hipotese_diagnostico || "",
      tempoDiagnosticoMinutos: ordemAny.tempo_diagnostico_minutos || 0,
      fotos: ordemAny.fotos_entrada || [],
    },
    electricDVIOpen: false,
    showChecklist: false,
    showFotos: false,
    showAssinatura: false,
    pendingItens: [],
    servicoRapidoOpen: false,
    descontoValor: Number(ordemAny.desconto ?? 0) > 0 ? Number(ordemAny.desconto).toFixed(2) : "",
    descontoMotivo: ordemAny.desconto_motivo || "",
  };
}

function buildStateFromDraft(draft: Partial<OSFormState>, initialDate?: string): OSFormState {
  const defaults = createDefaultState({ initialDate });
  return {
    ...defaults,
    ...draft,
    // Ensure critical fields have fallbacks
    clienteId: draft.clienteId || "",
    veiculoId: draft.veiculoId || "",
    dataServico: draft.dataServico || initialDate || new Date().toISOString().split("T")[0],
    status: draft.status || "pendente",
    electricDVIData: draft.electricDVIData || createEmptyElectricDVIData(),
    fotosEntrada: draft.fotosEntrada || [],
    fotosSaida: draft.fotosSaida || [],
    pendingItens: draft.pendingItens || [],
    tiposServicoSelecionados: draft.tiposServicoSelecionados || [],
    maoDeObraPorServico: draft.maoDeObraPorServico || {},
  };
}

// ═══════════════════════════════════════════════════════════════

interface OrdemServicoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordem?: OrdemServico | null;
  initialDate?: string;
  initialClienteId?: string;
  initialVeiculoId?: string;
}

export function OrdemServicoFormModal({ open, onOpenChange, ordem, initialDate, initialClienteId, initialVeiculoId }: OrdemServicoFormModalProps) {
  const { createOrdem, updateOrdem } = useOrdensServico();
  const { veiculos } = useVeiculos();
  const { oficinaAtual } = useOficina();
  const isMobile = useIsMobile();
  const { formasPagamento: formasPagamentoDB } = useFormasPagamento();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [sinalInicial, setSinalInicial] = useState<SinalInicial>(emptySinalInicial);
  const [servicoRapidoInitialView, setServicoRapidoInitialView] = useState<"menu" | "livre" | "estoque" | "catalogo">("menu");
  const [editingPendingItem, setEditingPendingItem] = useState<PendingItem | null>(null);

  const openServicoRapido = useCallback((view: "menu" | "livre" | "estoque" | "catalogo" = "menu") => {
    setEditingPendingItem(null);
    setServicoRapidoInitialView(view);
    dispatch({ type: "PATCH", payload: { servicoRapidoOpen: true } });
  }, []);

  const openEditPendingItem = useCallback((item: PendingItem) => {
    setEditingPendingItem(item);
    setServicoRapidoInitialView("livre");
    dispatch({ type: "PATCH", payload: { servicoRapidoOpen: true } });
  }, []);

  const updatePendingItem = useCallback((id: string, patch: {
    nome_item: string;
    quantidade: number;
    valor_unitario: number;
    custo_unitario: number;
    valor_mao_obra: number;
    tipo: "servico" | "produto";
  }) => {
    dispatch({
      type: "PATCH_FN",
      updater: (prev) => ({
        pendingItens: prev.pendingItens.map((it) => it.id === id ? { ...it, ...patch } : it),
      }),
    });
    setEditingPendingItem(null);
  }, []);

  const isSubmittingRef = useRef(false);
  const lastSubmitRef = useRef<number>(0);

  // ═══════════════════════════════════════════════════════════════
  // SINGLE REDUCER: All form fields in one state object.
  // applyOrdemData / applyDraft / resetNewFormState each produce
  // exactly ONE dispatch instead of ~34 individual setState calls.
  // ═══════════════════════════════════════════════════════════════
  // CAUSA RAIZ FIX: Inicializar o reducer diretamente com dados da ordem
  // quando ela existe. Isso elimina o render intermediário (estado vazio → dados)
  // que causava conflito de reconciliação DOM nos portais aninhados (removeChild).
  const [f, dispatch] = useReducer(
    osFormReducer,
    { initialDate, initialClienteId, initialVeiculoId, ordem },
    (opts) => opts.ordem ? buildStateFromOrdem(opts.ordem) : createDefaultState(opts),
  );

  // Convenience setter for individual field updates from child components
  const patchField = useCallback(<K extends keyof OSFormState>(key: K, value: OSFormState[K]) => {
    dispatch({ type: "PATCH", payload: { [key]: value } as Partial<OSFormState> });
  }, []);

  // Setters that accept functional updaters (React.Dispatch<SetStateAction<T>>)
  const setTiposServicoSelecionados: React.Dispatch<React.SetStateAction<string[]>> = useCallback((v) => {
    if (typeof v === "function") {
      dispatch({ type: "PATCH_FN", updater: (prev) => ({ tiposServicoSelecionados: v(prev.tiposServicoSelecionados) }) });
    } else {
      patchField("tiposServicoSelecionados", v);
    }
  }, [patchField]);

  const setPendingItens: React.Dispatch<React.SetStateAction<PendingItem[]>> = useCallback((v) => {
    if (typeof v === "function") {
      dispatch({ type: "PATCH_FN", updater: (prev) => ({ pendingItens: v(prev.pendingItens) }) });
    } else {
      patchField("pendingItens", v);
    }
  }, [patchField]);

  // Derived values (no state needed)
  // Categoria interna: não aparece mais no fluxo da oficina.
  // A OS sempre recebe um rótulo técnico padrão para manter compatibilidade com relatórios/RPC.
  const tipoServicoEfetivo = f.tiposServicoSelecionados.length > 0
    ? f.tiposServicoSelecionados.join(", ")
    : "Serviço geral";
  const tipoServico = tipoServicoEfetivo;
  const pendingItensPecas = f.pendingItens.reduce((acc, item) => acc + (item.valor_unitario * item.quantidade), 0);
  const pendingItensMaoObra = f.pendingItens.reduce((acc, item) => acc + (item.valor_mao_obra || 0), 0);
  const pendingItensTotal = pendingItensPecas + pendingItensMaoObra;
  const pendingItensCusto = f.pendingItens.reduce((acc, item) => acc + ((item.custo_unitario || 0) * item.quantidade), 0);
  const pendingItensSemCustoCount = f.pendingItens.filter((item) => item.estoque_id && (item.custo_unitario || 0) <= 0).length;

  const isEditing = !!ordem;
  const draftRestoreAttemptedRef = useRef(false);
  const osDraftKey = `os-form-${oficinaAtual?.id || "new"}-${ordem?.id || "new"}`;

  // formData object for autoSave (reads from reducer state)
  const formData = f;

  const applyDraft = useCallback((draft: typeof formData) => {
    dispatch({ type: "SET_ALL", payload: buildStateFromDraft(draft, initialDate) });
  }, [initialDate]);

  const { hasDraft, clearDraft, lastSaved, restore, isSaving } = useAutoSave({
    key: osDraftKey,
    data: formData,
    enabled: open && !isEditing,
    interval: 3000,
    onRestore: applyDraft,
  });

  const veiculosDoCliente = veiculos.filter((v) => v.cliente_id === f.clienteId);
  const veiculoSelecionado = veiculos.find((v) => v.id === f.veiculoId);
  const tipoVeiculo = veiculoSelecionado?.tipo || "carro";
  const tipoOficina = oficinaAtual?.tipo || "ambos";

  const getTiposServico = () => {
    if (tipoOficina === "auto_eletrica") return tiposServicoAutoEletrica;
    if (tipoVeiculo === "moto") return tiposServicoMoto;
    return tiposServicoCarro;
  };
  const tiposServico = getTiposServico();
  const isAutoEletrica = tipoOficina === "auto_eletrica";

  // INITIALIZATION: Handles open/close transitions and draft restore.
  // NOTE: Initial edit data is loaded by the reducer initializer (no dispatch needed on first mount).
  const initialOrdemRef = useRef(ordem?.id);
  
  useEffect(() => {
    if (!open) {
      draftRestoreAttemptedRef.current = false;
      if (!isEditing) {
        clearDraft();
      }
      return;
    }

    if (!isEditing && !draftRestoreAttemptedRef.current) {
      draftRestoreAttemptedRef.current = true;
      if (restore()) {
        return;
      }
    }

    // Se a ordem mudou após o mount inicial (raro), atualizar
    if (ordem && ordem.id !== initialOrdemRef.current) {
      initialOrdemRef.current = ordem.id;
      dispatch({ type: "SET_ALL", payload: buildStateFromOrdem(ordem) });
      return;
    }

    // Se é o mount inicial com ordem, o initializer já cuidou — não dispatch novamente
    if (ordem && ordem.id === initialOrdemRef.current) {
      return;
    }

    // Nova OS
    dispatch({ type: "SET_ALL", payload: createDefaultState({ initialDate, initialClienteId, initialVeiculoId }) });
  }, [open, ordem, initialDate, initialClienteId, initialVeiculoId, restore, clearDraft, isEditing]);

  // Reset vehicle when client changes (new OS only)
  useEffect(() => {
    if (!isEditing) patchField("veiculoId", "");
  }, [f.clienteId, isEditing, patchField]);

  // Auto-calculate valorServico from per-service M.O. (new OS only)
  useEffect(() => {
    if (isEditing) return;
    const totalPerService = Object.values(f.maoDeObraPorServico).reduce(
      (sum, val) => sum + (parseFloat(val) || 0), 0
    );
    if (totalPerService > 0) {
      patchField("valorServico", totalPerService.toFixed(2));
    }
  }, [f.maoDeObraPorServico, isEditing, patchField]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let activeRpc: string | null = null;
    let rpcPayload: Record<string, unknown> | null = null;

    const now = Date.now();
    if (isSubmittingRef.current || now - lastSubmitRef.current < 1000) return;

    // Validate finalization
    if (f.status === "finalizado") {
      const valorMaoDeObra = parseFloat(f.valorServico) || 0;
      let totalItensOS = 0;
      if (isEditing && ordem) {
        const { data: itensOS } = await supabase.from("itens_os").select("valor_total, quantidade, valor_unitario").eq("ordem_servico_id", ordem.id);
        totalItensOS = (itensOS || []).reduce((acc, item) => acc + (item.valor_total ?? ((item.quantidade || 0) * (item.valor_unitario || 0))), 0);
      } else {
        totalItensOS = pendingItensTotal;
      }
      if (valorMaoDeObra + totalItensOS <= 0) {
        toast.error("⚠️ Preencha o valor do serviço ou adicione itens", { description: "A OS precisa ter pelo menos um valor para ser finalizada.", duration: 6000 });
        return;
      }
      if (!f.formaPagamento) {
        toast.error("⚠️ Selecione a forma de pagamento", { description: "Informe como o cliente vai pagar antes de finalizar.", duration: 6000 });
        return;
      }
    }

    isSubmittingRef.current = true;
    lastSubmitRef.current = now;
    setLoading(true);

    const data: OrdemServicoInput = {
      cliente_id: f.clienteId,
      veiculo_id: f.veiculoId,
      responsavel_id: f.responsavelId && f.responsavelId !== "none" ? f.responsavelId : undefined,
      data_servico: f.dataServico,
      hora_agendamento: f.horaAgendamento || undefined,
      tipo_servico: tipoServico,
      descricao: f.descricao || undefined,
      km_no_servico: f.kmNoServico ? parseInt(f.kmNoServico) : undefined,
      status: f.status,
      // valor_servico é calculado pelo banco como Total Mestre; frontend envia só mão de obra.
      valor_mao_obra: f.valorServico ? parseFloat(f.valorServico) : 0,
      custo_servico: f.custoServico ? parseFloat(f.custoServico) : undefined,
      tem_garantia: f.temGarantia,
      dias_garantia: f.temGarantia ? parseInt(f.diasGarantia) : 0,
      forma_pagamento: f.formaPagamento || undefined,
      observacoes: f.observacoes || undefined,
      checklist_combustivel: f.checklistCombustivel || undefined,
      checklist_riscos: f.checklistRiscos,
      checklist_estepe: f.checklistEstepe,
      checklist_som: f.checklistSom,
      checklist_luzes: f.checklistLuzes,
      fotos_entrada: f.fotosEntrada,
      fotos_saida: f.fotosSaida,
      observacoes_conclusao: f.observacoesConclusao || undefined,
      assinatura_cliente_url: f.assinaturaClienteUrl || undefined,
      data_conclusao: f.status === "finalizado" ? format(new Date(), "yyyy-MM-dd") : undefined,
      checklist_voltagem_bateria: f.electricDVIData.voltagemBateria || undefined,
      checklist_carga_bateria: f.electricDVIData.cargaBateria || undefined,
      checklist_alternador_ok: f.electricDVIData.alternadorOk,
      checklist_motor_partida_ok: f.electricDVIData.motorPartidaOk,
      checklist_fusiveis_ok: f.electricDVIData.fusiveisOk,
      codigo_obd: f.electricDVIData.codigosObd[0] || undefined,
      codigos_obd_lista: f.electricDVIData.codigosObd.length > 0 ? f.electricDVIData.codigosObd : undefined,
      hipotese_diagnostico: f.electricDVIData.hipoteseDiagnostico || undefined,
      modulos_testados: f.electricDVIData.modulosTestados.length > 0 ? f.electricDVIData.modulosTestados : undefined,
      tempo_diagnostico_minutos: f.electricDVIData.tempoDiagnosticoMinutos || undefined,
    };

    try {
      if (isEditing && ordem) {
        const isFinalizing = f.status === "finalizado" && ordem.status !== "finalizado";

        if (isFinalizing) {
          const dataWithoutFinalizado = { ...data, status: ordem.status as StatusOS };
          await updateOrdem.mutateAsync({ id: ordem.id, ...dataWithoutFinalizado });

          const formaPagamentoId = f.formaPagamento ? formasPagamentoDB.find((fp) => fp.nome === f.formaPagamento)?.id || null : null;

          activeRpc = "finalizar_os_atomica";
          rpcPayload = {
            p_os_id: ordem.id,
            p_forma_pagamento: f.formaPagamento || null,
            p_forma_pagamento_id: formaPagamentoId,
            p_numero_parcelas: f.numeroParcelas,
            p_fotos_saida: f.fotosSaida.length > 0 ? f.fotosSaida : null,
            p_observacoes_conclusao: f.observacoesConclusao || null,
          };

          const { data: rpcResult, error: rpcError } = await supabase.rpc(
            "finalizar_os_atomica" as any,
            rpcPayload,
          );

          if (rpcError) throw rpcError;

          const result = rpcResult as { success: boolean; os_id: string; valor_total: number; status: string };
          if (!result.success) throw new Error("Falha ao finalizar OS. Nenhuma alteração financeira foi salva.");

          clearDraft();
          logBusinessEvent("os_finalizada_atomica", { osId: ordem.id });

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["ordens_servico"] }),
            queryClient.invalidateQueries({ queryKey: ["ordens_servico_count"] }),
            queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
            queryClient.invalidateQueries({ queryKey: ["financeiro-resumo"] }),
            queryClient.invalidateQueries({ queryKey: ["estoque"] }),
            queryClient.invalidateQueries({ queryKey: ["parcelas"] }),
          ]);

          setSavedOrdem({ ...ordem, ...data, status: "finalizado", valor_servico: result.valor_total } as OrdemServico);
          onOpenChange(false);
          setTimeout(() => setOsFinalizadaOpen(true), 300);
          toast.success("OS finalizada!", { description: "Status, financeiro e estoque atualizados atomicamente." });
        } else {
          await updateOrdem.mutateAsync({ id: ordem.id, ...data });
          // Desconto: persistido em separado (trigger de auditoria captura quem aplicou)
          const descNum = parseCurrency(f.descontoValor);
          const descAtual = Number((ordem as any).desconto ?? 0);
          const motivoAtual = (ordem as any).desconto_motivo || "";
          if (descNum !== descAtual || (f.descontoMotivo || "") !== motivoAtual) {
            const { error: dErr } = await supabase
              .from("ordens_servico")
              .update({ desconto: descNum, desconto_motivo: f.descontoMotivo || null })
              .eq("id", ordem.id);
            if (dErr) {
              toast.error("Erro ao aplicar desconto", { description: dErr.message });
            }
          }
          clearDraft();
          logBusinessEvent("os_atualizada", { osId: ordem.id, status: f.status });
          onOpenChange(false);
          toast.success("OS atualizada!");
        }
      } else {
        const formaPagamentoId = f.formaPagamento ? formasPagamentoDB.find(fp => fp.nome === f.formaPagamento)?.id || null : null;

        const servicosItemizados = f.tiposServicoSelecionados
          .map((tipo) => {
            const maoDeObra = parseFloat(f.maoDeObraPorServico[tipo] || "") || 0;
            return { nome_item: tipo, quantidade: 1, valor_unitario: 0, valor_mao_obra: maoDeObra, custo_unitario: 0, estoque_id: null };
          })
          .filter((item) => (item.valor_mao_obra || 0) > 0);

        const allItens = [
          ...servicosItemizados.map(item => ({
            nome_item: item.nome_item, quantidade: 1, valor_unitario: 0,
            valor_mao_obra: item.valor_mao_obra, custo_unitario: 0, estoque_id: null,
          })),
          ...f.pendingItens.map(item => ({
            nome_item: item.nome_item, quantidade: Number(item.quantidade) || 1,
            valor_unitario: Number(item.valor_unitario) || 0, valor_mao_obra: Number(item.valor_mao_obra) || 0,
            custo_unitario: Number(item.custo_unitario) || 0, estoque_id: item.estoque_id || null,
          })),
        ];

        const hasPerServiceMO = servicosItemizados.length > 0;
        const globalMaoDeObra = hasPerServiceMO ? 0 : (parseFloat(f.valorServico) || 0);

        activeRpc = "criar_os_completa";
        rpcPayload = {
          p_oficina_id: oficinaAtual!.id,
          p_cliente_id: f.clienteId,
          p_veiculo_id: f.veiculoId,
          p_tipo_servico: tipoServico,
          p_descricao: f.descricao || null,
          p_km_no_servico: f.kmNoServico ? parseInt(f.kmNoServico) : null,
          p_responsavel_id: f.responsavelId && f.responsavelId !== "none" ? f.responsavelId : null,
          p_data_servico: f.dataServico,
          p_hora_agendamento: f.horaAgendamento || null,
          p_status: f.status,
          p_valor_mao_de_obra: globalMaoDeObra,
          p_custo_servico: parseFloat(f.custoServico) || 0,
          p_forma_pagamento: f.formaPagamento || null,
          p_forma_pagamento_id: formaPagamentoId,
          p_numero_parcelas: f.numeroParcelas,
          p_tem_garantia: f.temGarantia,
          p_dias_garantia: f.temGarantia ? parseInt(f.diasGarantia) : 0,
          p_observacoes: f.observacoes || null,
          p_itens: allItens,
          p_checklist_combustivel: f.checklistCombustivel || null,
          p_checklist_riscos: f.checklistRiscos,
          p_checklist_estepe: f.checklistEstepe,
          p_checklist_som: f.checklistSom,
          p_checklist_luzes: f.checklistLuzes,
          p_fotos_entrada: f.fotosEntrada,
          p_assinatura_cliente_url: f.assinaturaClienteUrl || null,
          p_checklist_voltagem_bateria: f.electricDVIData.voltagemBateria || null,
          p_checklist_carga_bateria: f.electricDVIData.cargaBateria || null,
          p_checklist_alternador_ok: f.electricDVIData.alternadorOk,
          p_checklist_motor_partida_ok: f.electricDVIData.motorPartidaOk,
          p_checklist_fusiveis_ok: f.electricDVIData.fusiveisOk,
          p_codigo_obd: f.electricDVIData.codigosObd[0] || null,
          p_codigos_obd_lista: f.electricDVIData.codigosObd.length > 0 ? f.electricDVIData.codigosObd : [],
          p_hipotese_diagnostico: f.electricDVIData.hipoteseDiagnostico || null,
          p_modulos_testados: f.electricDVIData.modulosTestados.length > 0 ? f.electricDVIData.modulosTestados : [],
          p_tempo_diagnostico_minutos: f.electricDVIData.tempoDiagnosticoMinutos || 0,
        };

        const { data: rpcResult, error: rpcError } = await supabase.rpc("criar_os_completa" as any, rpcPayload);
        if (rpcError) throw rpcError;

        const result = rpcResult as { success: boolean; os_id: string; numero: number; valor_total: number; custo_total: number; status: string; total_itens_inseridos: number };
        if (!result.success) throw new Error("Falha ao criar OS. Nenhum dado foi salvo.");

        // Registrar sinal inicial (se informado) — após OS criada
        const valorSinalNum = parseFloat(sinalInicial.valor.replace(",", ".")) || 0;
        if (valorSinalNum > 0) {
          try {
            await supabase.rpc("registrar_sinal_os" as any, {
              p_os_id: result.os_id,
              p_valor: valorSinalNum,
              p_forma_pagamento_id: sinalInicial.formaId || null,
              p_forma_pagamento_nome: sinalInicial.formaNome || "Dinheiro",
              p_data_pagamento: sinalInicial.data,
              p_observacao: sinalInicial.observacao || null,
            });
          } catch (sinalErr) {
            console.error("[OS] Falha ao registrar sinal inicial:", sinalErr);
            toast.warning("OS criada, mas o sinal não foi registrado", {
              description: "Abra a OS e registre o sinal manualmente.",
            });
          }
        }

        clearDraft();
        logBusinessEvent("os_criada", { tipoServico, clienteId: f.clienteId });

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["itens_os", result.os_id] }),
          queryClient.invalidateQueries({ queryKey: ["ordens_servico", oficinaAtual?.id] }),
          queryClient.invalidateQueries({ queryKey: ["ordens_servico_count", oficinaAtual?.id] }),
          queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
          queryClient.invalidateQueries({ queryKey: ["financeiro-resumo"] }),
          queryClient.invalidateQueries({ queryKey: ["estoque"] }),
          queryClient.invalidateQueries({ queryKey: ["veiculos"] }),
        ]);

        if (f.status === "finalizado") {
          const veiculoData = veiculos.find((v) => v.id === f.veiculoId);
          const { data: ordemAtualizada } = await supabase
            .from("ordens_servico")
            .select(`*, cliente:clientes(id, nome, telefone), veiculo:veiculos(id, tipo, marca, modelo, placa)`)
            .eq("id", result.os_id)
            .single();

          const ordemParaModal = (ordemAtualizada ?? {
            id: result.os_id, numero: result.numero, status: "finalizado",
            cliente: { id: f.clienteId, nome: "Cliente", telefone: null },
            veiculo: veiculoData || { id: f.veiculoId, tipo: "carro", marca: "", modelo: "", placa: null },
            valor_servico: result.valor_total, custo_servico: result.custo_total,
            lucro: result.valor_total - result.custo_total,
          }) as OrdemServico;

          setSavedOrdem(ordemParaModal);
          onOpenChange(false);
          setTimeout(() => setOsFinalizadaOpen(true), 300);
          toast.success("OS criada e finalizada!", {
            description: `${result.total_itens_inseridos} item(ns) · ${formatCurrency(result.valor_total)} · Tudo salvo atomicamente.`,
          });
        } else {
          onOpenChange(false);
          toast.success(`✅ OS criada com ${result.total_itens_inseridos} item(ns)!`, {
            description: f.status === "pendente"
              ? "Toque na OS para adicionar peças e finalizar."
              : "OS em andamento. Complete quando o serviço terminar.",
            duration: 3000,
          });
        }
      }
    } catch (error) {
      logDetailedError("[OS Form] OrdemServicoFormModal.handleSubmit", error, {
        handler: "OrdemServicoFormModal.handleSubmit", rpc: activeRpc, payload: rpcPayload,
        clienteId: f.clienteId, veiculoId: f.veiculoId, status: f.status, isEditing: !!ordem,
      });
      import("@/lib/sentry").then(({ Sentry }) => Sentry.captureException(error, { extra: { clienteId: f.clienteId, veiculoId: f.veiculoId, status: f.status, isEditing: !!(ordem), context: "OrdemServicoFormModal.handleSubmit" } }));
      toast.error("Erro ao salvar", { description: "Seus dados foram salvos localmente. Tente novamente." });
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  // UI-only states (not part of form data, low count, safe as individual useState)
  const [resumoFiscalOpen, setResumoFiscalOpen] = useState(false);
  const [osFinalizadaOpen, setOsFinalizadaOpen] = useState(false);
  const [savedOrdem, setSavedOrdem] = useState<OrdemServico | null>(null);

  const handleWhatsApp = () => {
    if (!ordem) return;
    openWhatsAppOS(ordem, oficinaAtual?.nome || "Oficina", oficinaAtual?.telefone);
  };

  const handleCopyLink = () => {
    if (!ordem) return;
    const url = `${window.location.origin}/os/${(ordem as any).numero || ordem.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!", { description: "Envie para o cliente acompanhar o serviço" });
  };

  const handleCancel = () => {
    if (!isEditing) {
      clearDraft();
    }
    onOpenChange(false);
  };

  const FormContent = (
    <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-6 px-1 pb-32 sm:pb-24 overflow-x-hidden min-w-0">

      {/* SEÇÃO 1: Cliente / Veículo */}
      <OSFormClienteSection
        clienteId={f.clienteId}
        setClienteId={(v) => patchField("clienteId", v)}
        veiculoId={f.veiculoId}
        setVeiculoId={(v) => patchField("veiculoId", v)}
        veiculosDoCliente={veiculosDoCliente}
      />

      {/* SEÇÃO 2: Serviço */}
      <OSFormServicoSection
        responsavelId={f.responsavelId}
        setResponsavelId={(v) => patchField("responsavelId", v)}
        dataServico={f.dataServico}
        setDataServico={(v) => patchField("dataServico", v)}
        horaAgendamento={f.horaAgendamento}
        setHoraAgendamento={(v) => patchField("horaAgendamento", v)}
        tiposServicoSelecionados={f.tiposServicoSelecionados}
        setTiposServicoSelecionados={setTiposServicoSelecionados}
        isCustomTipoServico={f.isCustomTipoServico}
        setIsCustomTipoServico={(v) => patchField("isCustomTipoServico", v)}
        customTipoServico={f.customTipoServico}
        setCustomTipoServico={(v) => patchField("customTipoServico", v)}
        tiposServico={tiposServico}
        kmNoServico={f.kmNoServico}
        setKmNoServico={(v) => patchField("kmNoServico", v)}
        status={f.status}
        setStatus={(v) => patchField("status", v)}
        descricao={f.descricao}
        setDescricao={(v) => patchField("descricao", v)}
        isAutoEletrica={isAutoEletrica}
        maoDeObraPorServico={f.maoDeObraPorServico}
        setMaoDeObraPorServico={(v) => patchField("maoDeObraPorServico", v)}
        isEditing={isEditing}
      />

      {/* SEÇÃO 3: Itens da OS (Peças, Serviços do Catálogo, Itens Livres) */}
      {isEditing && ordem ? (
        <ItensOSList ordemServicoId={ordem.id} />
      ) : !isEditing && (
        <OSFormPendingItens
          pendingItens={f.pendingItens}
          setPendingItens={setPendingItens}
          onOpenServicoRapido={openServicoRapido}
          onEditItem={openEditPendingItem}
        />
      )}

      {/* Conclusão */}
      {(f.status === "finalizado" || f.status === "em_andamento") && (
        <ConclusaoSection
          fotosSaida={f.fotosSaida}
          setFotosSaida={(v) => patchField("fotosSaida", v)}
          observacoesConclusao={f.observacoesConclusao}
          setObservacoesConclusao={(v) => patchField("observacoesConclusao", v)}
          ordemId={ordem?.id}
          fotosEntrada={f.fotosEntrada}
        />
      )}

      {/* SEÇÃO 4: Financeiro — Valores + Sinal recolhido */}
      <OSFormValoresSection
        valorServico={f.valorServico}
        setValorServico={(v) => patchField("valorServico", v)}
        custoServico={f.custoServico}
        setCustoServico={(v) => patchField("custoServico", v)}
        formaPagamento={f.formaPagamento}
        setFormaPagamento={(v) => patchField("formaPagamento", v)}
        temGarantia={f.temGarantia}
        setTemGarantia={(v) => patchField("temGarantia", v)}
        diasGarantia={f.diasGarantia}
        setDiasGarantia={(v) => patchField("diasGarantia", v)}
        formasPagamentoDB={formasPagamentoDB}
        pendingItensTotal={pendingItensTotal}
        pendingItensPecas={pendingItensPecas}
        pendingItensMaoObra={pendingItensMaoObra}
        pendingItensCount={f.pendingItens.length}
        pendingItensCusto={pendingItensCusto}
        pendingItensSemCustoCount={pendingItensSemCustoCount}
        isEditing={isEditing}
        isAutoEletrica={isAutoEletrica}
        numeroParcelas={f.numeroParcelas}
        setNumeroParcelas={(v) => patchField("numeroParcelas", v)}
      />

      {/* Sinal inicial — opcional, recolhido por padrão */}
      {!isEditing && f.status !== "finalizado" && (
        <OSSinalInicialBlock
          value={sinalInicial}
          onChange={setSinalInicial}
          totalEstimado={(parseFloat(f.valorServico) || 0) + pendingItensTotal}
        />
      )}

      {/* Resumo Financeiro (editing) */}
      {isEditing && ordem && (
        <OSResumoValores
          ordemServicoId={ordem.id}
          valorServico={ordem.valor_servico || 0}
          valorMaoObra={parseFloat(f.valorServico) || 0}
          custoServico={parseFloat(f.custoServico) || 0}
          desconto={parseCurrency(f.descontoValor || "")}
          descontoMotivo={f.descontoMotivo}
        />
      )}

      {/* Desconto — apenas em edição (após criar a OS) */}
      {isEditing && ordem && (
        <OSDescontoSection
          subtotal={ordem.valor_servico || 0}
          descontoValor={f.descontoValor}
          setDescontoValor={(v) => patchField("descontoValor", v)}
          descontoMotivo={f.descontoMotivo}
          setDescontoMotivo={(v) => patchField("descontoMotivo", v)}
        />
      )}

      {/* Pagamento Parcial / Sinal — só em OS em andamento */}
      {isEditing && ordem && ordem.status !== "finalizado" && ordem.status !== "cancelado" && (
        <OSPagamentoParcial
          ordemServicoId={ordem.id}
          valorTotalOS={ordem.valor_servico || 0}
        />
      )}

      {/* SEÇÃO 5: Complementos (Checklist, Fotos, Assinatura) */}
      <OSFormVistoriaSection
        isAutoEletrica={isAutoEletrica}
        tipoVeiculo={tipoVeiculo}
        showChecklist={f.showChecklist}
        setShowChecklist={(v) => patchField("showChecklist", v)}
        checklistCombustivel={f.checklistCombustivel}
        setChecklistCombustivel={(v) => patchField("checklistCombustivel", v)}
        checklistRiscos={f.checklistRiscos}
        setChecklistRiscos={(v) => patchField("checklistRiscos", v)}
        checklistEstepe={f.checklistEstepe}
        setChecklistEstepe={(v) => patchField("checklistEstepe", v)}
        checklistSom={f.checklistSom}
        setChecklistSom={(v) => patchField("checklistSom", v)}
        checklistLuzes={f.checklistLuzes}
        setChecklistLuzes={(v) => patchField("checklistLuzes", v)}
        fotosEntrada={f.fotosEntrada}
        setFotosEntrada={(v) => patchField("fotosEntrada", v)}
        ordemId={ordem?.id}
        electricDVIData={f.electricDVIData}
        setElectricDVIData={(v) => patchField("electricDVIData", v)}
        electricDVIOpen={f.electricDVIOpen}
        setElectricDVIOpen={(v) => patchField("electricDVIOpen", v)}
        showFotos={f.showFotos}
        setShowFotos={(v) => patchField("showFotos", v)}
        showAssinatura={f.showAssinatura}
        setShowAssinatura={(v) => patchField("showAssinatura", v)}
        assinaturaClienteUrl={f.assinaturaClienteUrl}
        setAssinaturaClienteUrl={(v) => patchField("assinaturaClienteUrl", v)}
      />

      {/* Parcelamento */}
      {isEditing && ordem && (ordem.valor_servico > 0 || parseFloat(f.valorServico) > 0) && (
        <ParcelasManager ordemServicoId={ordem.id} valorTotal={ordem.valor_servico || parseFloat(f.valorServico) || 0} />
      )}

      {/* Actions for existing OS */}
      {isEditing && ordem && (
        <div className="space-y-2">
          <Button type="button" variant="outline" size="sm" className="w-full h-12 border-primary/50 text-primary hover:bg-primary/5 font-medium text-base" onClick={() => { setSavedOrdem(ordem); setOsFinalizadaOpen(true); }}>
            <Eye className="w-4 h-4 mr-2" />Ver Ordem de Serviço
          </Button>
          <div className="flex gap-2 p-3 bg-success/10 rounded-xl border border-success/20">
            <Button type="button" variant="outline" size="sm" className="flex-1 h-12 border-success/30 text-success hover:bg-success/10 text-base" onClick={handleWhatsApp}>
              <MessageCircle className="w-4 h-4 mr-1" />WhatsApp
            </Button>
            <Button type="button" variant="outline" size="sm" className="flex-1 h-12 text-base" onClick={handleCopyLink}>
              <Link2 className="w-4 h-4 mr-1" />Link
            </Button>
          </div>
          <Button type="button" variant="outline" size="sm" className="w-full h-12 border-warning/30 text-warning hover:bg-warning/10 text-base" onClick={() => setResumoFiscalOpen(true)}>
            <Receipt className="w-4 h-4 mr-2" />Resumo Fiscal (Dados para NF)
          </Button>
        </div>
      )}

      {/* Footer Sticky: Resumo + Botões */}
      <div className={`pt-3 ${isMobile ? 'pb-[calc(1rem+env(safe-area-inset-bottom))] sticky bottom-0 bg-background border-t border-border/60 px-3 z-10 shadow-[0_-4px_16px_rgba(0,0,0,0.10)]' : 'pb-2 sticky bottom-0 bg-background border-t border-border/60 px-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]'}`}>
        {!isEditing && (
          <div className="flex items-center justify-between text-xs text-muted-foreground py-2 border-b border-border/40 mb-2">
            <div className="flex items-center gap-3">
              <span>Mão de obra: <span className="font-semibold text-foreground">{formatCurrency((parseFloat(f.valorServico) || 0) + pendingItensMaoObra)}</span></span>
              <span>Peças: <span className="font-semibold text-foreground">{formatCurrency(pendingItensPecas)}</span></span>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide">Total</p>
              <p className="text-base font-black text-foreground leading-none">{formatCurrency((parseFloat(f.valorServico) || 0) + pendingItensTotal)}</p>
            </div>
          </div>
        )}
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={handleCancel} className="flex-1 h-14 text-base">Cancelar</Button>
          <Button type="submit" className="flex-[2] h-14 bg-primary hover:bg-primary/90 font-bold text-base shadow-lg" disabled={loading || !f.clienteId || !f.veiculoId || !tipoServico}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isEditing ? "Salvar" : "CRIAR ORDEM DE SERVIÇO"}
          </Button>
        </div>
      </div>
    </form>
  );

  const HeaderContent = (
    <div className="flex items-center gap-2 flex-1">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
        <Wrench className="w-5 h-5 text-primary" />
      </div>
      <div><span className="font-bold text-base">{isEditing ? "EDITAR ORDEM DE SERVIÇO" : "NOVA ORDEM DE SERVIÇO"}</span></div>
      {!isEditing && (
        <div className="ml-auto">
          <SavingIndicator isSaving={loading || isSaving} lastSaved={lastSaved} hasDraft={hasDraft && !loading} />
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={(isOpen) => {
          if (!isOpen && f.servicoRapidoOpen) return;
          if (!isOpen && !isEditing && (f.clienteId || f.veiculoId || f.valorServico || f.descricao || f.pendingItens.length > 0)) {
            const confirm = window.confirm("Você tem dados não salvos. Deseja sair? Seu rascunho será preservado automaticamente.");
            if (!confirm) return;
          }
          onOpenChange(isOpen);
        }}>
          <DrawerContent className="px-4 pb-0 max-h-[92dvh]">
            <DrawerHeader className="text-left px-0 shrink-0">
              <DrawerTitle className="flex items-center gap-2 text-lg">{HeaderContent}</DrawerTitle>
            </DrawerHeader>
            <div data-os-form-scroll className="overflow-y-auto flex-1 min-h-0 pb-2 -mx-1 px-1 overscroll-contain touch-pan-y">{FormContent}</div>
          </DrawerContent>
        </Drawer>
        {ordem && <ResumoFiscalModal open={resumoFiscalOpen} onOpenChange={setResumoFiscalOpen} ordem={ordem} />}
        <OSFinalizadaModal open={osFinalizadaOpen} onOpenChange={setOsFinalizadaOpen} ordem={savedOrdem} oficinaNome={oficinaAtual?.nome} oficinaTelefone={oficinaAtual?.telefone} onEdit={() => { if (savedOrdem) setOsFinalizadaOpen(false); }} />
        <ServicoRapidoModal
          open={f.servicoRapidoOpen}
          onOpenChange={(v) => { patchField("servicoRapidoOpen", v); if (!v) setEditingPendingItem(null); }}
          initialView={servicoRapidoInitialView}
          editingItem={editingPendingItem}
          onUpdateItem={updatePendingItem}
          onAddItem={async (item) => {
            dispatch({ type: "PATCH", payload: { pendingItens: [...f.pendingItens, { id: crypto.randomUUID(), valor_mao_obra: 0, ...item }] } });
            toast.success(`${item.nome_item} adicionado!`, { duration: 1500 });
          }}
        />
      </>
    );
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen && f.servicoRapidoOpen) return;
          onOpenChange(isOpen);
        }}
        modal={!f.servicoRapidoOpen}
      >
        <DialogContent
          className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90vh] overflow-hidden p-0 gap-0 flex flex-col"
          onInteractOutside={(event) => {
            if (f.servicoRapidoOpen) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (f.servicoRapidoOpen) event.preventDefault();
          }}
        >
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/60 shrink-0">
            <DialogTitle className="flex items-center gap-2 min-w-0 pr-10">{HeaderContent}</DialogTitle>
          </DialogHeader>
          <div data-os-form-scroll className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pt-4" style={{ WebkitOverflowScrolling: "touch" }}>
            {FormContent}
          </div>
        </DialogContent>
      </Dialog>
      {ordem && <ResumoFiscalModal open={resumoFiscalOpen} onOpenChange={setResumoFiscalOpen} ordem={ordem} />}
      <OSFinalizadaModal open={osFinalizadaOpen} onOpenChange={setOsFinalizadaOpen} ordem={savedOrdem} oficinaNome={oficinaAtual?.nome} oficinaTelefone={oficinaAtual?.telefone} onEdit={() => { if (savedOrdem) setOsFinalizadaOpen(false); }} />
      <ServicoRapidoModal
        open={f.servicoRapidoOpen}
        onOpenChange={(v) => { patchField("servicoRapidoOpen", v); if (!v) setEditingPendingItem(null); }}
        initialView={servicoRapidoInitialView}
        editingItem={editingPendingItem}
        onUpdateItem={updatePendingItem}
        onAddItem={async (item) => {
          dispatch({ type: "PATCH", payload: { pendingItens: [...f.pendingItens, { id: crypto.randomUUID(), valor_mao_obra: 0, ...item }] } });
          toast.success(`${item.nome_item} adicionado!`, { duration: 1500 });
        }}
      />
    </>
  );
}
