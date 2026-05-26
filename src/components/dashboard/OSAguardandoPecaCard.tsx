import { useNavigate } from "react-router-dom";
import { Package, ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function OSAguardandoPecaCard() {
  const navigate = useNavigate();
  const { ordens, isLoading } = useOrdensServico();

  // Filtrar OS com status "aguardando_peca"
  // Filtrar OS pendentes ou em andamento (que podem estar aguardando peça por observação)
  const osAguardando = ordens.filter(os => 
    os.status === "pendente" && os.observacoes?.toLowerCase().includes("aguardando")
  );

  if (isLoading) {
    return null;
  }

  if (osAguardando.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      onClick={() => navigate("/servicos")}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
        "bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40"
      )}
    >
      <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
        <Package className="w-5 h-5 text-amber-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground text-sm">
          {osAguardando.length} OS aguardando peça{osAguardando.length > 1 ? "s" : ""}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {osAguardando.slice(0, 2).map(os => os.cliente?.nome).join(", ")}
          {osAguardando.length > 2 && ` +${osAguardando.length - 2}`}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-amber-500" />
    </motion.div>
  );
}
