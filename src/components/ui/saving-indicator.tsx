import { motion, AnimatePresence } from "framer-motion";
import { Cloud, CloudOff, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Indicador discreto de status de salvamento.
 * Mostra quando está salvando, salvo ou com erro.
 * 
 * BLINDAGEM: UX de confiança contínua
 */

interface SavingIndicatorProps {
  /** Se está salvando ativamente */
  isSaving?: boolean;
  /** Timestamp do último salvamento */
  lastSaved?: Date | null;
  /** Se há rascunho pendente */
  hasDraft?: boolean;
  /** Se houve erro */
  hasError?: boolean;
  /** Classe CSS adicional */
  className?: string;
}

export function SavingIndicator({
  isSaving = false,
  lastSaved,
  hasDraft = false,
  hasError = false,
  className,
}: SavingIndicatorProps) {
  // Não mostrar se não há nada para indicar
  if (!isSaving && !lastSaved && !hasDraft && !hasError) {
    return null;
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AnimatePresence mode="wait">
      {isSaving ? (
        <motion.div
          key="saving"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          className={cn(
            "flex items-center gap-1.5 text-xs text-muted-foreground",
            className
          )}
        >
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Salvando...</span>
        </motion.div>
      ) : hasError ? (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          className={cn(
            "flex items-center gap-1.5 text-xs text-destructive",
            className
          )}
        >
          <CloudOff className="w-3 h-3" />
          <span>Erro ao salvar</span>
        </motion.div>
      ) : lastSaved ? (
        <motion.div
          key="saved"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          className={cn(
            "flex items-center gap-1.5 text-xs text-muted-foreground",
            className
          )}
        >
          <Check className="w-3 h-3 text-success" />
          <span>Salvo às {formatTime(lastSaved)}</span>
        </motion.div>
      ) : hasDraft ? (
        <motion.div
          key="draft"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          className={cn(
            "flex items-center gap-1.5 text-xs text-warning",
            className
          )}
        >
          <Cloud className="w-3 h-3" />
          <span>Rascunho disponível</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
