import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Shield, Eye, EyeOff, Lock } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useModalClose } from "@/hooks/useModalClose";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface SecurityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SecurityModal({ open, onOpenChange }: SecurityModalProps) {
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // SEGURANÇA: o snapshot NÃO retém o valor da senha — só flags "campo
  // preenchido?". Basta para detectar sujo, sem manter texto sensível em
  // snapshotRef nem arriscar vazamento em log/erro.
  const { handleOpenChange, confirmOpen, setConfirmOpen, confirmClose } = useModalClose({
    open,
    data: { temNova: newPassword.length > 0, temConfirm: confirmPassword.length > 0 },
    onOpenChange,
    onReset: () => {
      setNewPassword("");
      setConfirmPassword("");
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
      onOpenChange(false);
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : undefined;
      toast.error("Erro ao alterar senha", { description });
    } finally {
      setLoading(false);
    }
  };

  const FormContent = (
    <form onSubmit={handleSubmit} className="space-y-4 px-1">
      {/* Nova Senha */}
      <div className="space-y-2">
        <Label htmlFor="newPassword" className="text-base">Nova Senha *</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            id="newPassword"
            type={showNewPassword ? "text" : "password"}
            placeholder="Mínimo 6 caracteres"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="pl-10 pr-10 h-12 text-base"
            required
            minLength={6}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowNewPassword(!showNewPassword)}
          >
            {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Confirmar Senha */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-base">Confirmar Senha *</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Digite a senha novamente"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="pl-10 pr-10 h-12 text-base"
            required
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {confirmPassword && newPassword !== confirmPassword && (
          <p className="text-xs text-destructive">As senhas não coincidem</p>
        )}
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
          disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword} 
          className="flex-1 h-12 text-base font-semibold bg-accent hover:bg-accent/90"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Alterar Senha"}
        </Button>
      </div>
    </form>
  );

  const HeaderContent = (
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
        <Shield className="w-5 h-5 text-accent" />
      </div>
      <span>Segurança</span>
    </div>
  );

  const sairSemSalvar = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title="Sair sem salvar?"
      description="Você começou a alterar a senha e não concluiu. Os campos serão limpos."
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
          <div className="overflow-y-auto">
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
