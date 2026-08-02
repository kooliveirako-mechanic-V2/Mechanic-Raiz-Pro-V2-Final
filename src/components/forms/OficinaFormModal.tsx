import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";
import { Loader2, Building2, Phone, MapPin, Car, Bike, Zap } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { handleFormKeyDown } from "@/lib/formGuard";
import { useModalClose } from "@/hooks/useModalClose";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface OficinaFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OficinaFormModal({ open, onOpenChange }: OficinaFormModalProps) {
  const { oficinaAtual, refetch } = useOficina();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [tipo, setTipo] = useState("ambos");

  // Sinal para o useModalClose: a hidratação abaixo terminou. `!!oficinaAtual`
  // não serve — é verdadeiro no render em que o contexto chega, ANTES deste
  // useEffect preencher os campos; o snapshot pegaria vazio e a hidratação
  // viraria "edição" (falso-sujo em toda abertura).
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!open) {
      setHydrated(false);
      return;
    }
    if (oficinaAtual) {
      setNome(oficinaAtual.nome);
      setTelefone(oficinaAtual.telefone || "");
      setEndereco(oficinaAtual.endereco || "");
      setTipo(oficinaAtual.tipo);
      setHydrated(true);
    }
  }, [oficinaAtual, open]);

  const { handleOpenChange, confirmOpen, setConfirmOpen, confirmClose } = useModalClose({
    open,
    data: { nome, telefone, endereco, tipo, loading },
    onOpenChange,
    ignoreKeys: ["loading"], // flag de UI durante o submit
    snapshotReady: hydrated,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oficinaAtual || !nome) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("oficinas")
        .update({
          nome,
          telefone: telefone || null,
          endereco: endereco || null,
          tipo,
        })
        .eq("id", oficinaAtual.id);

      if (error) throw error;

      await refetch();
      toast.success("Oficina atualizada com sucesso!");
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao atualizar", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const FormContent = (
    <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-4 px-1">
      {/* Nome */}
      <div className="space-y-2">
        <Label htmlFor="nome" className="text-base">Nome da Oficina *</Label>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            id="nome"
            placeholder="Nome da sua oficina"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="pl-10 h-12 text-base"
            required
          />
        </div>
      </div>

      {/* Telefone */}
      <div className="space-y-2">
        <Label htmlFor="telefone" className="text-base">Telefone / WhatsApp</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            id="telefone"
            type="tel"
            inputMode="tel"
            placeholder="(11) 99999-9999"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>
      </div>

      {/* Endereço */}
      <div className="space-y-2">
        <Label htmlFor="endereco" className="text-base">Endereço</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            id="endereco"
            placeholder="Rua, número, bairro, cidade"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>
      </div>

      {/* Tipo de Oficina */}
      <div className="space-y-2">
        <Label className="text-base">Tipo de Oficina</Label>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="h-12 text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[60vh]">
            <SelectItem value="carro" className="text-base py-3">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4" />
                Apenas Carros
              </div>
            </SelectItem>
            <SelectItem value="moto" className="text-base py-3">
              <div className="flex items-center gap-2">
                <Bike className="w-4 h-4" />
                Apenas Motos
              </div>
            </SelectItem>
            <SelectItem value="ambos" className="text-base py-3">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4" />
                <Bike className="w-4 h-4" />
                Carros e Motos
              </div>
            </SelectItem>
            <SelectItem value="auto_eletrica" className="text-base py-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Auto Elétrica
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 pb-2">
        <Button 
          type="button"
          variant="outline"
          onClick={() => handleOpenChange(false)}
          className="flex-1 h-12 text-base"
        >
          Cancelar
        </Button>
        <Button 
          type="submit" 
          disabled={loading || !nome} 
          className="flex-1 h-12 text-base font-semibold bg-accent hover:bg-accent/90"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Salvar"}
        </Button>
      </div>
    </form>
  );

  const HeaderContent = (
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
        <Building2 className="w-5 h-5 text-accent" />
      </div>
      <span>Dados da Oficina</span>
    </div>
  );

  const CloseConfirm = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title="Sair sem salvar?"
      description="Você alterou os dados da oficina e não salvou. As alterações serão descartadas."
      confirmText="Descartar"
      cancelText="Continuar editando"
      onConfirm={confirmClose}
    />
  );

  // Mobile: Drawer from bottom
  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent className="px-4 pb-6 max-h-[90dvh]">
            <DrawerHeader className="text-left px-0">
              <DrawerTitle className="flex items-center gap-2 text-lg">
                {HeaderContent}
              </DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto">
              {FormContent}
            </div>
          </DrawerContent>
        </Drawer>
        {CloseConfirm}
      </>
    );
  }

  // Desktop: Dialog
  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {HeaderContent}
            </DialogTitle>
          </DialogHeader>
          {FormContent}
        </DialogContent>
      </Dialog>
      {CloseConfirm}
    </>
  );
}
