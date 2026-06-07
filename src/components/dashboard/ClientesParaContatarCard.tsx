import { useNavigate } from "react-router-dom";
import { Phone, ChevronRight, Bell } from "lucide-react";
import { useRecorrencias } from "@/hooks/useRecorrencias";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function ClientesParaContatarCard() {
  const navigate = useNavigate();
  const { alertas, isLoading } = useRecorrencias();

  // Alertas já filtrados pelo hook (vencendo em 7 dias ou menos)
  const clientesContatar = alertas;

  if (isLoading) {
    return null;
  }

  if (clientesContatar.length === 0) {
    return null;
  }

  // Agrupar por cliente único
  const clientesUnicos = [...new Set(clientesContatar.map(a => a.veiculo?.cliente?.nome))].filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      onClick={() => navigate("/veiculos")}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
        "bg-info/10 border border-info/20 hover:border-info/40"
      )}
    >
      <div className="w-10 h-10 rounded-lg bg-info/15 flex items-center justify-center flex-shrink-0">
        <Phone className="w-5 h-5 text-info" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground text-sm">
          {clientesUnicos.length} cliente{clientesUnicos.length > 1 ? "s" : ""} para contatar
        </p>
        <p className="text-xs text-muted-foreground truncate">
          Manutenção vencida ou próxima
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Bell className="w-4 h-4 text-info animate-pulse" />
        <ChevronRight className="w-4 h-4 text-info" />
      </div>
    </motion.div>
  );
}
