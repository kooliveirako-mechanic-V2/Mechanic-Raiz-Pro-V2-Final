import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tag, Percent, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, parseCurrency } from "@/lib/formatters";

interface Props {
  /** Total bruto (Master Total) sobre o qual o desconto incide. */
  subtotal: number;
  /** Valor do desconto em R$ (sempre persistido em reais, mesmo quando o usuário digita %). */
  descontoValor: string;
  setDescontoValor: (v: string) => void;
  descontoMotivo: string;
  setDescontoMotivo: (v: string) => void;
  className?: string;
  disabled?: boolean;
}

const MOTIVOS = [
  "Cliente fiel",
  "Pagamento à vista",
  "Arredondamento",
  "Negociação",
  "Indicação",
  "Outro",
];

/**
 * Bloco de desconto na OS.
 * Persistência: sempre em R$ (compatível com a coluna `desconto NUMERIC`).
 * UI: permite alternar entre R$ e % e oferece atalhos de "arredondar pra baixo".
 */
export function OSDescontoSection({
  subtotal,
  descontoValor,
  setDescontoValor,
  descontoMotivo,
  setDescontoMotivo,
  className,
  disabled = false,
}: Props) {
  const [modo, setModo] = useState<"reais" | "percent">("reais");
  const [percent, setPercent] = useState<string>("");

  const descontoNum = useMemo(() => {
    const n = parseCurrency(descontoValor);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(n, subtotal);
  }, [descontoValor, subtotal]);

  const totalCobrar = Math.max(subtotal - descontoNum, 0);
  const ativo = descontoNum > 0;

  // Sincroniza % quando o modo é "percent"
  useEffect(() => {
    if (modo === "percent" && subtotal > 0) {
      const pct = (descontoNum / subtotal) * 100;
      setPercent(pct > 0 ? pct.toFixed(2).replace(".", ",") : "");
    }
  }, [modo, descontoNum, subtotal]);

  const handlePercentChange = (v: string) => {
    setPercent(v);
    const pctNum = parseFloat(v.replace(",", ".")) || 0;
    if (pctNum < 0 || pctNum > 100) return;
    const valor = (subtotal * pctNum) / 100;
    setDescontoValor(valor.toFixed(2));
  };

  const arredondarPraBaixo = (multiplo: number) => {
    if (subtotal <= 0) return;
    const novoTotal = Math.floor(subtotal / multiplo) * multiplo;
    const desconto = Math.max(subtotal - novoTotal, 0);
    setDescontoValor(desconto.toFixed(2));
    setModo("reais");
    if (!descontoMotivo) setDescontoMotivo("Arredondamento");
  };

  const limpar = () => {
    setDescontoValor("");
    setPercent("");
    setDescontoMotivo("");
  };

  return (
    <div
      className={cn(
        "rounded-xl border-2 p-3 space-y-3 transition-colors",
        ativo ? "border-success/40 bg-success/5" : "border-dashed border-border bg-muted/30",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", ativo ? "bg-success/15" : "bg-muted")}>
            <Tag className={cn("w-4 h-4", ativo ? "text-success" : "text-muted-foreground")} />
          </div>
          <div>
            <p className="text-sm font-bold">Desconto</p>
            <p className="text-[11px] text-muted-foreground">
              Aplicado sobre o total. Reduz o valor a cobrar e o lucro.
            </p>
          </div>
        </div>
        {ativo && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={limpar}
            disabled={disabled}
          >
            Remover
          </Button>
        )}
      </div>

      {/* Toggle R$ / % */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={modo === "reais" ? "default" : "outline"}
          size="sm"
          className="flex-1 h-10"
          onClick={() => setModo("reais")}
          disabled={disabled}
        >
          <DollarSign className="w-3.5 h-3.5 mr-1" /> R$
        </Button>
        <Button
          type="button"
          variant={modo === "percent" ? "default" : "outline"}
          size="sm"
          className="flex-1 h-10"
          onClick={() => setModo("percent")}
          disabled={disabled || subtotal <= 0}
        >
          <Percent className="w-3.5 h-3.5 mr-1" /> %
        </Button>
      </div>

      {/* Input */}
      {modo === "reais" ? (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Valor do desconto (R$)
          </Label>
          <CurrencyInput
            value={descontoValor}
            onValueChange={setDescontoValor}
            disabled={disabled}
            className="h-12 text-base"
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Percentual (%)
          </Label>
          <Input
            type="text"
            inputMode="decimal"
            value={percent}
            onChange={(e) => handlePercentChange(e.target.value)}
            placeholder="Ex: 10"
            disabled={disabled || subtotal <= 0}
            className="h-12 text-base"
          />
        </div>
      )}

      {/* Atalhos de arredondamento */}
      {subtotal > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Arredondar pra baixo
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[5, 10, 50].map((m) => {
              const novoTotal = Math.floor(subtotal / m) * m;
              const desc = subtotal - novoTotal;
              if (desc <= 0 || desc >= subtotal) return null;
              return (
                <Button
                  key={m}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => arredondarPraBaixo(m)}
                  disabled={disabled}
                >
                  → {formatCurrency(novoTotal)}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Motivo */}
      {(ativo || descontoMotivo) && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Motivo (opcional)
          </Label>
          <Select value={descontoMotivo || ""} onValueChange={setDescontoMotivo}>
            <SelectTrigger className="h-10 text-sm" disabled={disabled}>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent className="z-[9999] bg-background">
              {MOTIVOS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Preview */}
      {ativo && (
        <div className="rounded-lg bg-background border border-success/30 p-3 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Subtotal</span>
            <span className="line-through">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs text-success font-semibold">
            <span>− Desconto</span>
            <span>{formatCurrency(descontoNum)}</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-border/50">
            <span className="text-sm font-bold">Total a cobrar</span>
            <span className="text-lg font-black text-success">{formatCurrency(totalCobrar)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
