import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClientes, Cliente, ClienteInput } from "@/hooks/useClientes";
import { useVeiculos, Veiculo } from "@/hooks/useVeiculos";
import { useOficina } from "@/contexts/OficinaContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Loader2, User, Phone, Mail, Trash2, Car, Bike, Plus, Edit2, ChevronRight, Clock } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VeiculoFormModal } from "./VeiculoFormModal";
import { ClienteHistorico } from "@/components/clientes/ClienteHistorico";
import { logBusinessEvent } from "@/lib/errorHandling";
import { handleFormKeyDown } from "@/lib/formGuard";
import { useAutoSave } from "@/hooks/useAutoSave";
import { DraftPromptDialog } from "@/components/DraftPromptDialog";
import { isChildModalActive } from "@/lib/childModalLock";

// Schema de validação
const clienteSchema = z.object({
  nome: z.string()
    .trim()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  telefone: z.string()
    .trim()
    .max(20, "Telefone deve ter no máximo 20 caracteres")
    .optional()
    .or(z.literal("")),
  email: z.string()
    .trim()
    .email("E-mail inválido")
    .max(255, "E-mail deve ter no máximo 255 caracteres")
    .optional()
    .or(z.literal("")),
  observacoes: z.string()
    .trim()
    .max(500, "Observações devem ter no máximo 500 caracteres")
    .optional()
    .or(z.literal("")),
});

const veiculoSchema = z.object({
  tipo: z.string().min(1, "Selecione o tipo"),
  marca: z.string().min(1, "Marca é obrigatória"),
  modelo: z.string().min(1, "Modelo é obrigatório"),
  ano: z.number().min(1900, "Ano inválido").max(new Date().getFullYear() + 1, "Ano inválido").optional().nullable(),
  placa: z.string().max(10, "Placa deve ter no máximo 10 caracteres").optional().or(z.literal("")),
  km_atual: z.number().min(0, "KM inválido").optional().nullable(),
});

interface ClienteFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente?: Cliente | null;
  initialTab?: "dados" | "historico";
  onNovaOS?: (clienteId: string, veiculoId?: string) => void;
  onNovoOrcamento?: (clienteId: string, veiculoId?: string) => void;
}

export function ClienteFormModal({ open, onOpenChange, cliente, initialTab, onNovaOS, onNovoOrcamento }: ClienteFormModalProps) {
  const { createCliente, updateCliente, deleteCliente } = useClientes();
  const { veiculos, createVeiculo } = useVeiculos();
  const { oficinaAtual } = useOficina();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // BLINDAGEM: Proteção contra duplo clique
  const isSubmittingRef = useRef(false);
  const lastSubmitRef = useRef<number>(0);
  
  // Determinar tipo de oficina para filtrar opções
  const tipoOficina = oficinaAtual?.tipo || "ambos";
  const showCarro = tipoOficina === "carro" || tipoOficina === "ambos";
  const showMoto = tipoOficina === "moto" || tipoOficina === "ambos";
  const tipoDefault = tipoOficina === "carro" ? "carro" : tipoOficina === "moto" ? "moto" : tipoOficina === "auto_eletrica" ? "carro" : "";
  
  // Vehicle modal state
  const [veiculoModalOpen, setVeiculoModalOpen] = useState(false);
  const [veiculoParaEditar, setVeiculoParaEditar] = useState<Veiculo | null>(null);

  // O VeiculoFormModal é filho deste modal. Enquanto ele está aberto — e durante
  // o eco de 500 ms após fechar — ignora o fechamento propagado pelo Radix.
  const handleParentOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen && isChildModalActive()) return;
    onOpenChange(nextOpen);
  }, [onOpenChange]);
  
  // Get vehicles for this client when editing
  const veiculosDoCliente = cliente 
    ? veiculos.filter(v => v.cliente_id === cliente.id)
    : [];
  
  // Cliente fields
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Veículo fields (only for new clients)
  const [veiculoTipo, setVeiculoTipo] = useState(tipoDefault);
  const [veiculoMarca, setVeiculoMarca] = useState("");
  const [veiculoModelo, setVeiculoModelo] = useState("");
  const [veiculoAno, setVeiculoAno] = useState("");
  const [veiculoPlaca, setVeiculoPlaca] = useState("");
  const [veiculoKm, setVeiculoKm] = useState("");

  const isEditing = !!cliente;

  // ─── AutoSave: persiste rascunho de novo cliente ─────────────────
  const draftData = useMemo(() => ({
    nome, telefone, email, cpfCnpj, endereco, observacoes,
    veiculoTipo, veiculoMarca, veiculoModelo, veiculoAno, veiculoPlaca, veiculoKm,
  }), [nome, telefone, email, cpfCnpj, endereco, observacoes,
    veiculoTipo, veiculoMarca, veiculoModelo, veiculoAno, veiculoPlaca, veiculoKm]);

  const { hasDraft, restore, clearDraft, lastSaved } = useAutoSave({
    key: `cliente-form-${oficinaAtual?.id || "global"}-new`,
    data: draftData,
    enabled: open && !isEditing,
    interval: 1500,
  });

  const hasRestoredRef = useRef(false);
  const [draftPromptOpen, setDraftPromptOpen] = useState(false);

  const resetClienteForm = useCallback(() => {
    setNome("");
    setTelefone("");
    setEmail("");
    setCpfCnpj("");
    setEndereco("");
    setObservacoes("");
    setVeiculoTipo(tipoDefault);
    setVeiculoMarca("");
    setVeiculoModelo("");
    setVeiculoAno("");
    setVeiculoPlaca("");
    setVeiculoKm("");
    setErrors({});
  }, [tipoDefault]);

  const applyDraft = useCallback(() => {
    const saved = restore() as typeof draftData | null;
    if (saved) {
      setNome(saved.nome || "");
      setTelefone(saved.telefone || "");
      setEmail(saved.email || "");
      setCpfCnpj(saved.cpfCnpj || "");
      setEndereco(saved.endereco || "");
      setObservacoes(saved.observacoes || "");
      setVeiculoTipo(saved.veiculoTipo || tipoDefault);
      setVeiculoMarca(saved.veiculoMarca || "");
      setVeiculoModelo(saved.veiculoModelo || "");
      setVeiculoAno(saved.veiculoAno || "");
      setVeiculoPlaca(saved.veiculoPlaca || "");
      setVeiculoKm(saved.veiculoKm || "");
      setErrors({});
    }
    setDraftPromptOpen(false);
  }, [restore, tipoDefault]);

  const discardDraft = useCallback(() => {
    clearDraft();
    resetClienteForm();
    setDraftPromptOpen(false);
  }, [clearDraft, resetClienteForm]);

  // BLINDAGEM UX: nunca restaurar rascunho silenciosamente.
  useEffect(() => {
    if (cliente) {
      setNome(cliente.nome);
      setTelefone(cliente.telefone || "");
      setEmail(cliente.email || "");
      setCpfCnpj(cliente.cpf_cnpj || "");
      setEndereco(cliente.endereco || "");
      setObservacoes(cliente.observacoes || "");
    } else if (open) {
      if (hasDraft && !hasRestoredRef.current) {
        hasRestoredRef.current = true;
        setDraftPromptOpen(true);
      } else if (!hasRestoredRef.current) {
        hasRestoredRef.current = true;
        resetClienteForm();
      }
    }
    if (!open) {
      hasRestoredRef.current = false;
      setDraftPromptOpen(false);
    }
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente, open]);

  const scrollToFirstError = useCallback((fieldErrors: Record<string, string>) => {
    // Blur active element to dismiss keyboard first
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    // Scroll to first error field after a short delay (keyboard dismiss)
    setTimeout(() => {
      const firstKey = Object.keys(fieldErrors)[0];
      if (!firstKey) return;
      // Map error key to input id
      const inputId = firstKey.startsWith("veiculo_") ? firstKey.replace("veiculo_", "veiculo") : firstKey;
      const el = document.getElementById(inputId) || document.querySelector(`[id*="${firstKey}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Re-focus the field after scroll
        setTimeout(() => (el as HTMLElement).focus?.(), 400);
      }
    }, 150);
  }, []);

  const validateForm = (): { valid: boolean; errorCount: number } => {
    const clienteResult = clienteSchema.safeParse({ nome, telefone, email, observacoes });
    const fieldErrors: Record<string, string> = {};
    
    if (!clienteResult.success) {
      clienteResult.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
    }

    if (!isEditing) {
      const hasVeiculoData = veiculoTipo || veiculoMarca || veiculoModelo;
      
      if (hasVeiculoData) {
        const veiculoResult = veiculoSchema.safeParse({
          tipo: veiculoTipo,
          marca: veiculoMarca,
          modelo: veiculoModelo,
          ano: veiculoAno ? parseInt(veiculoAno) : null,
          placa: veiculoPlaca,
          km_atual: veiculoKm ? parseInt(veiculoKm) : null,
        });

        if (!veiculoResult.success) {
          veiculoResult.error.errors.forEach((err) => {
            if (err.path[0]) {
              fieldErrors[`veiculo_${err.path[0]}`] = err.message;
            }
          });
        }
      }
    }

    setErrors(fieldErrors);
    
    const count = Object.keys(fieldErrors).length;
    if (count > 0) {
      scrollToFirstError(fieldErrors);
    }
    
    return { valid: count === 0, errorCount: count };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Dismiss keyboard before validation
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    const { valid, errorCount } = validateForm();
    if (!valid) {
      toast.error(
        errorCount > 1 
          ? `${errorCount} campos precisam de correção` 
          : "Corrija o campo destacado no formulário"
      );
      return;
    }
    
    const now = Date.now();
    if (isSubmittingRef.current || now - lastSubmitRef.current < 1000) {
      console.log("[Cliente Form] Submit bloqueado - ação já em andamento");
      return;
    }
    
    isSubmittingRef.current = true;
    lastSubmitRef.current = now;
    setLoading(true);

    try {
      const data: ClienteInput = {
        nome: nome.trim(),
        telefone: telefone.trim() || undefined,
        email: email.trim() || undefined,
        cpf_cnpj: cpfCnpj.trim() || undefined,
        endereco: endereco.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
      };

      if (isEditing && cliente) {
        await updateCliente.mutateAsync({ id: cliente.id, ...data });
      } else {
        const novoCliente = await createCliente.mutateAsync(data);
        
        const hasVeiculoData = veiculoTipo && veiculoMarca && veiculoModelo;
        if (hasVeiculoData && novoCliente) {
          await createVeiculo.mutateAsync({
            cliente_id: novoCliente.id,
            tipo: veiculoTipo as "carro" | "moto",
            marca: veiculoMarca.trim(),
            modelo: veiculoModelo.trim(),
            ano: veiculoAno ? parseInt(veiculoAno) : undefined,
            placa: veiculoPlaca.trim() || undefined,
            km_atual: veiculoKm ? parseInt(veiculoKm) : undefined,
          });
          // Toast já é exibido pelos hooks useClientes e useVeiculos
        }
        
        logBusinessEvent("cliente_criado", { nome: data.nome });
      }

      if (!isEditing) clearDraft();
      onOpenChange(false);
    } catch (error) {
      // Error already handled by mutation
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!cliente) return;
    
    setDeleteLoading(true);
    try {
      await deleteCliente.mutateAsync(cliente.id);
      setDeleteDialogOpen(false);
      onOpenChange(false);
    } catch (error) {
      // Error already handled by mutation
    } finally {
      setDeleteLoading(false);
    }
  };

  // ═══════════ FORM CONTENT PARA EDIÇÃO ═══════════
  const EditFormContent = ({ stickyFooter }: { stickyFooter?: boolean }) => (
    <Tabs defaultValue={initialTab || "dados"} key={`${cliente?.id}-${initialTab}`} className="w-full">
      <TabsList className="w-full mb-3">
        <TabsTrigger value="dados" className="flex-1">
          <User className="w-4 h-4 mr-1.5" />
          Dados
        </TabsTrigger>
        <TabsTrigger value="historico" className="flex-1">
          <Clock className="w-4 h-4 mr-1.5" />
          Histórico
        </TabsTrigger>
      </TabsList>

      <TabsContent value="dados">
        <div className={isMobile ? "pr-2" : "max-h-[calc(90vh-180px)] pr-4 overflow-y-auto"} style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
          <form id="cliente-edit-form" onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-4">
            {/* Error summary banner */}
            {Object.keys(errors).length > 0 && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive flex items-start gap-2">
                <span className="font-medium">⚠</span>
                <span>
                  {Object.keys(errors).length === 1
                    ? "1 campo precisa de correção"
                    : `${Object.keys(errors).length} campos precisam de correção`}
                </span>
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="nome" placeholder="Nome do cliente" value={nome} onChange={(e) => setNome(e.target.value)}
                    className={`pl-10 h-12 text-base ${errors.nome ? "border-destructive" : ""}`} maxLength={100} />
                </div>
                {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="telefone" placeholder="(00) 00000-0000" value={telefone} onChange={(e) => setTelefone(e.target.value)}
                    className={`pl-10 h-12 text-base ${errors.telefone ? "border-destructive" : ""}`} maxLength={20} />
                </div>
                {errors.telefone && <p className="text-xs text-destructive">{errors.telefone}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)}
                    className={`pl-10 h-12 text-base ${errors.email ? "border-destructive" : ""}`} maxLength={255} />
                </div>
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="cpfCnpj">CPF / CNPJ</Label>
                  <Input id="cpfCnpj" placeholder="000.000.000-00" value={cpfCnpj} onChange={(e) => {
                    let v = e.target.value.replace(/\D/g, "");
                    if (v.length <= 11) {
                      v = v.replace(/(\d{3})(\d)/, "$1.$2");
                      v = v.replace(/(\d{3})(\d)/, "$1.$2");
                      v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
                    } else {
                      v = v.replace(/^(\d{2})(\d)/, "$1.$2");
                      v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
                      v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
                      v = v.replace(/(\d{4})(\d)/, "$1-$2");
                    }
                    setCpfCnpj(v);
                  }}
                    className="h-12 text-base" maxLength={18} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endereco">Endereço</Label>
                  <Input id="endereco" placeholder="Rua, número, bairro..." value={endereco} onChange={(e) => setEndereco(e.target.value)}
                    className="h-12 text-base" maxLength={200} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea id="observacoes" placeholder="Observações sobre o cliente..." value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)} className={`text-base ${errors.observacoes ? "border-destructive" : ""}`}
                  maxLength={500} rows={3} />
                {errors.observacoes && <p className="text-xs text-destructive">{errors.observacoes}</p>}
              </div>
            </div>

            {/* Vehicles Section - When editing */}
            <Separator className="my-4" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium flex items-center gap-2">
                  <Car className="w-4 h-4 text-accent" />
                  Veículos do Cliente
                </Label>
                <Button type="button" size="sm"
                  onClick={() => { setVeiculoParaEditar(null); setVeiculoModalOpen(true); }}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold shadow-sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Outro veículo
                </Button>
              </div>

              {veiculosDoCliente.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground bg-muted/30 rounded-lg">
                  <Car className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum veículo cadastrado</p>
                  <p className="text-xs">Clique em "+ Outro veículo" para cadastrar</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {veiculosDoCliente.map((veiculo) => (
                    <div key={veiculo.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => { setVeiculoParaEditar(veiculo); setVeiculoModalOpen(true); }}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent/10 rounded-lg">
                          {veiculo.tipo === "moto" ? <Bike className="w-4 h-4 text-accent" /> : <Car className="w-4 h-4 text-accent" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{veiculo.marca} {veiculo.modelo}</p>
                          <p className="text-xs text-muted-foreground">
                            {veiculo.placa || "Sem placa"}
                            {veiculo.ano && ` • ${veiculo.ano}`}
                            {veiculo.km_atual ? ` • ${veiculo.km_atual.toLocaleString()} km` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-accent hover:bg-accent/10"
                          onClick={(e) => { e.stopPropagation(); setVeiculoParaEditar(veiculo); setVeiculoModalOpen(true); }}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Desktop: buttons inside form; Mobile: rendered separately as sticky footer */}
            {!stickyFooter && (
              <div className="flex justify-between gap-2 pt-4 pb-2">
                <div>
                  <Button type="button" variant="ghost" onClick={() => setDeleteDialogOpen(true)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-12">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-12">Cancelar</Button>
                  <Button type="submit" className="bg-accent hover:bg-accent/90 h-12 font-semibold" disabled={loading}>
                    {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>) : "Salvar"}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </div>
      </TabsContent>

      <TabsContent value="historico">
        <div className={isMobile ? "pr-2" : "max-h-[calc(90vh-180px)] pr-4 overflow-y-auto"} style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
          {cliente && <ClienteHistorico clienteId={cliente.id} onNovaOS={onNovaOS} onNovoOrcamento={onNovoOrcamento} />}
        </div>
      </TabsContent>
    </Tabs>
  );

  // ═══════════ FORM CONTENT PARA CRIAÇÃO ═══════════
  const NewFormContent = ({ stickyFooter }: { stickyFooter?: boolean }) => (
    <form id="cliente-new-form" onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-4">
      {/* Error summary banner */}
      {Object.keys(errors).length > 0 && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive flex items-start gap-2">
          <span className="font-medium">⚠</span>
          <span>
            {Object.keys(errors).length === 1
              ? "1 campo precisa de correção"
              : `${Object.keys(errors).length} campos precisam de correção`}
          </span>
        </div>
      )}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome *</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="nome" placeholder="Nome do cliente" value={nome} onChange={(e) => setNome(e.target.value)}
              className={`pl-10 h-12 text-base ${errors.nome ? "border-destructive" : ""}`} maxLength={100} />
          </div>
          {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="telefone" placeholder="(00) 00000-0000" value={telefone} onChange={(e) => setTelefone(e.target.value)}
              className={`pl-10 h-12 text-base ${errors.telefone ? "border-destructive" : ""}`} maxLength={20} />
          </div>
          {errors.telefone && <p className="text-xs text-destructive">{errors.telefone}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="email" type="email" placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)}
              className={`pl-10 h-12 text-base ${errors.email ? "border-destructive" : ""}`} maxLength={255} />
          </div>
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="cpfCnpj">CPF / CNPJ</Label>
            <Input id="cpfCnpj" placeholder="000.000.000-00" value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)}
              className="h-12 text-base" maxLength={18} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input id="endereco" placeholder="Rua, número, bairro..." value={endereco} onChange={(e) => setEndereco(e.target.value)}
              className="h-12 text-base" maxLength={200} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="observacoes">Observações</Label>
          <Textarea id="observacoes" placeholder="Observações sobre o cliente..." value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)} className={`text-base ${errors.observacoes ? "border-destructive" : ""}`}
            maxLength={500} rows={3} />
          {errors.observacoes && <p className="text-xs text-destructive">{errors.observacoes}</p>}
        </div>
      </div>

      {/* Veículo Section - Only for new clients */}
      <Separator className="my-4" />
      <div className="space-y-4">
        <Label className="text-base font-medium flex items-center gap-2">
          <Car className="w-4 h-4 text-accent" />
          Veículo (opcional)
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="veiculoTipo">Tipo</Label>
            {!showCarro || !showMoto ? (
              <div className="flex items-center gap-2 h-12 px-3 border rounded-md bg-muted/30">
                {showMoto ? <Bike className="w-4 h-4" /> : <Car className="w-4 h-4" />}
                <span>{showMoto ? "Moto" : "Carro"}</span>
              </div>
            ) : (
              <Select value={veiculoTipo} onValueChange={setVeiculoTipo}>
                <SelectTrigger className={`h-12 ${errors.veiculo_tipo ? "border-destructive" : ""}`}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="z-[9999]">
                  <SelectItem value="carro"><span className="flex items-center gap-2"><Car className="w-4 h-4" /> Carro</span></SelectItem>
                  <SelectItem value="moto"><span className="flex items-center gap-2"><Bike className="w-4 h-4" /> Moto</span></SelectItem>
                </SelectContent>
              </Select>
            )}
            {errors.veiculo_tipo && <p className="text-xs text-destructive">{errors.veiculo_tipo}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="veiculoAno">Ano</Label>
            <Input id="veiculoAno" type="number" placeholder="2024" value={veiculoAno} onChange={(e) => setVeiculoAno(e.target.value)}
              className={`h-12 ${errors.veiculo_ano ? "border-destructive" : ""}`} min={1900} max={new Date().getFullYear() + 1} />
            {errors.veiculo_ano && <p className="text-xs text-destructive">{errors.veiculo_ano}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="veiculoMarca">Marca</Label>
            <Input id="veiculoMarca" placeholder="Honda, Fiat..." value={veiculoMarca} onChange={(e) => setVeiculoMarca(e.target.value)}
              className={`h-12 ${errors.veiculo_marca ? "border-destructive" : ""}`} />
            {errors.veiculo_marca && <p className="text-xs text-destructive">{errors.veiculo_marca}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="veiculoModelo">Modelo</Label>
            <Input id="veiculoModelo" placeholder="Civic, Uno..." value={veiculoModelo} onChange={(e) => setVeiculoModelo(e.target.value)}
              className={`h-12 ${errors.veiculo_modelo ? "border-destructive" : ""}`} />
            {errors.veiculo_modelo && <p className="text-xs text-destructive">{errors.veiculo_modelo}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="veiculoPlaca">Placa</Label>
            <Input id="veiculoPlaca" placeholder="ABC-1234" value={veiculoPlaca} onChange={(e) => setVeiculoPlaca(e.target.value.toUpperCase())}
              className="h-12" maxLength={10} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="veiculoKm">KM Atual</Label>
            <Input id="veiculoKm" type="number" placeholder="50000" value={veiculoKm} onChange={(e) => setVeiculoKm(e.target.value)}
              className="h-12" min={0} />
          </div>
        </div>
      </div>

      {/* Desktop: buttons inside form; Mobile: rendered separately */}
      {!stickyFooter && (
        <div className="flex justify-end gap-2 pt-4 pb-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-12">Cancelar</Button>
          <Button type="submit" className="bg-accent hover:bg-accent/90 h-12 font-semibold" disabled={loading}>
            {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>) : "Cadastrar"}
          </Button>
        </div>
      )}
    </form>
  );

  const HeaderContent = (
    <div className="flex items-center gap-2">
      <User className="w-5 h-5 text-accent" />
      {isEditing ? "Editar Cliente" : "Novo Cliente"}
    </div>
  );

  // ═══════════ MOBILE: DRAWER ═══════════
  if (isMobile) {
    const formId = isEditing ? "cliente-edit-form" : "cliente-new-form";
    return (
      <>
        <Drawer open={open} onOpenChange={handleParentOpenChange}>
          <DrawerContent className="px-4 pb-0 max-h-[90dvh]">
            {/* Header with inline Save button */}
            <DrawerHeader className="text-left px-0 flex-shrink-0 flex items-center justify-between">
              <DrawerTitle className="flex items-center gap-2 text-lg">
                {HeaderContent}
              </DrawerTitle>
              <Button
                type="button"
                size="sm"
                className="bg-accent hover:bg-accent/90 font-semibold h-9 px-4"
                disabled={loading}
                onClick={() => {
                  const form = document.getElementById(formId) as HTMLFormElement;
                  form?.requestSubmit();
                }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
              </Button>
            </DrawerHeader>

            {/* Content flows inside DrawerContent's single scroll container — no extra overflow-y-auto wrapper */}
            {isEditing ? EditFormContent({ stickyFooter: true }) : NewFormContent({ stickyFooter: true })}

            {/* Sticky footer */}
            <div className="sticky bottom-0 border-t border-border bg-background pt-3 pb-[max(env(safe-area-inset-bottom),12px)] flex justify-between gap-2 -mx-4 px-4">
              {isEditing && (
                <Button type="button" variant="ghost" onClick={() => setDeleteDialogOpen(true)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-11">
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Excluir
                </Button>
              )}
              <div className={`flex gap-2 ${isEditing ? '' : 'ml-auto'}`}>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-11">Cancelar</Button>
                <Button
                  type="button"
                  className="bg-accent hover:bg-accent/90 h-11 font-semibold"
                  disabled={loading}
                  onClick={() => {
                    const form = document.getElementById(formId) as HTMLFormElement;
                    form?.requestSubmit();
                  }}
                >
                  {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>) : isEditing ? "Salvar" : "Cadastrar"}
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>

        <DraftPromptDialog
          open={draftPromptOpen}
          label="cliente"
          savedAt={lastSaved}
          onResume={applyDraft}
          onDiscard={discardDraft}
        />



        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Excluir cliente"
          description={`Tem certeza que deseja excluir "${cliente?.nome}"? Esta ação não pode ser desfeita.`}
          confirmText="Excluir"
          onConfirm={handleDelete}
          isLoading={deleteLoading}
          variant="destructive"
        />

        {cliente && (
          <VeiculoFormModal
            open={veiculoModalOpen}
            onOpenChange={setVeiculoModalOpen}
            veiculo={veiculoParaEditar}
            clienteIdPadrao={cliente.id}
          />
        )}
      </>
    );
  }

  // ═══════════ DESKTOP: DIALOG ═══════════
  return (
    <>
      <Dialog open={open} onOpenChange={handleParentOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col bg-card border-border shadow-xl">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {HeaderContent}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 -mx-6 px-6 pb-1">
            {isEditing ? EditFormContent({ stickyFooter: false }) : NewFormContent({ stickyFooter: false })}
          </div>
        </DialogContent>
      </Dialog>

      <DraftPromptDialog
        open={draftPromptOpen}
        label="cliente"
        savedAt={lastSaved}
        onResume={applyDraft}
        onDiscard={discardDraft}
      />



      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir cliente"
        description={`Tem certeza que deseja excluir "${cliente?.nome}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        onConfirm={handleDelete}
        isLoading={deleteLoading}
        variant="destructive"
      />

      {cliente && (
        <VeiculoFormModal
          open={veiculoModalOpen}
          onOpenChange={setVeiculoModalOpen}
          veiculo={veiculoParaEditar}
          clienteIdPadrao={cliente.id}
          registerAsChild
        />
      )}
    </>
  );
}
