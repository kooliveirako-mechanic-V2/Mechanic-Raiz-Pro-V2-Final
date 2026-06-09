import { ShoppingCart, Info } from "lucide-react";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/formatters";
import { useComprasMaterialPeriodo } from "@/hooks/useComprasMaterialPeriodo";
import { cn } from "@/lib/utils";

interface ComprasMaterialCardProps {
  dateFilter: { start: string; end: string } | null;
  valoresOcultos?: boolean;
  variant?: "desktop" | "mobile";
}

/**
 * Card "Compras de Material no período".
 * Soma entradas de estoque (peças/produtos) — quanto saiu de caixa em material.
 * NÃO altera lucro nem estoque; é puramente informativo.
 */
export function ComprasMaterialCard({
  dateFilter,
  valoresOcultos = false,
  variant = "desktop",
}: ComprasMaterialCardProps) {
  const { data, isLoading } = useComprasMaterialPeriodo(dateFilter);
  const total = data?.total ?? 0;
  const count = data?.quantidadeEntradas ?? 0;

  const fmt = (v: number) => (valoresOcultos ? "••••••" : formatCurrency(v));

  // Mostra sempre — mesmo zerado serve de "placeholder" pro dono entender onde fica


  if (variant === "mobile") {
    return (
      <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
          <ShoppingCart className="w-5 h-5 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Compras de Material</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 text-muted-foreground/60" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[240px] text-xs">
                  Total que saiu de caixa em peças e produtos lançados no estoque no período.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-base font-bold text-foreground tabular-nums">
            {isLoading ? "—" : fmt(total)}
          </p>
          {count > 0 && (
            <p className="text-[10px] text-muted-foreground">
              {count} {count === 1 ? "entrada" : "entradas"} no período
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01, y: -1 }}
      transition={{ type: "spring", stiffness: 300 }}
      className={cn(
        "bg-gradient-to-br from-amber-50 to-orange-100/40 dark:from-amber-950/40 dark:to-orange-900/20",
        "rounded-2xl border border-amber-200 dark:border-amber-800/50 p-5 shadow-lg shadow-amber-500/10",
        "relative overflow-hidden"
      )}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/15 to-orange-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />
      <div className="relative flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Compras de Material</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3.5 h-3.5 text-amber-600/70 dark:text-amber-400/70" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                  Quanto saiu de caixa em <b>peças e produtos</b> lançados como entrada no estoque, dentro do período selecionado. Não inclui despesas operacionais.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-2xl font-extrabold bg-gradient-to-r from-amber-600 to-orange-500 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent tabular-nums">
            {isLoading ? "—" : fmt(total)}
          </p>
          {count > 0 && (
            <p className="text-xs text-amber-700/70 dark:text-amber-400/70 mt-1">
              {count} {count === 1 ? "entrada de estoque" : "entradas de estoque"}
            </p>
          )}
        </div>
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 flex-shrink-0">
          <ShoppingCart className="w-6 h-6 text-white" />
        </div>
      </div>
    </motion.div>
  );
}
