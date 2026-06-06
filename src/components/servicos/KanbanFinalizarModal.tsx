import { useState, useMemo, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, CheckCircle2 } from "lucide-react";
import { useFormasPagamento } from "@/hooks/useFormasPagamento";
import { formatCurrency } from "@/lib/formatters";
import type { OrdemServico } from "@/hooks/useOrdensServico";

interface KanbanFinalizarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordem: OrdemServico | null;
  valorTotal: number;
  onConfirm: (formaPagamentoId: string, formaPagamentoNome: string, numeroParcelas: number) => Promise<void>;
}

export function KanbanFinalizarModal({
  open,
  onOpenChange,
  ordem,
  valorTotal,
  onConfirm,
}: KanbanFinalizarModalProps) {
  const { formasPagamento } = useFormasPagamento();
  const [formaPagamentoId, setFormaPagamentoId] = useState("");
  const [numeroParcelas, setNumeroParcelas] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const selectedForma = useMemo(
    () => formasPagamento.find((f) => f.id === formaPagamentoId),
    [formasPagamento, formaPagamentoId]
  );

  const showParcelas = selectedForma?.tipo === "cartao_credito" || selectedForma?.nome?.toLowerCase().includes("parcelado");

  const valorParcela = numeroParcelas > 1 ? valorTotal / numeroParcelas : valorTotal;

  // CAUSA RAIZ: Reset + preselect ao abrir para qualquer OS (inclusive diferente)
  useEffect(() => {
    if (open && formasPagamento.length > 0) {
      // Sempre resetar ao abrir para evitar estado residual de outra OS
      setNumeroParcelas(1);
      
      // Prioridade 1: Forma de pagamento já salva na OS
      if (ordem?.forma_pagamento) {
        const match = formasPagamento.find(
          (f) => f.nome.toLowerCase() === ordem.forma_pagamento?.toLowerCase()
        );
        if (match) {
          setFormaPagamentoId(match.id);
          return;
        }
      }

      // Prioridade 2: Forma de pagamento marcada como padrão no sistema
      const padrao = formasPagamento.find(f => f.padrao);
      if (padrao) {
        setFormaPagamentoId(padrao.id);
        return;
      }

      // Prioridade 3: Dinheiro ou a primeira da lista
      const dinheiro = formasPagamento.find(f => f.nome.toLowerCase() === "dinheiro");
      setFormaPagamentoId(dinheiro?.id || formasPagamento[0]?.id || "");
    }
  }, [open, ordem?.id, ordem?.forma_pagamento, formasPagamento]);

  const handleConfirm = async () => {
    if (!formaPagamentoId || !selectedForma) return;
    setIsLoading(true);
    try {
      await onConfirm(formaPagamentoId, selectedForma.nome, numeroParcelas);
    } finally {
      setIsLoading(false);
      setFormaPagamentoId("");
      setNumeroParcelas(1);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setFormaPagamentoId("");
      setNumeroParcelas(1);
    }
    onOpenChange(v);
  };

  if (!ordem) return null;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-[90vw] sm:max-w-md mx-4 sm:mx-auto rounded-xl">
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <CheckCircle2 className="w-5 h-5 text-success" />
            Finalizar OS
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm space-y-1">
            <span className="block">
              <strong>{ordem.cliente?.nome}</strong> — {ordem.veiculo?.marca} {ordem.veiculo?.modelo}
            </span>
            <span className="block text-foreground font-semibold text-lg">
              Total: {formatCurrency(valorTotal)}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          {/* Forma de Pagamento */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Forma de Pagamento *</Label>
            <Select value={formaPagamentoId} onValueChange={(v) => { setFormaPagamentoId(v); setNumeroParcelas(1); }}>
              <SelectTrigger className="text-base">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {formasPagamento.map((fp) => (
                  <SelectItem key={fp.id} value={fp.id}>
                    {fp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Parcelas — só aparece para cartão de crédito / parcelado */}
          {showParcelas && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                Número de Parcelas
              </Label>
              <Select value={String(numeroParcelas)} onValueChange={(v) => setNumeroParcelas(Number(v))}>
                <SelectTrigger className="text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}x de {formatCurrency(valorTotal / n)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {numeroParcelas > 1 && (
                <Badge variant="outline" className="text-xs">
                  {numeroParcelas}x de {formatCurrency(valorParcela)}
                </Badge>
              )}
            </div>
          )}
        </div>

        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <AlertDialogCancel disabled={isLoading} className="w-full sm:w-auto">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading || !formaPagamentoId}
            className="w-full sm:w-auto bg-success hover:bg-success/90 text-success-foreground"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Finalizando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirmar Finalização
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
