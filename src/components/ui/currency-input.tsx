import * as React from "react";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  /** Valor decimal em string (ex: "50.25" = R$ 50,25). */
  value: string;
  /** Devolve sempre string decimal com ponto ("50.25"). */
  onValueChange: (value: string) => void;
}

/**
 * CurrencyInput — modo "centavos" (BR).
 *
 * Comportamento (idêntico a Mercado Pago / Nubank):
 *  - O usuário só digita números. A vírgula desliza sozinha.
 *  - Backspace apaga o último dígito (5025 → 502 → 50 → 5 → vazio).
 *  - Aceita colar valores formatados ("R$ 1.234,56") ou crus ("1234.56").
 *  - Sempre devolve string decimal com PONTO ao parent (compatível com parseFloat).
 *
 * Por que não regex de "ponto/vírgula"? O modo livre quebrava em PT-BR
 * (separadores de milhar e decimal conflitam). O modo centavos elimina
 * 100% da ambiguidade — não tem como digitar errado.
 */
const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onValueChange, ...props }, ref) => {
    const toCents = React.useCallback((v: string): number => {
      if (v === undefined || v === null || v === "") return 0;
      // value pode chegar como "50.25", "50", "0.00" (interno) ou já formatado
      const cleaned = String(v).replace(/[^\d.,-]/g, "").trim();
      if (!cleaned) return 0;
      const lastComma = cleaned.lastIndexOf(",");
      const lastDot = cleaned.lastIndexOf(".");
      let normalized = cleaned;
      if (lastComma !== -1 && lastDot !== -1) {
        const decSep = lastComma > lastDot ? "," : ".";
        const thouRe = decSep === "," ? /\./g : /,/g;
        normalized = cleaned.replace(thouRe, "").replace(decSep, ".");
      } else if (lastComma !== -1) {
        normalized = cleaned.replace(/\./g, "").replace(",", ".");
      }
      const n = parseFloat(normalized);
      if (!Number.isFinite(n)) return 0;
      return Math.round(n * 100);
    }, []);

    const formatCents = React.useCallback((cents: number): string => {
      if (!cents) return "";
      return (cents / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }, []);

    const [display, setDisplay] = React.useState<string>(() => formatCents(toCents(value)));

    // Sincroniza quando o parent muda o valor externamente (load, reset, etc.)
    React.useEffect(() => {
      const cents = toCents(value);
      const next = formatCents(cents);
      setDisplay((prev) => (prev === next ? prev : next));
    }, [value, toCents, formatCents]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const digits = raw.replace(/\D/g, "");
      if (!digits) {
        setDisplay("");
        onValueChange("");
        return;
      }
      // Limita a 12 dígitos (até R$ 9.999.999.999,99) para evitar overflow visual
      const trimmed = digits.slice(0, 12);
      const cents = parseInt(trimmed, 10);
      setDisplay(formatCents(cents));
      onValueChange((cents / 100).toFixed(2));
    };

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground pointer-events-none">
          R$
        </span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          ref={ref}
          value={display}
          onChange={handleChange}
          className={cn(
            "flex h-12 w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-lg font-semibold ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          placeholder="0,00"
          {...props}
        />
      </div>
    );
  },
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
