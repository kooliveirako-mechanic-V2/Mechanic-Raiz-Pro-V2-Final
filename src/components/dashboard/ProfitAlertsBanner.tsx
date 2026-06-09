import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, TrendingDown, Users, Wrench, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useProfitIndicators } from "@/hooks/useProfitIndicators";
import { useUserRole } from "@/hooks/useUserRole";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/formatters";

// ============================================
// INDICADORES DE MARGEM - MODO GUERRA PRO
// Banner consultivo para o Dashboard principal
// Tom: Orientação, não acusação
// ============================================

export function ProfitAlertsBanner() {
  const navigate = useNavigate();
  const { indicators, isLoading } = useProfitIndicators();
  const { canViewLucro } = useUserRole();
  const [dismissed, setDismissed] = useState(false);

  // Só mostrar para quem tem permissão de ver lucro
  if (!canViewLucro || isLoading || dismissed) return null;

  const hasCriticalAlerts = indicators.alertasCriticos.length > 0;
  const hasProblems = indicators.osComPrejuizo > 0 || indicators.servicosProblematicos.length > 0;

  if (!hasCriticalAlerts && !hasProblems) return null;

  // Calcular impacto total
  const impactoTotal = indicators.alertasCriticos.reduce((sum, a) => sum + a.impacto, 0);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={cn(
          "relative overflow-hidden rounded-xl border p-4",
          "bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent",
          "border-amber-500/30"
        )}
      >
        {/* Background pattern sutil */}
        <div className="absolute inset-0 opacity-3">
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              currentColor 10px,
              currentColor 11px
            )`
          }} />
        </div>

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          {/* Icon - Hidden on mobile, shown on sm+ */}
          <div className="hidden sm:flex flex-shrink-0 w-12 h-12 rounded-full bg-amber-500/20 items-center justify-center">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {/* Icon for mobile */}
              <AlertCircle className="w-5 h-5 text-amber-600 sm:hidden" />
              <h4 className="font-semibold text-amber-600 dark:text-amber-400 text-sm sm:text-base">
                Pontos de atenção identificados
              </h4>
              {impactoTotal > 0 && (
                <span className="text-[10px] sm:text-xs bg-amber-500/20 text-amber-600 px-1.5 sm:px-2 py-0.5 rounded-full font-medium">
                  {formatCurrency(impactoTotal)} em oportunidade
                </span>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm">
              {indicators.osComPrejuizo > 0 && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <TrendingDown className="w-3 h-3 text-amber-600" />
                  {indicators.osComPrejuizo} OS para revisar
                </span>
              )}
              {indicators.servicosProblematicos.length > 0 && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Wrench className="w-3 h-3 text-amber-500" />
                  {indicators.servicosProblematicos.length} serviço(s) com oportunidade
                </span>
              )}
              {indicators.clientesRentabilidade.filter(c => c.classificacao === "prejuizo").length > 0 && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Users className="w-3 h-3 text-muted-foreground" />
                  {indicators.clientesRentabilidade.filter(c => c.classificacao === "prejuizo").length} cliente(s) para analisar
                </span>
              )}
            </div>
          </div>

          {/* Actions - Stack on mobile */}
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/financeiro")}
              className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10 flex-1 sm:flex-none text-xs sm:text-sm h-8 sm:h-9"
            >
              Ver detalhes
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

        {/* Feedback emocional positivo */}
        <div className="relative mt-3 pt-3 border-t border-amber-500/20">
          <p className="text-xs text-muted-foreground italic">
            💡 Identificar esses pontos ajuda sua oficina a proteger margem e evitar retrabalho.
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
