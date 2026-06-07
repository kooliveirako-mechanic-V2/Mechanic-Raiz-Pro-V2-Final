import { Button } from "@/components/ui/button";
import { useItensOS } from "@/hooks/useItensOS";
import { DollarSign, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/formatters";

interface OSFooterTotalProps {
  ordemServicoId?: string;
  valorServico?: number;
  isLoading?: boolean;
  isEditing?: boolean;
  onFinalize?: () => void;
  className?: string;
}

export function OSFooterTotal({
  ordemServicoId,
  valorServico = 0,
  isLoading = false,
  isEditing = false,
  onFinalize,
  className,
}: OSFooterTotalProps) {
  const { totalItens } = useItensOS(ordemServicoId);

  // CAUSA RAIZ: valor_servico JÁ inclui itens (via recalcOSTotals).
  // Usar fallback, NÃO somar os dois.
  const valorTotal = valorServico > 0 ? valorServico : totalItens;

  // Só mostra se estiver editando e tiver algum valor
  if (!isEditing || valorTotal === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border p-4 -mx-1 -mb-1 shadow-lg",
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total da OS</p>
            <p className="text-xl font-bold text-accent">
              {formatCurrency(valorTotal)}
            </p>
          </div>
        </div>

        {onFinalize && (
          <Button
            onClick={onFinalize}
            disabled={isLoading}
            className="h-12 px-6 bg-success hover:bg-success/90 text-success-foreground font-semibold shadow-md"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Finalizar OS
              </>
            )}
          </Button>
        )}
      </div>
    </motion.div>
  );
}
