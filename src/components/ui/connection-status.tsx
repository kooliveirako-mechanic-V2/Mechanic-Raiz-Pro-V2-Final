import { useEffect, useState } from "react";
import { Wifi, WifiOff, Cloud, CloudOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Indicador de status de conexão.
 * Mostra quando está offline ou sincronizando.
 * 
 * BLINDAGEM: Estados visuais claros sobre conexão
 */

interface ConnectionStatusProps {
  /** Se há dados pendentes de sync */
  hasPendingSync?: boolean;
  /** Se está sincronizando ativamente */
  isSyncing?: boolean;
  /** Posição do indicador */
  position?: "top-right" | "bottom-right" | "bottom-left";
  /** Mostrar apenas quando offline */
  showOnlyOffline?: boolean;
}

export function ConnectionStatus({
  hasPendingSync = false,
  isSyncing = false,
  position = "bottom-right",
  showOnlyOffline = true,
}: ConnectionStatusProps) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineMessage(false);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineMessage(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Esconder mensagem de offline após 5 segundos
  useEffect(() => {
    if (showOfflineMessage) {
      const timer = setTimeout(() => {
        setShowOfflineMessage(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showOfflineMessage]);

  const shouldShow = !isOnline || (!showOnlyOffline && (hasPendingSync || isSyncing));

  const positionClasses = {
    "top-right": "top-4 right-4",
    "bottom-right": "bottom-20 right-4 md:bottom-4",
    "bottom-left": "bottom-20 left-4 md:bottom-4",
  };

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          key="connection-badge"
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          className={cn(
            "fixed z-50 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg",
            !isOnline
              ? "bg-destructive text-destructive-foreground"
              : isSyncing
              ? "bg-warning text-warning-foreground"
              : hasPendingSync
              ? "bg-muted text-muted-foreground"
              : "bg-success text-success-foreground",
            positionClasses[position]
          )}
        >
          {!isOnline ? (
            <>
              <WifiOff className="w-4 h-4" />
              <span className="text-sm font-medium">Sem conexão</span>
            </>
          ) : isSyncing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Sincronizando...</span>
            </>
          ) : hasPendingSync ? (
            <>
              <CloudOff className="w-4 h-4" />
              <span className="text-sm font-medium">Alterações pendentes</span>
            </>
          ) : (
            <>
              <Cloud className="w-4 h-4" />
              <span className="text-sm font-medium">Sincronizado</span>
            </>
          )}
        </motion.div>
      )}

      {/* Banner de offline maior quando acabou de ficar offline */}
      {showOfflineMessage && !isOnline && (
        <motion.div
          key="offline-banner"
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -100 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground p-3 text-center shadow-lg"
        >
          <div className="flex items-center justify-center gap-2">
            <WifiOff className="w-5 h-5" />
            <span className="font-medium">Você está offline</span>
          </div>
          <p className="text-sm opacity-90 mt-1">
            Suas alterações serão salvas e sincronizadas quando a conexão voltar
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook para monitorar status de conexão
 */
export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline };
}
