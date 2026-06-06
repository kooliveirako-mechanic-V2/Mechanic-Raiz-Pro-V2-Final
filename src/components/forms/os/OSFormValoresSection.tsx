import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "./SectionHeader";
import { DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

interface FormaPagamentoDB {
  id: string;
  nome: string;
}

interface Props {
  valorServico: string;
  setValorServico: (v: string) => void;
  custoServico: string;
  setCustoServico: (v: string) => void;
  formaPagamento: string;
  setFormaPagamento: (v: string) => void;
  temGarantia: boolean;
  setTemGarantia: (v: boolean) => void;
  diasGarantia: string;
  setDiasGarantia: (v: string) => void;
  formasPagamentoDB: FormaPagamentoDB[];
  pendingItensTotal: number;
  pendingItensPecas: number;
  pendingItensMaoObra: number;
  pendingItensCount: number;
  pendingItensCusto: number;
  pendingItensSemCustoCount: number;
  isEditing: boolean;
  isAutoEletrica: boolean;
  numeroParcelas: number;
  setNumeroParcelas: (v: number) => void;
}

const FORMAS_PARCELAVEIS = ["Cartão de Crédito", "Parcelado"];

export function OSFormValoresSection({
  valorServico, setValorServico,
  custoServico, setCustoServico,
  formaPagamento, setFormaPagamento,
  temGarantia, setTemGarantia,
  diasGarantia, setDiasGarantia,
  formasPagamentoDB,
  pendingItensTotal,
  pendingItensPecas,
  pendingItensMaoObra,
  pendingItensCount,
  pendingItensCusto,
  pendingItensSemCustoCount,
  isEditing,
  isAutoEletrica,
  numeroParcelas, setNumeroParcelas,
}: Props) {
  const maoDeObraGlobal = parseFloat(valorServico) || 0;
  const safePendingItensTotal = pendingItensTotal || 0;
  const safePendingItensPecas = pendingItensPecas || 0;
  const safePendingItensMaoObra = pendingItensMaoObra || 0;
  const safePendingItensCusto = pendingItensCusto || 0;
  const hasItensSemCusto = pendingItensSemCustoCount > 0;
  
  // ALINHAMENTO MATEMÁTICO: Soma e Desconto
  // O banco agora considera o maior valor entre Mão de Obra Global e a soma da Mão de Obra dos Itens
  const maoDeObraConsolidada = Math.max(maoDeObraGlobal, safePendingItensMaoObra);
  const totalCobradoBruto = maoDeObraConsolidada + safePendingItensPecas;
  const totalCobrado = totalCobradoBruto;
  const lucroConfiavel = !hasItensSemCusto;
  const lucro = totalCobrado - safePendingItensCusto;

  const [maoDeObraExpanded, setMaoDeObraExpanded] = useState(false);

  const showParcelas = FORMAS_PARCELAVEIS.includes(formaPagamento);
  const valorParcela = showParcelas && numeroParcelas > 1 && totalCobrado > 0
    ? totalCobrado / numeroParcelas
    : 0;

  // Quando há itens adicionados (peças/serviços do catálogo), a Mão de Obra global
  // (legada) fica recolhida por padrão. Ainda fica disponível pra OS sem itens.
  const hasItens = pendingItensCount > 0;
  const showMaoDeObraInline = !hasItens || maoDeObraGlobal > 0 || maoDeObraExpanded;

  useEffect(() => {
    if (!showParcelas && numeroParcelas > 1) {
      setNumeroParcelas(1);
    }
  }, [showParcelas, numeroParcelas, setNumeroParcelas]);

  useEffect(() => {
    if (isEditing) return;
    const custoAtual = safePendingItensCusto.toFixed(2);
    if (custoServico !== custoAtual) {
      setCustoServico(custoAtual);
    }
  }, [isEditing, safePendingItensCusto, custoServico, setCustoServico]);

  return (
    <>
      <div className="space-y-4">
        <SectionHeader icon={DollarSign} title="Financeiro" subtitle="Pagamento, garantia e mão de obra adicional" color="text-amber-600" step={4} />

        <div className="space-y-4">
          {/* Mão de Obra adicional — recolhida quando já há itens (peças/serviços do catálogo) */}
          {showMaoDeObraInline ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="valor" className="text-sm font-bold text-amber-600">
                  💰 Mão de Obra {hasItens ? "adicional (ou global)" : ""}
                </Label>
                {hasItens && (maoDeObraGlobal === 0 || maoDeObraExpanded) && (
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setMaoDeObraExpanded(false)}>
                    <ChevronUp className="w-3 h-3 mr-1" /> Recolher
                  </Button>
                )}
              </div>
              <CurrencyInput
                id="valor"
                value={valorServico}
                onValueChange={setValorServico}
                className={cn(
                  "h-14 text-lg font-bold border-2",
                  !valorServico || parseFloat(valorServico) <= 0
                    ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20"
                    : "border-green-500/50 bg-green-50/50 dark:bg-green-950/20"
                )}
              />
              <p className="text-[11px] text-muted-foreground">
                {hasItens
                  ? "Use para cobrar uma mão de obra global ou adicional que não está nos itens."
                  : "Mão de obra cobrada do cliente. Custo das peças vem automaticamente do estoque."}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMaoDeObraExpanded(true)}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-dashed border-border hover:border-amber-500/50 hover:bg-amber-50/30 dark:hover:bg-amber-950/10 transition-colors text-left"
            >
              <div>
                <p className="text-sm font-semibold text-muted-foreground">💰 Mão de obra adicional</p>
                <p className="text-[11px] text-muted-foreground">Clique se quiser cobrar uma mão de obra global ou adicional.</p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
          )}

          {/* Resumo financeiro — Peças x Mão de obra consolidada */}
          {(maoDeObraGlobal > 0 || safePendingItensTotal > 0) && (
            <div className="p-3 rounded-xl border-2 border-border bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total p/ cliente</span>
                <span className="text-base font-black text-foreground">{formatCurrency(totalCobrado)}</span>
              </div>

              <div className="text-[11px] text-muted-foreground space-y-0.5 border-t border-border/50 pt-1.5">
                {maoDeObraConsolidada > 0 && (
                  <div className="flex justify-between">
                    <span>
                      Mão de obra
                      {safePendingItensMaoObra > 0 && maoDeObraGlobal > 0 && (
                        <span className="ml-1 text-[10px] opacity-70">(itens + adicional)</span>
                      )}
                      {safePendingItensMaoObra > 0 && maoDeObraGlobal === 0 && (
                        <span className="ml-1 text-[10px] opacity-70">(dos itens)</span>
                      )}
                    </span>
                    <span>{formatCurrency(maoDeObraConsolidada)}</span>
                  </div>
                )}
                {safePendingItensPecas > 0 && (
                  <div className="flex justify-between">
                    <span>Peças / produtos ({pendingItensCount})</span>
                    <span>{formatCurrency(safePendingItensPecas)}</span>
                  </div>
                )}
                <div className="flex justify-between text-destructive/70">
                  <span>− Custo das peças/produtos (estoque)</span>
                  <span>{formatCurrency(safePendingItensCusto)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
                <span className="text-xs font-semibold text-muted-foreground">
                  {hasItensSemCusto ? "⚠️ Lucro incompleto" : "Lucro real"}
                </span>
                {lucroConfiavel ? (
                  <span className={cn("text-lg font-black", lucro > 0 ? "text-success" : lucro < 0 ? "text-destructive" : "text-muted-foreground")}>
                    {formatCurrency(lucro)}
                  </span>
                ) : (
                  <span className="text-lg font-black text-amber-500">
                    ---
                  </span>
                )}
              </div>

              {!hasItensSemCusto && safePendingItensTotal > 0 && (
                <div className="text-[10px] text-muted-foreground border-t border-border/50 pt-1">
                  ℹ️ O custo é lido do custo de compra cadastrado nas peças adicionadas do estoque.
                </div>
              )}

              {hasItensSemCusto && (
                <div className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 mt-1">
                  <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <span>ℹ️ Lucro real não disponível</span>
                  </p>
                  <p className="text-[9px] text-amber-600/80 dark:text-amber-500/80 mt-0.5">
                    Cadastre o custo de compra das peças no <strong>Estoque</strong> para ver o lucro exato desta OS. Isso não impede a finalização.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Forma de Pagamento */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pagamento</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent className="z-[9999] bg-background" position="popper" sideOffset={4}>
                {formasPagamentoDB.map((forma) => (
                  <SelectItem key={forma.id} value={forma.nome} className="py-3">{forma.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Parcelas */}
          {showParcelas && totalCobrado > 0 && !isEditing && (
            <div className="space-y-2 p-3 rounded-xl border-2 border-primary/20 bg-primary/5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-primary">Número de Parcelas</Label>
              <Select value={String(numeroParcelas)} onValueChange={(v) => setNumeroParcelas(parseInt(v))}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[9999] bg-background" position="popper" sideOffset={4}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)} className="py-2.5">
                      {n}x {n > 1 ? `de ${formatCurrency(totalCobrado / n)}` : `à vista — ${formatCurrency(totalCobrado)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {numeroParcelas > 1 && (
                <p className="text-sm font-semibold text-primary text-center">
                  {numeroParcelas}x de {formatCurrency(valorParcela)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Garantia */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
        <Label htmlFor="garantia" className="text-sm font-semibold">Garantia</Label>
        <div className="flex items-center gap-2">
          <Switch id="garantia" checked={temGarantia} onCheckedChange={setTemGarantia} />
          {temGarantia && (
            <div className="flex items-center gap-1">
              <Input type="number" inputMode="numeric" value={diasGarantia} onChange={(e) => setDiasGarantia(e.target.value)} className="w-16 h-9" />
              <span className="text-xs text-muted-foreground">dias</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
