import { AlertTriangle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSmartAlerts } from "@/hooks/useSmartAlerts";
import { motion, AnimatePresence } from "framer-motion";

export function CriticalAlertsBanner() {
  const navigate = useNavigate();
  const { alerts } = useSmartAlerts();

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;

  if (criticalCount === 0) return null;

  const hasOverdue = alerts.some((a) => a.type === "overdue" && a.severity === "critical");
  const hasStock = alerts.some((a) => a.type === "stock" && a.severity === "critical");
  const hasParcela = alerts.some((a) => a.type === "parcela_atrasada");

  const details: string[] = [];
  if (hasOverdue) details.push("OS atrasadas");
  if (hasStock) details.push("estoque baixo");
  if (hasParcela) details.push("parcelas vencidas");
  if (details.length === 0) details.push("itens críticos");

  return (
    <AnimatePresence>
      <motion.button
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        onClick={() => {
          const el = document.getElementById("alerts-panel");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-shadow cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20 shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <p className="text-sm font-semibold truncate">
            🔴 {criticalCount} {criticalCount === 1 ? "alerta precisa" : "alertas precisam"} de atenção
            <span className="hidden sm:inline text-white/80 font-normal"> — {details.join(", ")}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-white/90 shrink-0">
          Ver todos <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </motion.button>
    </AnimatePresence>
  );
}
