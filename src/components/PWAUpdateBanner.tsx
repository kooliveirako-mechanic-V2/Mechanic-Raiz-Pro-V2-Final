import { useState, useEffect, useCallback } from "react";
import { BUILD_TIMESTAMP, forceUpdateApp } from "@/lib/buildVersion";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * PWA Update Banner — detects stale builds and prompts the user to update.
 * Checks on mount and on visibilitychange (app resume from background).
 * Also listens for SW controllerchange events.
 */
export function PWAUpdateBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const checkForStaleVersion = useCallback(() => {
    try {
      const stored = localStorage.getItem("mechanic_last_build");
      if (stored && stored !== BUILD_TIMESTAMP) {
        setShowBanner(true);
      }
      localStorage.setItem("mechanic_last_build", BUILD_TIMESTAMP);
    } catch {}
  }, []);

  useEffect(() => {
    // Check on mount
    checkForStaleVersion();

    // Check when app resumes from background (mobile)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkForStaleVersion();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Listen for SW controller change (new SW activated)
    const handleControllerChange = () => {
      setShowBanner(true);
    };
    navigator.serviceWorker?.addEventListener("controllerchange", handleControllerChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [checkForStaleVersion]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    await forceUpdateApp();
  };

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between gap-3 shadow-lg safe-top animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <RefreshCw className={`w-4 h-4 flex-shrink-0 ${isUpdating ? "animate-spin" : ""}`} />
        <p className="text-sm font-medium truncate">
          Nova versão disponível
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          size="sm"
          variant="secondary"
          className="h-8 px-3 text-xs font-semibold"
          onClick={handleUpdate}
          disabled={isUpdating}
        >
          {isUpdating ? "Atualizando..." : "Atualizar"}
        </Button>
        <button
          onClick={() => setShowBanner(false)}
          className="p-1 rounded-full hover:bg-white/20 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
