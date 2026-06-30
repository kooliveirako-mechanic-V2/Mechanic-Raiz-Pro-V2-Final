import { useState, useRef } from "react";
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
import { openWhatsAppOS, getPublicOSLink } from "@/lib/whatsapp";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/lib/formatters";
import { OSStatusTimeline } from "./OSStatusTimeline";
import { 
  CheckCircle2, 
  MessageCircle, 
  Link2, 
  FileText, 
  Car, 
  Bike, 
  User, 
  Calendar, 
  Wrench,
  DollarSign,
  Shield,
  Package,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  Clock,
  X,
  Printer,
  Send
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OSVisualizacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordem: OrdemServico | null;
  oficinaNome?: string;
  oficinaTelefone?: string;
  onEdit?: () => void;
}

export function OSVisualizacaoModal({
  open,
  onOpenChange,
  ordem,
  oficinaNome,
  oficinaTelefone,
  onEdit,
}: OSVisualizacaoModalProps) {
  const isMobile = useIsMobile();
  const { itens, totalItens } = useItensOS(ordem?.id);
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [manualPhone, setManualPhone] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  if (!ordem) return null;

  const isMoto = ordem.veiculo?.tipo === "moto";
  // CAUSA RAIZ: valor_servico JÁ inclui itens (via recalcOSTotals). Não somar novamente.
  // P1 FIX: Garantir que o valor exibido é o valor real cobrado (Total Mestre).
  const subtotalBruto = Number(ordem.valor_servico || 0);
  const descontoOS = Number((ordem as any).desconto || 0);
  const descontoMotivo = (ordem as any).desconto_motivo as string | null | undefined;
  const valorTotal = Math.max(subtotalBruto - (descontoOS > 0 ? descontoOS : 0), 0);
  const maoDeObraGlobal = Number((ordem as any).valor_mao_obra || 0);
  const maoDeObraItemizada = itens.reduce((acc, item) => acc + Number(item.valor_mao_obra || 0), 0);
  const maoDeObraAvulsa = Math.max(0, maoDeObraGlobal - maoDeObraItemizada);
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
    window.open(`/os/${ordem.id}`, "_blank");
  };

  const handlePrint = () => {
    // Open print-friendly version
    window.open(`/os/${ordem.id}?print=true`, "_blank");
  };

  const formatDate = (date: string) => {
    try {
      return format(new Date(date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return date;
    }
  };

  const formatDateFull = (date: string) => {
    try {
      return format(new Date(date + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return date;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { label: string; className: string }> = {
      pendente: { label: "Aguardando", className: "bg-warning/15 text-warning border-warning/30" },
      em_diagnostico: { label: "Em Diagnóstico", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
      em_andamento: { label: "Em Andamento", className: "bg-info/15 text-info border-info/30" },
      aguardando_peca: { label: "Aguard. Peça", className: "bg-orange-500/15 text-orange-500 border-orange-500/30" },
      finalizado: { label: "Finalizado", className: "bg-success/15 text-success border-success/30" },
      cancelado: { label: "Cancelado", className: "bg-destructive/15 text-destructive border-destructive/30" },
    };
    return labels[status] || { label: status, className: "bg-muted" };
  };

  const statusInfo = getStatusLabel(ordem.status);

  const Content = (
    <div className="space-y-4" ref={printRef}>
      {/* Header com Logo/Nome da Oficina */}
      <div className="text-center py-3 border-b border-dashed border-border">
        <h2 className="text-lg font-bold text-foreground">{oficinaNome || "Oficina"}</h2>
        {oficinaTelefone && (
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
            <Phone className="w-3 h-3" />
            {oficinaTelefone}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-2">
          ORDEM DE SERVIÇO
        </p>
      </div>

      {/* Status Visual Timeline */}
      <OSStatusTimeline 
        status={ordem.status} 
        whatsappEnviado={whatsappSent}
        pagamentoStatus="pendente"
      />

      {/* Badge de Status */}
      <div className="flex items-center justify-center gap-2">
        <Badge variant="outline" className={statusInfo.className}>
          {statusInfo.label}
        </Badge>
        {ordem.tem_garantia && (
          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
            <Shield className="w-3 h-3 mr-1" />
            Garantia {ordem.dias_garantia}d
          </Badge>
        )}
      </div>

      {/* Dados do Cliente */}
      <Card className="bg-muted/20">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <User className="w-4 h-4 text-primary" />
            <span>{ordem.cliente?.nome || "Cliente"}</span>
          </div>
          {ordem.cliente?.telefone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
              <Phone className="w-3 h-3" />
              <span>{ordem.cliente.telefone}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dados do Veículo */}
      <Card className="bg-muted/20">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isMoto ? "bg-accent/10" : "bg-primary/10"}`}>
              {isMoto ? <Bike className="w-5 h-5 text-accent" /> : <Car className="w-5 h-5 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">
                {ordem.veiculo?.marca} {ordem.veiculo?.modelo}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {ordem.veiculo?.placa && (
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                    {ordem.veiculo.placa}
                  </span>
                )}
                {ordem.km_no_servico && (
                  <span>{ordem.km_no_servico.toLocaleString()} km</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info do Serviço */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Wrench className="w-4 h-4 text-accent" />
            <span className="font-medium">{ordem.tipo_servico}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{formatDateFull(ordem.data_servico)}</span>
          </div>
          {ordem.descricao && (
            <p className="text-sm text-muted-foreground pt-1 border-t border-dashed">
              {ordem.descricao}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Itens — 3 blocos distintos: Serviços / Peças / Mão de Obra */}
      {(() => {
        const servicosBase = itens.filter((i) => (i.tipo ?? (i.estoque_id ? "produto" : "servico")) === "servico");
        const produtos = itens.filter((i) => (i.tipo ?? (i.estoque_id ? "produto" : "servico")) === "produto");

        // 1️⃣ SERVIÇOS — apenas serviços puros, com seu valor próprio
        const servicoRows = servicosBase.map((i) => ({
          id: `s-${i.id}`,
          nome: i.nome_item,
          valor: Number(i.valor_mao_obra ?? 0) > 0 ? Number(i.valor_mao_obra) : Number(i.valor_total ?? 0),
        }));

        // 2️⃣ PEÇAS — nome, quantidade, valor unit., subtotal
        const pecaRows = produtos.map((i) => ({
          id: i.id,
          nome: i.nome_item,
          quantidade: Number(i.quantidade || 0),
          valor_unitario: Number(i.valor_unitario || 0),
          subtotal: Number(i.quantidade || 0) * Number(i.valor_unitario || 0),
        }));

        // 3️⃣ MÃO DE OBRA — apenas vinculada a peças + avulsa
        // (a MO dos serviços já aparece como o próprio valor do serviço no bloco 1, evita duplicação visual)
        const moRows: Array<{ id: string; origem: string; nome: string; valor: number; tipo: "servico" | "peca" | "avulsa" }> = [
          ...produtos
            .filter((i) => Number(i.valor_mao_obra ?? 0) > 0)
            .map((i) => ({
              id: `mo-p-${i.id}`,
              origem: "Peça",
              nome: i.nome_item,
              valor: Number(i.valor_mao_obra),
              tipo: "peca" as const,
            })),
        ];
        if (maoDeObraAvulsa > 0) {
          moRows.push({ id: "mo-avulsa", origem: "Geral", nome: "Mão de obra avulsa", valor: maoDeObraAvulsa, tipo: "avulsa" });
        }

        const subServ = servicoRows.reduce((a, r) => a + r.valor, 0);
        const subPec = pecaRows.reduce((a, r) => a + r.subtotal, 0);
        const subMO = moRows.reduce((a, r) => a + r.valor, 0);

        if (servicoRows.length === 0 && pecaRows.length === 0 && moRows.length === 0) return null;

        return (
          <>
            {/* ── 1) SERVIÇOS EXECUTADOS ── */}
            {servicoRows.length > 0 && (
              <Card className="border-orange-200 bg-orange-50/40 dark:bg-orange-950/10">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-orange-600" />
                    <span className="font-semibold text-sm text-orange-700 dark:text-orange-400">Serviços Executados</span>
                  </div>
                  <div className="space-y-1.5">
                    {servicoRows.map((row) => (
                      <div key={row.id} className="flex justify-between text-sm border-b border-dashed border-orange-200/60 pb-1.5 last:border-0 last:pb-0">
                        <span className="text-foreground flex-1 pr-2">{row.nome}</span>
                        <span className="font-medium text-foreground whitespace-nowrap">{formatCurrency(row.valor)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-semibold pt-2 border-t border-orange-200">
                      <span className="text-orange-700 dark:text-orange-400 uppercase tracking-wider">Subtotal Serviços</span>
                      <span className="font-mono text-orange-700 dark:text-orange-400">{formatCurrency(subServ)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── 2) PEÇAS UTILIZADAS ── */}
            {pecaRows.length > 0 && (
              <Card className="border-blue-200 bg-blue-50/40 dark:bg-blue-950/10">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-sm text-blue-700 dark:text-blue-400">Peças Utilizadas</span>
                  </div>
                  <div className="space-y-1.5">
                    {pecaRows.map((row) => (
                      <div key={row.id} className="grid grid-cols-12 gap-2 text-sm border-b border-dashed border-blue-200/60 pb-1.5 last:border-0 last:pb-0 items-center">
                        <span className="col-span-6 text-foreground truncate">{row.nome}</span>
                        <span className="col-span-2 text-center text-xs text-muted-foreground">x{row.quantidade}</span>
                        <span className="col-span-2 text-right text-xs text-muted-foreground whitespace-nowrap">{formatCurrency(row.valor_unitario)}</span>
                        <span className="col-span-2 text-right font-medium whitespace-nowrap">{formatCurrency(row.subtotal)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-semibold pt-2 border-t border-blue-200">
                      <span className="text-blue-700 dark:text-blue-400 uppercase tracking-wider">Subtotal Peças</span>
                      <span className="font-mono text-blue-700 dark:text-blue-400">{formatCurrency(subPec)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── 3) MÃO DE OBRA (separada) ── */}
            {moRows.length > 0 && (
              <Card className="border-purple-200 bg-purple-50/40 dark:bg-purple-950/10">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-purple-600" />
                    <span className="font-semibold text-sm text-purple-700 dark:text-purple-400">Mão de Obra</span>
                  </div>
                  <div className="space-y-1.5">
                    {moRows.map((row) => (
                      <div key={row.id} className="flex justify-between items-center text-sm border-b border-dashed border-purple-200/60 pb-1.5 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2 flex-1 pr-2 min-w-0">
                          <Badge
                            variant="outline"
                            className={
                              row.tipo === "servico"
                                ? "text-[9px] h-4 px-1.5 border-orange-300 text-orange-700 bg-orange-100/50"
                                : row.tipo === "peca"
                                ? "text-[9px] h-4 px-1.5 border-blue-300 text-blue-700 bg-blue-100/50"
                                : "text-[9px] h-4 px-1.5 border-purple-300 text-purple-700 bg-purple-100/50"
                            }
                          >
                            {row.origem}
                          </Badge>
                          <span className="text-foreground truncate">{row.nome}</span>
                        </div>
                        <span className="font-medium text-foreground whitespace-nowrap">{formatCurrency(row.valor)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-semibold pt-2 border-t border-purple-200">
                      <span className="text-purple-700 dark:text-purple-400 uppercase tracking-wider">Subtotal Mão de Obra</span>
                      <span className="font-mono text-purple-700 dark:text-purple-400">{formatCurrency(subMO)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        );
      })()}

      {/* Valor Total - DESTAQUE MÁXIMO */}
      <Card className="bg-accent/5 border-accent/30 border-2">
        <CardContent className="p-4">
          <div className="space-y-2">
            {descontoOS > 0 && (
              <>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="line-through tabular-nums">{formatCurrency(subtotalBruto)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-success font-semibold">
                  <span>− Desconto{descontoMotivo ? ` (${descontoMotivo})` : ""}</span>
                  <span className="tabular-nums">{formatCurrency(descontoOS)}</span>
                </div>
                <div className="border-t border-accent/20 pt-2" />
              </>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-accent" />
                <span className="text-lg font-bold">TOTAL</span>
              </div>
              <span className="text-3xl font-bold text-accent">
                {formatCurrency(valorTotal)}
              </span>
            </div>
          </div>
          {ordem.forma_pagamento && (
            <p className="text-xs text-muted-foreground text-right mt-1">
              Pagamento: {ordem.forma_pagamento}
            </p>
          )}
        </CardContent>
      </Card>

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
            <span className="hidden sm:inline">Link</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleOpenPublic}
            className="h-11"
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Ver</span>
          </Button>
          <Button
            variant="outline"
            onClick={handlePrint}
            className="h-11"
          >
            <Printer className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>

        {onEdit && (
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              onEdit();
            }}
            className="w-full h-11"
          >
            <FileText className="w-4 h-4 mr-2" />
            Editar OS
          </Button>
        )}
      </div>

      {/* Rodapé */}
      <div className="text-center text-[10px] text-muted-foreground pt-2 border-t border-dashed">
        <p>Documento gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
        <p className="mt-1">Obrigado pela preferência!</p>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-4 pb-6 max-h-[95dvh]">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30 mx-auto mt-2 mb-1" />
          <DrawerHeader className="text-left px-0">
            <DrawerTitle className="flex items-center justify-between">
              <span>Ordem de Serviço</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="min-h-[44px] min-w-[44px]" 
                onClick={() => onOpenChange(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 min-h-0 overscroll-contain touch-pan-y" style={{ WebkitOverflowScrolling: "touch" }}>
            {Content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ordem de Serviço</DialogTitle>
        </DialogHeader>
        {Content}
      </DialogContent>
    </Dialog>
  );
}
