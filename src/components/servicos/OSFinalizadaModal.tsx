import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { useItensOS } from "@/hooks/useItensOS";
import { openWhatsAppOS } from "@/lib/whatsapp";
import { getPublicOSLink } from "@/utils/url";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/lib/formatters";
import { OSStatusTimeline } from "./OSStatusTimeline";
import { 
  CheckCircle2, 
  MessageCircle, 
  Link2, 
  Edit2, 
  ArrowLeft, 
  Car, 
  Bike, 
  User, 
  Calendar, 
  Wrench,
  DollarSign,
  Shield,
  Package,
  ExternalLink,
  Send,
  Sparkles,
  Printer
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OSFinalizadaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordem: OrdemServico | null;
  oficinaNome?: string;
  oficinaTelefone?: string;
  onEdit?: () => void;
}

export function OSFinalizadaModal({
  open,
  onOpenChange,
  ordem,
  oficinaNome,
  oficinaTelefone,
  onEdit,
}: OSFinalizadaModalProps) {
  const isMobile = useIsMobile();
  const { itens, totalItens } = useItensOS(ordem?.id);
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [manualPhone, setManualPhone] = useState("");

  if (!ordem) return null;

  const isMoto = ordem.veiculo?.tipo === "moto";
  // CAUSA RAIZ: valor_servico JÁ inclui itens (via recalcOSTotals). Não somar novamente.
  const valorTotal = (ordem.valor_servico || 0) > 0 ? (ordem.valor_servico || 0) : totalItens;
  const hasClientPhone = !!ordem.cliente?.telefone;
  
  const handleWhatsApp = (phoneOverride?: string) => {
    const phone = phoneOverride || manualPhone || "";
    if (!hasClientPhone && !phone) {
      setShowPhoneInput(true);
      return;
    }
    openWhatsAppOS(ordem, oficinaNome || "Oficina", oficinaTelefone, itens, phone || undefined);
    setWhatsappSent(true);
    setShowPhoneInput(false);
    toast.success("OS enviada por WhatsApp!", {
      description: "O cliente receberá os detalhes do serviço.",
      duration: 4000,
    });
  };

  const handleCopyLink = () => {
    const url = getPublicOSLink(ordem);
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!", {
      description: "Envie para o cliente acompanhar o serviço.",
    });
  };

  const handleOpenPublic = () => {
    window.open(getPublicOSLink(ordem), "_blank");
  };

  const formatDate = (date: string) => {
    try {
      return format(new Date(date + "T12:00:00"), "dd 'de' MMMM, yyyy", { locale: ptBR });
    } catch {
      return date;
    }
  };

  const Content = (
    <div className="space-y-4 p-1">
      {/* Header de Sucesso com Confete */}
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center py-4"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.1 }}
          className="w-20 h-20 mx-auto rounded-full bg-success/10 flex items-center justify-center mb-3 relative"
        >
          <CheckCircle2 className="w-10 h-10 text-success" />
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="absolute -top-1 -right-1"
          >
            <Sparkles className="w-6 h-6 text-amber-500" />
          </motion.div>
        </motion.div>
        <h3 className="text-xl font-bold text-foreground">
          {ordem.status === "finalizado" ? "OS Finalizada!" : "Ordem de Serviço"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {ordem.status === "finalizado" 
            ? "Serviço concluído e registrado no financeiro ✓"
            : `Status: ${ordem.status === "em_andamento" ? "Em Andamento" : ordem.status}`
          }
        </p>
      </motion.div>

      {/* Timeline de Status */}
      <OSStatusTimeline 
        status={ordem.status} 
        whatsappEnviado={whatsappSent}
        pagamentoStatus="pendente"
      />

      {/* Dados do Cliente/Veículo */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isMoto ? "bg-accent/10" : "bg-primary/10"}`}>
              {isMoto ? <Bike className="w-5 h-5 text-accent" /> : <Car className="w-5 h-5 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">
                {ordem.veiculo?.marca} {ordem.veiculo?.modelo}
              </p>
              {ordem.veiculo?.placa && (
                <p className="text-xs text-muted-foreground">Placa: {ordem.veiculo.placa}</p>
              )}
            </div>
          </div>
          
          <Separator />
          
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground font-medium">{ordem.cliente?.nome}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">{formatDate(ordem.data_servico)}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Wrench className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">{ordem.tipo_servico}</span>
          </div>
        </CardContent>
      </Card>

      {/* Itens/Serviços */}
      {itens.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-accent" />
              <span className="font-semibold text-sm">Itens do Serviço</span>
            </div>
            <div className="space-y-2">
              {itens.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {item.quantidade}x {item.nome_item}
                  </span>
                  <span className="font-medium flex-shrink-0 whitespace-nowrap">
                    {formatCurrency(item.valor_total || 0)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Valor Total - Destaque */}
      <Card className="bg-accent/5 border-accent/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-accent" />
              <span className="font-semibold">Valor Total</span>
            </div>
            <span className="text-2xl font-bold text-accent">
              {formatCurrency(valorTotal)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Garantia */}
      {ordem.tem_garantia && (
        <div className="flex items-center gap-3 p-3 bg-success/5 border border-success/20 rounded-lg">
          <Shield className="w-5 h-5 text-success" />
          <div>
            <p className="text-sm font-medium text-success">Com Garantia</p>
            <p className="text-xs text-muted-foreground">{ordem.dias_garantia} dias</p>
          </div>
        </div>
      )}

      {/* Feedback de WhatsApp enviado */}
      <AnimatePresence>
        {whatsappSent && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-3 bg-success/10 border border-success/20 rounded-lg text-center"
          >
            <div className="flex items-center justify-center gap-2 text-success">
              <CheckCircle2 className="w-5 h-5" />
              <p className="text-sm font-medium">
                OS enviada por WhatsApp com sucesso!
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phone Input Fallback */}
      {showPhoneInput && !hasClientPhone && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-3 space-y-2">
            <p className="text-sm font-medium text-foreground">Informe o telefone do cliente:</p>
            <div className="flex gap-2">
              <Input
                type="tel"
                placeholder="(11) 99999-9999"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                className="text-base h-11"
              />
              <Button
                onClick={() => handleWhatsApp(manualPhone)}
                disabled={!manualPhone || manualPhone.replace(/\D/g, "").length < 10}
                className="h-11 bg-green-600 hover:bg-green-700 text-white shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ações Principais */}
      <div className="space-y-2 pt-2">
        <Button
          onClick={() => handleWhatsApp()}
          className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold shadow-lg"
        >
          <Send className="w-5 h-5 mr-2" />
          Enviar por WhatsApp
        </Button>

        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            onClick={handleCopyLink}
            className="h-11"
          >
            <Link2 className="w-4 h-4 mr-1" />
            <span className="text-xs">Link</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleOpenPublic}
            className="h-11"
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            <span className="text-xs">Ver</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(`/os/${ordem.id}?print=true`, "_blank")}
            className="h-11"
          >
            <Printer className="w-4 h-4 mr-1" />
            <span className="text-xs">PDF</span>
          </Button>
        </div>

        <Separator className="my-2" />

        <div className="grid grid-cols-2 gap-2">
          {onEdit && (
            <Button
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
                onEdit();
              }}
              className="h-11"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Editar OS
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className={onEdit ? "h-11" : "h-11 col-span-2"}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-4 pb-6 max-h-[95dvh]">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30 mx-auto mt-2 mb-1" />
          <DrawerHeader className="text-left px-0 sr-only">
            <DrawerTitle>OS Finalizada</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto max-h-[calc(95dvh-60px)] overscroll-contain touch-pan-y" style={{ WebkitOverflowScrolling: "touch" }}>
            {Content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>OS Finalizada</DialogTitle>
        </DialogHeader>
        {Content}
      </DialogContent>
    </Dialog>
  );
}
