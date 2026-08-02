import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Bell, MessageSquare, Package, Calendar, BarChart3, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOficinaConfiguracoes } from "@/hooks/useOficinaConfiguracoes";
import { useModalClose } from "@/hooks/useModalClose";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface NotificationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationsModal({ open, onOpenChange }: NotificationsModalProps) {
  const isMobile = useIsMobile();
  const { configuracoes, updateConfiguracoes } = useOficinaConfiguracoes();

  const [whatsappNotif, setWhatsappNotif] = useState(true);
  const [estoqueAlerta, setEstoqueAlerta] = useState(true);
  const [recorrenciaLembrete, setRecorrenciaLembrete] = useState(true);
  const [resumoDiario, setResumoDiario] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sem autosave: hidrata dos valores do banco por useEffect. `!!configuracoes`
  // seria true antes dos setState → snapshot pegaria defaults × banco =
  // falso-sujo. A flag garante o snapshot só após a hidratação.
  const [hydrated, setHydrated] = useState(false);

  // Sync state with database values when modal opens
  useEffect(() => {
    if (!open) {
      setHydrated(false);
      return;
    }
    if (configuracoes) {
      setWhatsappNotif(configuracoes.whatsapp_notificacoes ?? true);
      setEstoqueAlerta(configuracoes.estoque_alertas ?? true);
      setRecorrenciaLembrete(configuracoes.recorrencia_lembretes ?? true);
      setResumoDiario(configuracoes.resumo_diario ?? false);
      setHydrated(true);
    }
  }, [open, configuracoes]);

  const { handleOpenChange, confirmOpen, setConfirmOpen, confirmClose } = useModalClose({
    open,
    data: { whatsappNotif, estoqueAlerta, recorrenciaLembrete, resumoDiario },
    onOpenChange,
    snapshotReady: hydrated,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateConfiguracoes.mutateAsync({
        whatsapp_notificacoes: whatsappNotif,
        estoque_alertas: estoqueAlerta,
        recorrencia_lembretes: recorrenciaLembrete,
        resumo_diario: resumoDiario,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const notifications = [
    {
      icon: MessageSquare,
      title: "Notificações por WhatsApp",
      description: "Receba alertas de serviços e recorrências",
      checked: whatsappNotif,
      onChange: setWhatsappNotif
    },
    {
      icon: Package,
      title: "Alertas de Estoque Baixo",
      description: "Aviso quando itens atingirem quantidade mínima",
      checked: estoqueAlerta,
      onChange: setEstoqueAlerta
    },
    {
      icon: Calendar,
      title: "Lembrete de Recorrências",
      description: "Notificar sobre serviços que estão vencendo",
      checked: recorrenciaLembrete,
      onChange: setRecorrenciaLembrete
    },
    {
      icon: BarChart3,
      title: "Resumo Diário",
      description: "Receber resumo dos serviços do dia",
      checked: resumoDiario,
      onChange: setResumoDiario
    }
  ];

  const FormContent = (
    <div className="space-y-4 px-1">
      <p className="text-sm text-muted-foreground">
        Configure quais notificações você deseja receber
      </p>

      <div className="space-y-4">
        {notifications.map((notif, index) => (
          <div key={index}>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <notif.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">{notif.title}</p>
                  <p className="text-xs text-muted-foreground">{notif.description}</p>
                </div>
              </div>
              <Switch checked={notif.checked} onCheckedChange={notif.onChange} />
            </div>
            {index < notifications.length - 1 && <Separator />}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 pb-2">
        <Button 
          type="button" 
          variant="outline"
          onClick={() => handleOpenChange(false)}
          className="flex-1 h-12 text-base"
          disabled={saving}
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSave}
          disabled={saving}
          className="flex-1 h-12 text-base font-semibold bg-accent hover:bg-accent/90"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Salvar"}
        </Button>
      </div>
    </div>
  );

  const HeaderContent = (
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
        <Bell className="w-5 h-5 text-accent" />
      </div>
      <span>Notificações</span>
    </div>
  );

  const sairSemSalvar = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title="Sair sem salvar?"
      description="Você alterou as preferências de notificação e não salvou. As alterações serão descartadas."
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
