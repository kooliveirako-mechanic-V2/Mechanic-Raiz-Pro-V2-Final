import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Zap, TrendingDown, ChevronRight, X, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProfitIndicators } from "@/hooks/useProfitIndicators";
import { useUserRole } from "@/hooks/useUserRole";
import { useOficinaLabels } from "@/hooks/useOficinaLabels";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/formatters";

// ============================================
// ALERTA DE DIAGNÓSTICO PARA REVISÃO
// Modo Guerra Pro - Tom Consultivo
// ============================================

interface DiagnosticUnderchargedAlertProps {
  className?: string;
}

export function DiagnosticUnderchargedAlert({ className }: DiagnosticUnderchargedAlertProps) {
  const navigate = useNavigate();
  const { indicators, isLoading } = useProfitIndicators();
  const { canViewLucro } = useUserRole();
  const { isAutoEletrica, labels } = useOficinaLabels();
  const [dismissed, setDismissed] = useState(false);

  // Só mostrar para quem tem permissão de ver lucro e para auto elétrica
  if (!canViewLucro || isLoading || dismissed) return null;

  // Identificar diagnósticos subvalorizados
  // Critério: custo > 50% do valor E valor < R$200
  const diagnosticosSubvalorizados = indicators.margensOS.filter((os) => {
    const custoPercentual = os.valor_servico > 0 
      ? (os.custo_servico / os.valor_servico) * 100 
      : 100;
    return (custoPercentual > 50 && os.valor_servico < 200) || os.margem_percentual <= 0;
  });

  if (diagnosticosSubvalorizados.length === 0) return null;

  // Calcular impacto total
  const prejuizoTotal = diagnosticosSubvalorizados
    .filter((d) => d.lucro < 0)
    .reduce((sum, d) => sum + Math.abs(d.lucro), 0);

  const valorPerdido = diagnosticosSubvalorizados
    .reduce((sum, d) => {
      // Estimativa: valor que deveria cobrar = custo * 2 (margem 50%)
      const valorIdeal = d.custo_servico * 2;
      const diferenca = valorIdeal - d.valor_servico;
      return sum + (diferenca > 0 ? diferenca : 0);
    }, 0);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "relative overflow-hidden rounded-xl border p-4",
          "bg-gradient-to-r from-warning/10 via-warning/5 to-transparent",
          "border-warning/30",
          className
        )}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 10px,
              currentColor 10px,
              currentColor 11px
            )`
          }} />
        </div>

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          {/* Icon */}
          <div className="hidden sm:flex flex-shrink-0 w-12 h-12 rounded-full bg-warning/20 items-center justify-center">
            <Zap className="w-6 h-6 text-warning" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-5 h-5 text-warning sm:hidden" />
              <h4 className="font-semibold text-warning text-sm sm:text-base">
                {isAutoEletrica 
                  ? "Diagnósticos para revisar" 
                  : "Serviços com oportunidade de ajuste"}
              </h4>
              {diagnosticosSubvalorizados.length > 0 && (
                <Badge 
                  variant="outline" 
                  className="bg-warning/10 text-warning border-warning/30 text-[10px] sm:text-xs"
                >
                  {diagnosticosSubvalorizados.length} este mês
                </Badge>
              )}
            </div>
            
            <p className="text-xs sm:text-sm text-muted-foreground mb-2">
              {isAutoEletrica 
                ? "Identificamos oportunidade de ajuste no valor técnico do seu trabalho."
                : "Esses serviços podem ter margem melhor com pequenos ajustes."}
            </p>

            <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm">
              {prejuizoTotal > 0 && (
                <span className="flex items-center gap-1 text-warning">
                  <TrendingDown className="w-3 h-3" />
                  {formatCurrency(prejuizoTotal)} em oportunidade
                </span>
              )}
              {valorPerdido > 0 && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <DollarSign className="w-3 h-3" />
                  ~{formatCurrency(valorPerdido)} ajustável
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/financeiro")}
              className="border-warning/30 text-warning hover:bg-warning/10 flex-1 sm:flex-none text-xs sm:text-sm h-8 sm:h-9"
            >
              Rever valores
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDismissed(true)}
              className="text-muted-foreground hover:text-foreground h-8 w-8 sm:h-9 sm:w-9"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Insight consultivo */}
        {isAutoEletrica && (
          <div className="relative mt-3 pt-3 border-t border-warning/20">
            <p className="text-xs text-muted-foreground italic">
              💡 Seu tempo técnico tem valor. Esse ajuste ajuda sua oficina a proteger a margem.
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
