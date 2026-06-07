import { useState } from "react";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, ChevronDown, ChevronUp } from "lucide-react";
import { useFormasPagamento } from "@/hooks/useFormasPagamento";
import { formatCurrency, parseCurrency } from "@/lib/formatters";

export interface SinalInicial {
  valor: string;
  formaId: string;
  formaNome: string;
  data: string;
  observacao: string;
}

export const emptySinalInicial = (): SinalInicial => ({
  valor: "",
  formaId: "",
  formaNome: "Dinheiro",
  data: new Date().toISOString().slice(0, 10),
  observacao: "",
});

interface Props {
  value: SinalInicial;
  onChange: (next: SinalInicial) => void;
  totalEstimado?: number;
}

/**
 * Bloco compacto para registrar sinal já na CRIAÇÃO da OS.
 * Diferente do OSPagamentoParcial (que opera em OS existente via RPC).
 * Após criar a OS, o submit chama registrar_sinal_os com esses dados.
 */
export function OSSinalInicialBlock({ value, onChange, totalEstimado = 0 }: Props) {
  const { formasPagamento } = useFormasPagamento();

  const valorNum = parseCurrency(value.valor);
  const ultrapassa = totalEstimado > 0 && valorNum > totalEstimado + 0.01;
  const hasValue = valorNum > 0;
  const [expanded, setExpanded] = useState(hasValue);
  const isOpen = expanded || hasValue;

  return (
    <div className="rounded-xl border border-amber-300/60 dark:border-amber-700/60 bg-amber-50/30 dark:bg-amber-950/10">
      <button
        type="button"
        onClick={() => setExpanded((s) => !s)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
            Entrada / Sinal {hasValue ? `· ${formatCurrency(valorNum)}` : "(opcional)"}
          </span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[11px] text-muted-foreground -mt-1">
            Se o cliente já adiantou parte do valor, registre aqui. Vai virar uma entrada paga no financeiro assim que a OS for criada.
          </p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs font-semibold">Valor recebido</Label>
          <CurrencyInput
            value={value.valor}
            onValueChange={(v) => onChange({ ...value, valor: v })}
            className="h-11"
          />
        </div>
        <div>
          <Label className="text-xs font-semibold">Data</Label>
          <Input
            type="date"
            value={value.data}
            onChange={(e) => onChange({ ...value, data: e.target.value })}
            className="h-11 text-base"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs font-semibold">Forma de pagamento</Label>
        <Select
          value={value.formaId}
          onValueChange={(v) => {
            const nome = formasPagamento.find((f) => f.id === v)?.nome || "Dinheiro";
            onChange({ ...value, formaId: v, formaNome: nome });
          }}
        >
          <SelectTrigger className="h-11 text-base">
            <SelectValue placeholder="Dinheiro (padrão)" />
          </SelectTrigger>
          <SelectContent>
            {formasPagamento.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs font-semibold">Observação (opcional)</Label>
        <Input
          value={value.observacao}
          onChange={(e) => onChange({ ...value, observacao: e.target.value })}
          placeholder="Ex.: 1ª parcela combinada"
          className="h-11 text-base"
        />
      </div>

          {valorNum > 0 && totalEstimado > 0 && !ultrapassa && (
            <div className="text-xs text-muted-foreground">
              Saldo restante após sinal: <span className="font-bold text-foreground">{formatCurrency(Math.max(totalEstimado - valorNum, 0))}</span>
            </div>
          )}
          {ultrapassa && (
            <p className="text-xs font-semibold text-destructive">
              ⚠️ Sinal ultrapassa o total estimado ({formatCurrency(totalEstimado)}).
            </p>
          )}
        </div>
      )}
    </div>
  );
}

