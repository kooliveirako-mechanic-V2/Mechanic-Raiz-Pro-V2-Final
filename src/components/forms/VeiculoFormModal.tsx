import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVeiculos, Veiculo, VeiculoInput } from "@/hooks/useVeiculos";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOficina } from "@/contexts/OficinaContext";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ClienteSelectWithCreate } from "./ClienteSelectWithCreate";
import { HistoricoEletricoTimeline } from "@/components/veiculos/HistoricoEletricoTimeline";
import { Loader2, Car, Bike, Truck, Bus, Tractor, Trash2, Zap, FileText } from "lucide-react";
import { VehicleBrandModelSelect } from "./VehicleBrandModelSelect";
import { z } from "zod";
import { toast } from "sonner";
import { handleFormKeyDown } from "@/lib/formGuard";
import { useAutoSave } from "@/hooks/useAutoSave";

const veiculoSchema = z.object({
  cliente_id: z.string().min(1, "Selecione um cliente"),
  tipo: z.enum(["carro", "moto", "caminhao", "van", "onibus", "agricola"]),
  marca: z.string().trim().min(1, "Marca é obrigatória").max(50, "Máximo 50 caracteres"),
  modelo: z.string().trim().min(1, "Modelo é obrigatório").max(50, "Máximo 50 caracteres"),
  ano: z.number().min(1900).max(new Date().getFullYear() + 1).optional().nullable(),
  placa: z.string().trim().max(10, "Máximo 10 caracteres").optional().or(z.literal("")),
  km_atual: z.number().min(0).optional().nullable(),
  chassi: z.string().trim().max(20, "Máximo 20 caracteres").optional().or(z.literal("")),
  cor: z.string().trim().max(30, "Máximo 30 caracteres").optional().or(z.literal("")),
  observacoes: z.string().trim().max(500, "Máximo 500 caracteres").optional().or(z.literal("")),

});

interface VeiculoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  veiculo?: Veiculo | null;
  clienteIdPadrao?: string;
}

export function VeiculoFormModal({ open, onOpenChange, veiculo, clienteIdPadrao }: VeiculoFormModalProps) {
  const { createVeiculo, updateVeiculo, deleteVeiculo } = useVeiculos();
  const { oficinaAtual } = useOficina();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const tipoOficina = oficinaAtual?.tipo || "ambos";
  const isAutoEletrica = tipoOficina === "auto_eletrica";
  const tipoDefault: "carro" | "moto" = tipoOficina === "carro" ? "carro" : tipoOficina === "moto" ? "moto" : "moto";
  
  const showCarro = tipoOficina === "carro" || tipoOficina === "ambos";
  const showMoto = tipoOficina === "moto" || tipoOficina === "ambos";
  
  const [clienteId, setClienteId] = useState("");
  const [tipo, setTipo] = useState<"carro" | "moto">(tipoDefault);
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [placa, setPlaca] = useState("");
  const [kmAtual, setKmAtual] = useState("");
  const [chassi, setChassi] = useState("");
  const [cor, setCor] = useState("");
  const [observacoes, setObservacoes] = useState("");


  const isEditing = !!veiculo;
  const formId = "veiculo-form";

  // ─── AutoSave: persiste rascunho APENAS em modo "novo" ───────────
  const draftData = useMemo(() => ({
    clienteId, tipo, marca, modelo, ano, placa, kmAtual, chassi, cor, observacoes,
  }), [clienteId, tipo, marca, modelo, ano, placa, kmAtual, chassi, cor, observacoes]);


  const { hasDraft, restore, clearDraft } = useAutoSave({
    key: `veiculo-form-${oficinaAtual?.id || "global"}-new`,
    data: draftData,
    enabled: open && !isEditing,
    interval: 1500,
  });

  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (veiculo) {
      setClienteId(veiculo.cliente_id);
      setTipo(veiculo.tipo);
      setMarca(veiculo.marca);
      setModelo(veiculo.modelo);
      setAno(veiculo.ano?.toString() || "");
      setPlaca(veiculo.placa || "");
      setKmAtual(veiculo.km_atual?.toString() || "");
      setChassi(veiculo.chassi || "");
      setCor((veiculo as any).cor || "");
      setObservacoes(veiculo.observacoes || "");

    } else if (open) {
      // Tenta restaurar rascunho de novo veículo
      if (hasDraft && !hasRestoredRef.current) {
        hasRestoredRef.current = true;
        const saved = restore() as typeof draftData | null;
        if (saved) {
          setClienteId(saved.clienteId || clienteIdPadrao || "");
          setTipo(saved.tipo || tipoDefault);
          setMarca(saved.marca || "");
          setModelo(saved.modelo || "");
          setAno(saved.ano || "");
          setPlaca(saved.placa || "");
          setKmAtual(saved.kmAtual || "");
          setChassi(saved.chassi || "");
          setCor(saved.cor || "");
          setObservacoes(saved.observacoes || "");

          setErrors({});
          return;
        }
      }
      setClienteId(clienteIdPadrao || "");
      setTipo(tipoDefault);
      setMarca("");
      setModelo("");
      setAno("");
      setPlaca("");
      setKmAtual("");
      setChassi("");
      setCor("");
      setObservacoes("");

    }
    if (!open) hasRestoredRef.current = false;
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veiculo, clienteIdPadrao, open, tipoDefault]);

  const scrollToFirstError = useCallback((fieldErrors: Record<string, string>) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setTimeout(() => {
      const firstKey = Object.keys(fieldErrors)[0];
      if (!firstKey) return;
      const el = document.getElementById(firstKey) || document.querySelector(`[id*="${firstKey}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => (el as HTMLElement).focus?.(), 400);
      }
    }, 150);
  }, []);

  const validateForm = (): { valid: boolean; errorCount: number } => {
    const result = veiculoSchema.safeParse({
      cliente_id: clienteId,
      tipo,
      marca,
      modelo,
      ano: ano ? parseInt(ano) : null,
      placa,
      km_atual: kmAtual ? parseInt(kmAtual) : null,
      chassi,
      cor,
      observacoes,

    });
    
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      
      const count = Object.keys(fieldErrors).length;
      if (count > 0) {
        scrollToFirstError(fieldErrors);
      }
      return { valid: false, errorCount: count };
    }
    
    setErrors({});
    return { valid: true, errorCount: 0 };
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
    
    setLoading(true);

    try {
      const data: VeiculoInput = {
        cliente_id: clienteId,
        tipo,
        marca: marca.trim(),
        modelo: modelo.trim(),
        ano: ano ? parseInt(ano) : undefined,
        placa: placa.trim().toUpperCase() || undefined,
        km_atual: kmAtual ? parseInt(kmAtual) : undefined,
        chassi: chassi.trim() || undefined,
        cor: cor.trim() || undefined,
        observacoes: observacoes.trim() || undefined,

      };

      if (isEditing && veiculo) {
        await updateVeiculo.mutateAsync({ id: veiculo.id, ...data });
      } else {
        await createVeiculo.mutateAsync(data);
      }

      clearDraft();
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!veiculo) return;
    
    setDeleteLoading(true);
    try {
      await deleteVeiculo.mutateAsync(veiculo.id);
      setDeleteDialogOpen(false);
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    } finally {
      setDeleteLoading(false);
    }
  };

  const FormFields = ({ stickyFooter }: { stickyFooter?: boolean }) => (
    <>
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

      <div className="space-y-2">
        <Label>Cliente *</Label>
        <ClienteSelectWithCreate
          value={clienteId}
          onValueChange={setClienteId}
          required
          error={errors.cliente_id}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo *</Label>
          {!showCarro || !showMoto ? (
            <div className="flex items-center gap-2 h-12 px-3 border rounded-md bg-muted/30">
              {showMoto ? <Bike className="w-4 h-4" /> : <Car className="w-4 h-4" />}
              <span>{showMoto ? "Moto" : "Carro"}</span>
            </div>
          ) : (
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoVeiculo)}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                <SelectItem value="carro">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4" /> Carro
                  </div>
                </SelectItem>
                <SelectItem value="moto">
                  <div className="flex items-center gap-2">
                    <Bike className="w-4 h-4" /> Moto
                  </div>
                </SelectItem>
                <SelectItem value="caminhao">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4" /> Caminhão
                  </div>
                </SelectItem>
                <SelectItem value="van">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4" /> Van
                  </div>
                </SelectItem>
                <SelectItem value="onibus">
                  <div className="flex items-center gap-2">
                    <Bus className="w-4 h-4" /> Ônibus
                  </div>
                </SelectItem>
                <SelectItem value="agricola">
                  <div className="flex items-center gap-2">
                    <Tractor className="w-4 h-4" /> Agrícola
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ano">Ano</Label>
          <Input id="ano" type="number" placeholder="2024" value={ano} onChange={(e) => setAno(e.target.value)}
            min={1900} max={new Date().getFullYear() + 1} className={`h-12 text-base ${errors.ano ? "border-destructive" : ""}`} />
          {errors.ano && <p className="text-xs text-destructive">{errors.ano}</p>}
        </div>
      </div>

      <VehicleBrandModelSelect
        tipo={tipo}
        marca={marca}
        modelo={modelo}
        onMarcaChange={setMarca}
        onModeloChange={setModelo}
        marcaError={errors.marca}
        modeloError={errors.modelo}
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="placa">Placa</Label>
          <Input id="placa" placeholder="ABC-1234" value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())}
            maxLength={10} className="h-12 text-base" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="km_atual">KM Atual</Label>
          <Input id="km_atual" type="number" placeholder="50000" value={kmAtual} onChange={(e) => setKmAtual(e.target.value)}
            min={0} className="h-12 text-base" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="chassi">Chassi</Label>
          <Input id="chassi" placeholder="Número do chassi" value={chassi} onChange={(e) => setChassi(e.target.value)}
            maxLength={20} className="h-12 text-base" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cor">Cor</Label>
          <Input id="cor" placeholder="Ex: Preto, Vermelho..." value={cor} onChange={(e) => setCor(e.target.value)}
            maxLength={30} className="h-12 text-base" />
        </div>
      </div>


      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" placeholder="Observações sobre o veículo..." value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)} rows={2} maxLength={500} className="text-base" />
        <p className="text-xs text-muted-foreground text-right">{observacoes.length}/500</p>
      </div>

      {/* Desktop: buttons inside form; Mobile: rendered separately as sticky footer */}
      {!stickyFooter && (
        <div className="flex justify-between gap-2 pt-4 pb-2">
          <div>
            {isEditing && (
              <Button type="button" variant="ghost" onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-12">
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-12">
              Cancelar
            </Button>
            <Button type="submit" className="bg-accent hover:bg-accent/90 h-12 font-semibold" disabled={loading}>
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
              ) : isEditing ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </div>
      )}
    </>
  );

  const ModalContent = ({ stickyFooter }: { stickyFooter?: boolean }) => {
    if (isEditing && isAutoEletrica) {
      return (
        <Tabs defaultValue="dados" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="dados" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Dados
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Histórico Elétrico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dados">
            <form id={formId} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-4">
              <FormFields stickyFooter={stickyFooter} />
            </form>
          </TabsContent>

          <TabsContent value="historico">
            <div className="max-h-[500px] pr-4 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
              <HistoricoEletricoTimeline 
                veiculoId={veiculo!.id}
                veiculoInfo={{
                  marca: veiculo!.marca,
                  modelo: veiculo!.modelo,
                  placa: veiculo!.placa || undefined,
                }}
              />
            </div>
          </TabsContent>
        </Tabs>
      );
    }

    return (
      <form id={formId} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-4">
        <FormFields stickyFooter={stickyFooter} />
      </form>
    );
  };

  const HeaderContent = (
    <div className="flex items-center gap-2">
      <Car className="w-5 h-5 text-accent" />
      {isEditing ? "Editar Veículo" : "Novo Veículo"}
    </div>
  );

  // ═══════════ MOBILE: DRAWER ═══════════
  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="px-4 pb-0 max-h-[90dvh] flex flex-col">
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

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 min-h-0 touch-pan-y pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
              <ModalContent stickyFooter />
            </div>

            {/* Sticky footer — always visible above keyboard */}
            <div className="flex-shrink-0 border-t border-border bg-background pt-3 pb-[max(env(safe-area-inset-bottom),12px)] flex justify-between gap-2">
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

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Excluir veículo"
          description={`Tem certeza que deseja excluir "${veiculo?.marca} ${veiculo?.modelo}"? Esta ação não pode ser desfeita.`}
          confirmText="Excluir"
          onConfirm={handleDelete}
          isLoading={deleteLoading}
          variant="destructive"
        />
      </>
    );
  }

  // ═══════════ DESKTOP: DIALOG ═══════════
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={`${isEditing && isAutoEletrica ? "sm:max-w-2xl" : "sm:max-w-lg"} max-h-[90vh] flex flex-col`}>
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {HeaderContent}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 -mx-6 px-6 pb-1">
            <ModalContent stickyFooter={false} />
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir veículo"
        description={`Tem certeza que deseja excluir "${veiculo?.marca} ${veiculo?.modelo}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        onConfirm={handleDelete}
        isLoading={deleteLoading}
        variant="destructive"
      />
    </>
  );
}
