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
import { Loader2, CreditCard, CheckCircle2, Clock, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormasPagamento } from "@/hooks/useFormasPagamento";
import { formatCurrency } from "@/lib/formatters";
import type { OrdemServico } from "@/hooks/useOrdensServico";

export type SituacaoPagamento =
  | "pago_agora"
  | "pagar_depois"
  | "sinal_restante_pago"
  | "sinal_restante_depois";

interface KanbanFinalizarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordem: OrdemServico | null;
  valorTotal: number;
  onConfirm: (params: {
    situacao: SituacaoPagamento;
    formaPagamentoId: string | null;
    formaPagamentoNome: string | null;
    numeroParcelas: number;
  }) => Promise<void>;
}

export function KanbanFinalizarModal({
  open,
  onOpenChange,
  ordem,
  valorTotal,
  onConfirm,
}: KanbanFinalizarModalProps) {
  const { formasPagamento } = useFormasPagamento();
  const [situacao, setSituacao] = useState<SituacaoPagamento | "">("");
  const [formaPagamentoId, setFormaPagamentoId] = useState("");
  const [numeroParcelas, setNumeroParcelas] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const valorSinal = Number(ordem?.valor_sinal ?? 0);
  const temSinal = valorSinal > 0;
  const saldoRestante = Math.max(0, valorTotal - valorSinal);

  const selectedForma = useMemo(
    () => formasPagamento.find((f) => f.id === formaPagamentoId),
    [formasPagamento, formaPagamentoId]
  );

  const exigeForma = situacao === "pago_agora" || situacao === "sinal_restante_pago";
  const showParcelas =
    exigeForma &&
    (selectedForma?.tipo === "cartao_credito" || selectedForma?.nome?.toLowerCase().includes("parcelado"));
  const valorParaCobrar = situacao === "sinal_restante_pago" ? saldoRestante : valorTotal;
  const valorParcela = numeroParcelas > 1 ? valorParaCobrar / numeroParcelas : valorParaCobrar;

  // Reset ao abrir e pré-seleção inteligente
  useEffect(() => {
    if (!open) return;
    setNumeroParcelas(1);

    // Default de situação baseado em sinal
    setSituacao(temSinal ? "sinal_restante_pago" : "pago_agora");

    if (formasPagamento.length === 0) {
      setFormaPagamentoId("");
      return;
    }
    if (ordem?.forma_pagamento) {
      const match = formasPagamento.find(
        (f) => f.nome.toLowerCase() === ordem.forma_pagamento?.toLowerCase()
      );
      if (match) {
        setFormaPagamentoId(match.id);
        return;
      }
    }
    const padrao = formasPagamento.find((f) => f.padrao);
    if (padrao) {
      setFormaPagamentoId(padrao.id);
      return;
    }
    const dinheiro = formasPagamento.find((f) => f.nome.toLowerCase() === "dinheiro");
    setFormaPagamentoId(dinheiro?.id || formasPagamento[0]?.id || "");
  }, [open, ordem?.id, ordem?.forma_pagamento, formasPagamento, temSinal]);

  const handleConfirm = async () => {
    if (!situacao) return;
    if (exigeForma && (!formaPagamentoId || !selectedForma)) return;
    setIsLoading(true);
    try {
      await onConfirm({
        situacao: situacao as SituacaoPagamento,
        formaPagamentoId: exigeForma ? formaPagamentoId : null,
        formaPagamentoNome: exigeForma ? selectedForma!.nome : null,
        numeroParcelas: exigeForma ? numeroParcelas : 1,
      });
    } finally {
      setIsLoading(false);
      setFormaPagamentoId("");
      setNumeroParcelas(1);
      setSituacao("");
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setFormaPagamentoId("");
      setNumeroParcelas(1);
      setSituacao("");
    }
    onOpenChange(v);
  };

  if (!ordem) return null;

  // Opções de situação adaptadas ao contexto (com ou sem sinal)
  const opcoes: { value: SituacaoPagamento; label: string; sub?: string; icon: React.ReactNode }[] = temSinal
    ? [
        {
          value: "sinal_restante_pago",
          label: "Cliente pagou o restante agora",
          sub: `Saldo: ${formatCurrency(saldoRestante)}`,
          icon: <Wallet className="w-4 h-4" />,
        },
        {
          value: "sinal_restante_depois",
          label: "Restante ficou para pagar depois",
          sub: `A receber: ${formatCurrency(saldoRestante)}`,
          icon: <Clock className="w-4 h-4" />,
        },
      ]
    : [
        {
          value: "pago_agora",
          label: "Cliente pagou agora",
          icon: <Wallet className="w-4 h-4" />,
        },
        {
          value: "pagar_depois",
          label: "Cliente vai pagar depois",
          sub: "Registrar como a receber",
          icon: <Clock className="w-4 h-4" />,
        },
      ];

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-[92vw] sm:max-w-md mx-4 sm:mx-auto rounded-xl max-h-[90dvh] overflow-y-auto">
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
            {temSinal && (
              <span className="block text-xs text-muted-foreground">
                Sinal já recebido: <strong className="text-foreground">{formatCurrency(valorSinal)}</strong> •
                {" "}Saldo: <strong className="text-foreground">{formatCurrency(saldoRestante)}</strong>
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          {/* Situação do pagamento */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Como ficou o pagamento? *</Label>
            <div className="grid grid-cols-1 gap-2">
              {opcoes.map((opt) => {
                const ativo = situacao === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSituacao(opt.value)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                      "min-h-[56px] active:scale-[0.99]",
                      ativo
                        ? "border-success bg-success/10 ring-2 ring-success/30"
                        : "border-border hover:border-primary/40 hover:bg-accent/40"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex-shrink-0",
                        ativo ? "text-success" : "text-muted-foreground"
                      )}
                    >
                      {opt.icon}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-foreground">{opt.label}</span>
                      {opt.sub && (
                        <span className="block text-xs text-muted-foreground mt-0.5">{opt.sub}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Forma de pagamento — só quando "pagou agora" */}
          {exigeForma && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Forma de pagamento *</Label>
              <Select
                value={formaPagamentoId}
                onValueChange={(v) => {
                  setFormaPagamentoId(v);
                  setNumeroParcelas(1);
                }}
              >
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
          )}

          {/* Parcelas só para cartão de crédito / parcelado */}
          {showParcelas && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                Número de parcelas
              </Label>
              <Select value={String(numeroParcelas)} onValueChange={(v) => setNumeroParcelas(Number(v))}>
                <SelectTrigger className="text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}x de {formatCurrency(valorParaCobrar / n)}
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

          {/* Aviso amigável para "pagar depois" */}
          {!exigeForma && situacao && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
              A OS será finalizada e o valor ficará registrado como{" "}
              <strong>a receber</strong> no financeiro. Você pode dar baixa quando o cliente pagar.
            </div>
          )}
        </div>

        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <AlertDialogCancel disabled={isLoading} className="w-full sm:w-auto">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading || !situacao || (exigeForma && !formaPagamentoId)}
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
                Confirmar finalização
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
