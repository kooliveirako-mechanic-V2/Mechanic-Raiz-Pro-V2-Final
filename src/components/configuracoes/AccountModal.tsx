import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, User, Mail } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useModalClose } from "@/hooks/useModalClose";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface AccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountModal({ open, onOpenChange }: AccountModalProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState(user?.user_metadata?.nome || "");

  // Único campo editável é `nome` (email é readonly). Inicializa síncrono no
  // useState → snapshotReady default. Voltar ao valor original desfaz o sujo.
  const { handleOpenChange, confirmOpen, setConfirmOpen, confirmClose } = useModalClose({
    open,
    data: { nome },
    onOpenChange,
    onReset: () => setNome(user?.user_metadata?.nome || ""),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { nome }
      });

      if (error) throw error;

      toast.success("Dados atualizados com sucesso!");
      onOpenChange(false);
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : undefined;
      toast.error("Erro ao atualizar", { description });
    } finally {
      setLoading(false);
    }
  };

  const FormContent = (
    <form onSubmit={handleSubmit} className="space-y-4 px-1">
      {/* Email - readonly */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-base">E-mail</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            value={user?.email || ""}
            className="pl-10 h-12 text-base bg-muted"
            disabled
          />
        </div>
        <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado</p>
      </div>

      {/* Nome */}
      <div className="space-y-2">
        <Label htmlFor="nome" className="text-base">Nome *</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            id="nome"
            placeholder="Seu nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="pl-10 h-12 text-base"
            required
          />
        </div>
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
          disabled={loading || !nome.trim()} 
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
        <User className="w-5 h-5 text-accent" />
      </div>
      <span>Minha Conta</span>
    </div>
  );

  const sairSemSalvar = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title="Sair sem salvar?"
      description="Você alterou seu nome e não salvou. A alteração será descartada."
      confirmText="Descartar"
      cancelText="Continuar editando"
      onConfirm={confirmClose}
    />
  );

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
          <div className="overflow-y-auto overscroll-contain touch-pan-y" style={{ WebkitOverflowScrolling: "touch" }}>
            {FormContent}
          </div>
        </DrawerContent>
      </Drawer>
      {sairSemSalvar}
      </>
    );
  }

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
    {sairSemSalvar}
    </>
  );
}
