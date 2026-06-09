import { useState } from "react";
import { Package, TrendingUp, Eye, EyeOff } from "lucide-react";
import { ItemEstoque } from "@/hooks/useEstoque";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

interface EstoqueProfitSummaryProps {
  itens: ItemEstoque[];
}

export function EstoqueProfitSummary({ itens }: EstoqueProfitSummaryProps) {
  const [showValues, setShowValues] = useState(true);
  const { canViewCustos, canViewLucro } = useUserRole();

  if (!canViewCustos && !canViewLucro) return null;

  // Excluir serviços do cálculo de estoque — só peças/produtos têm valor investido real
  const pecas = itens.filter((item) => item.tipo_item !== "servico");
  const totalCusto = pecas.reduce((acc, item) => acc + (Number(item.custo_unitario) || 0) * item.quantidade, 0);
  const totalVenda = pecas.reduce((acc, item) => acc + (Number(item.preco_venda) || 0) * item.quantidade, 0);
  const lucroTotal = totalVenda - totalCusto;

  const fmt = (v: number) => showValues ? formatCurrency(v) : "••••••";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Resumo</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowValues(!showValues)}
          className="h-7 px-2 text-muted-foreground hover:text-foreground text-xs"
        >
          {showValues ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
          {showValues ? "Ocultar" : "Mostrar"}
        </Button>
      </div>

      {/* 2 cards — Estoque Total + Lucro Potencial */}
      <div className="grid grid-cols-2 gap-2">
        {canViewCustos && (
          <div className="bg-card rounded-xl border border-border p-3">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Investido</span>
            </div>
            <p className="text-base font-bold text-foreground">{fmt(totalCusto)}</p>
          </div>
        )}
        {canViewLucro && (
          <div className="bg-card rounded-xl border border-border p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className={cn("w-4 h-4", lucroTotal >= 0 ? "text-success" : "text-destructive")} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Lucro Potencial</span>
            </div>
            <p className={cn("text-base font-bold", lucroTotal >= 0 ? "text-success" : "text-destructive")}>
              {fmt(lucroTotal)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
