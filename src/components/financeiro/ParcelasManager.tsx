import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useParcelas } from "@/hooks/useParcelas";
import { useFormasPagamento } from "@/hooks/useFormasPagamento";
import {
  CreditCard,
  Calendar,
  Check,
  X,
  Plus,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Clock,
} from "lucide-react";
import { format, parseISO, isAfter, isBefore, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ParcelasManagerProps {
  ordemServicoId?: string;
  orcamentoId?: string;
  valorTotal: number;
  className?: string;
}

export function ParcelasManager({
  ordemServicoId,
  orcamentoId,
  valorTotal,
  className,
}: ParcelasManagerProps) {
  const {
    parcelas,
    isLoading,
    gerarParcelas,
    marcarComoPago,
    cancelarParcela,
    deletarParcelas,
    totalPago,
    totalPendente,
  } = useParcelas(ordemServicoId, orcamentoId);

  const { formasPagamento: formas } = useFormasPagamento();

  const [expanded, setExpanded] = useState(true);
  const [showGerarModal, setShowGerarModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [parcelaToConfirm, setParcelaToConfirm] = useState<string | null>(null);

  // Form state para gerar parcelas
  const [numParcelas, setNumParcelas] = useState(2);
  const [dataPrimeira, setDataPrimeira] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [intervalo, setIntervalo] = useState(30);
  const [formaPagamentoId, setFormaPagamentoId] = useState<string>("");

  const handleGerarParcelas = () => {
    gerarParcelas.mutate({
      ordem_servico_id: ordemServicoId,
      orcamento_id: orcamentoId,
      valor_total: valorTotal,
      numero_parcelas: numParcelas,
      data_primeira_parcela: dataPrimeira,
      intervalo_dias: intervalo,
      forma_pagamento_id: formaPagamentoId || undefined,
    });
    setShowGerarModal(false);
  };

  const handleMarcarPago = (id: string) => {
    marcarComoPago.mutate({ id });
    setParcelaToConfirm(null);
  };

  const getStatusBadge = (status: string, dataVencimento: string) => {
    const vencimento = parseISO(dataVencimento);
    const hoje = new Date();

    if (status === "pago") {
      return (
        <Badge className="bg-success/10 text-success border-success/20">
          <Check className="w-3 h-3 mr-1" />
          Pago
        </Badge>
      );
    }

    if (status === "cancelado") {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <X className="w-3 h-3 mr-1" />
          Cancelado
        </Badge>
      );
    }

    if (status === "atrasado" || isBefore(vencimento, hoje)) {
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/20">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Atrasado
        </Badge>
      );
    }

    if (isToday(vencimento)) {
      return (
        <Badge className="bg-warning/10 text-warning border-warning/20">
          <Clock className="w-3 h-3 mr-1" />
          Vence Hoje
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-muted-foreground">
        <Calendar className="w-3 h-3 mr-1" />
        Pendente
      </Badge>
    );
  };

  if (!ordemServicoId && !orcamentoId) return null;

  return (
    <>
      <div className={cn("rounded-lg border bg-card", className)}>
        {/* Header */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-primary" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-sm">Parcelamento</h3>
              <p className="text-xs text-muted-foreground">
                {parcelas.length === 0
                  ? "Pagamento à vista"
                  : `${parcelas.length}x de R$ ${(valorTotal / parcelas.length).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {totalPendente > 0 && (
              <Badge variant="secondary" className="font-mono text-xs">
                R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} pendente
              </Badge>
            )}
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t px-3 pb-3 pt-2 space-y-3">
                {/* Lista de parcelas */}
                {parcelas.length > 0 && (
                  <div className="space-y-2">
                    {parcelas.map((parcela) => (
                      <div
                        key={parcela.id}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-md text-sm",
                          parcela.status === "pago"
                            ? "bg-success/5"
                            : parcela.status === "atrasado"
                              ? "bg-destructive/5"
                              : "bg-muted/30"
                        )}
                      >
                        <div className="w-6 h-6 rounded bg-muted flex items-center justify-center shrink-0 text-xs font-bold">
                          {parcela.numero_parcela}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono font-semibold">
                            R$ {Number(parcela.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(parcela.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </div>
                        {getStatusBadge(parcela.status, parcela.data_vencimento)}
                        {parcela.status !== "pago" && parcela.status !== "cancelado" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-success hover:text-success hover:bg-success/10"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setParcelaToConfirm(parcela.id);
                            }}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}

                    {/* Resumo */}
                    <div className="flex justify-between items-center pt-2 border-t text-sm">
                      <div className="flex gap-4">
                        <span className="text-muted-foreground">
                          Pago: <span className="text-success font-semibold">R$ {totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Pendente: <span className="font-semibold">R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowDeleteConfirm(true);
                        }}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Limpar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Botão de parcelar */}
                {parcelas.length === 0 && valorTotal > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowGerarModal(true);
                    }}
                    className="w-full h-10 gap-2 border-dashed border-primary/50 text-primary hover:bg-primary/5"
                  >
                    <Plus className="w-4 h-4" />
                    Parcelar Pagamento
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal para gerar parcelas */}
      <Dialog open={showGerarModal} onOpenChange={setShowGerarModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Parcelar Pagamento
            </DialogTitle>
            <DialogDescription>
              Total: R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Número de Parcelas</Label>
              <Select
                value={numParcelas.toString()}
                onValueChange={(v) => setNumParcelas(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n}x de R$ {(valorTotal / n).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data da Primeira Parcela</Label>
              <Input
                type="date"
                value={dataPrimeira}
                onChange={(e) => setDataPrimeira(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Intervalo entre Parcelas</Label>
              <Select
                value={intervalo.toString()}
                onValueChange={(v) => setIntervalo(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Semanal (7 dias)</SelectItem>
                  <SelectItem value="15">Quinzenal (15 dias)</SelectItem>
                  <SelectItem value="30">Mensal (30 dias)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={formaPagamentoId} onValueChange={setFormaPagamentoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {formas.map((forma) => (
                    <SelectItem key={forma.id} value={forma.id}>
                      {forma.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGerarModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleGerarParcelas}
              disabled={gerarParcelas.isPending}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Gerar {numParcelas} Parcelas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar pagamento */}
      <AlertDialog
        open={!!parcelaToConfirm}
        onOpenChange={() => setParcelaToConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta parcela será marcada como paga com a data de hoje.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => parcelaToConfirm && handleMarcarPago(parcelaToConfirm)}
              className="bg-success hover:bg-success/90"
            >
              <Check className="w-4 h-4 mr-2" />
              Confirmar Pagamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Parcelamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as parcelas serão removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deletarParcelas.mutate();
                setShowDeleteConfirm(false);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remover Parcelas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
