import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { 
  HelpCircle, 
  MessageCircle, 
  Mail, 
  FileText, 
  ExternalLink,
  Youtube,
  BookOpen,
  Lightbulb
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpModal({ open, onOpenChange }: HelpModalProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const helpOptions = [
    {
      icon: MessageCircle,
      title: "WhatsApp Suporte",
      description: "Tire suas dúvidas",
      action: () => {
        window.open("https://wa.me/5511950891497?text=Olá! Preciso de ajuda com o Mechanic Raiz Pro", "_blank");
      },
      color: "text-green-500",
      bgColor: "bg-green-500/10"
    },
    {
      icon: Mail,
      title: "E-mail",
      description: "suporte@mechanicraizpro.com.br",
      action: () => {
        window.location.href = "mailto:suporte@mechanicraizpro.com.br?subject=Suporte Mechanic Raiz Pro";
      },
      color: "text-blue-500",
      bgColor: "bg-blue-500/10"
    },
    {
      icon: BookOpen,
      title: "Central de Ajuda",
      description: "Tutoriais e guias",
      action: () => handleNavigate("/ajuda"),
      color: "text-purple-500",
      bgColor: "bg-purple-500/10"
    },
    {
      icon: Lightbulb,
      title: "Sugestões e Melhorias",
      description: "Envie suas ideias",
      action: () => {
        window.location.href = "mailto:suporte@mechanicraizpro.com.br?subject=💡 Sugestão de Melhoria - Mechanic Raiz Pro&body=Olá!%0A%0ATenho uma sugestão para o Mechanic Raiz Pro:%0A%0A";
      },
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10"
    },
    {
      icon: Youtube,
      title: "Vídeo Tutoriais",
      description: "Aprenda a usar o sistema",
      action: () => {
        window.open("https://www.youtube.com/@MechanicProBrasil", "_blank");
      },
      color: "text-red-500",
      bgColor: "bg-red-500/10"
    },
    {
      icon: FileText,
      title: "Termos de Uso",
      description: "Leia nossos termos",
      action: () => handleNavigate("/termos"),
      color: "text-muted-foreground",
      bgColor: "bg-muted"
    },
    {
      icon: FileText,
      title: "Política de Privacidade",
      description: "Como protegemos seus dados",
      action: () => handleNavigate("/privacidade"),
      color: "text-muted-foreground",
      bgColor: "bg-muted"
    }
  ];

  const FormContent = (
    <div className="space-y-4 px-1">
      <p className="text-sm text-muted-foreground">
        Escolha uma opção para obter ajuda
      </p>

      <div className="space-y-2">
        {helpOptions.map((option, index) => (
          <button
            key={index}
            onClick={option.action}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors text-left group"
          >
            <div className={`w-10 h-10 rounded-lg ${option.bgColor} flex items-center justify-center ${option.color} group-hover:scale-110 transition-transform`}>
              <option.icon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">{option.title}</p>
              <p className="text-sm text-muted-foreground">{option.description}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* FAQ Rápido */}
      <div className="mt-6 p-4 bg-muted/30 rounded-xl">
        <h4 className="font-semibold text-foreground mb-2">Perguntas Frequentes</h4>
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            <strong className="text-foreground">Como criar uma OS?</strong><br />
            Vá em Serviços → Nova OS e preencha os dados.
          </p>
          <p className="text-muted-foreground">
            <strong className="text-foreground">Como alterar meu plano?</strong><br />
            Acesse Configurações → Plano e Pagamento.
          </p>
          <p className="text-muted-foreground">
            <strong className="text-foreground">Posso usar no celular?</strong><br />
            Sim! O sistema funciona em qualquer dispositivo.
          </p>
        </div>
      </div>

      {/* Close button */}
      <div className="pt-4 pb-2">
        <Button 
          onClick={() => onOpenChange(false)}
          variant="outline"
          className="w-full h-12 text-base"
        >
          Fechar
        </Button>
      </div>
    </div>
  );

  const HeaderContent = (
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
        <HelpCircle className="w-5 h-5 text-accent" />
      </div>
      <span>Ajuda e Suporte</span>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
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
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {HeaderContent}
          </DialogTitle>
        </DialogHeader>
        {FormContent}
      </DialogContent>
    </Dialog>
  );
}
