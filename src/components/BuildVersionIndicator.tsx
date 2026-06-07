import { useState, useEffect } from "react";
import { BUILD_TIMESTAMP, BUILD_ID, forceUpdateApp, getServiceWorkerStatus } from "@/lib/buildVersion";
import { Button } from "@/components/ui/button";
import { RefreshCw, Info, X, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Compact build version badge shown in the app footer/settings.
 * Shows build info and provides force-update capability.
 */
export function BuildVersionIndicator() {
  const [showDetails, setShowDetails] = useState(false);
  const [swStatus, setSwStatus] = useState<{
    hasServiceWorker: boolean;
    registrations: number;
    cacheNames: string[];
  } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (showDetails) {
      getServiceWorkerStatus().then(setSwStatus);
    }
  }, [showDetails]);

  const buildDate = (() => {
    try {
      return format(new Date(BUILD_TIMESTAMP), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return BUILD_TIMESTAMP;
    }
  })();

  const handleForceUpdate = async () => {
    setIsUpdating(true);
    await forceUpdateApp();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3 text-xs space-y-2">
      {/* Compact header */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-between gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5" />
          <span>Versão: <strong className="text-foreground font-mono">{BUILD_ID.slice(0, 8)}</strong></span>
          <span className="text-muted-foreground/60">•</span>
          <span>{buildDate}</span>
        </div>
        {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {/* Expanded diagnostics */}
      {showDetails && (
        <div className="space-y-3 pt-2 border-t border-border">
          {/* Build info */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-muted-foreground">Build ID:</span>
              <p className="font-mono text-foreground break-all">{BUILD_ID}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Build Time:</span>
              <p className="font-mono text-foreground">{BUILD_TIMESTAMP}</p>
            </div>
          </div>

          {/* SW status */}
          {swStatus && (
            <div className="space-y-1.5">
              <p className="font-semibold text-foreground text-[11px]">Service Worker</p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${swStatus.registrations > 0 ? "bg-amber-500" : "bg-green-500"}`} />
                  <span>
                    {swStatus.registrations > 0
                      ? `${swStatus.registrations} SW ativo(s)`
                      : "Nenhum SW ativo"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${swStatus.cacheNames.length > 0 ? "bg-amber-500" : "bg-green-500"}`} />
                  <span>
                    {swStatus.cacheNames.length > 0
                      ? `${swStatus.cacheNames.length} cache(s)`
                      : "Sem cache"}
                  </span>
                </div>
              </div>
              {swStatus.cacheNames.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-2 text-[10px] font-mono text-muted-foreground max-h-20 overflow-y-auto">
                  {swStatus.cacheNames.map((name) => (
                    <p key={name}>{name}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Force update */}
          <Button
            onClick={handleForceUpdate}
            disabled={isUpdating}
            size="sm"
            variant="destructive"
            className="w-full h-9 text-xs gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? "animate-spin" : ""}`} />
            {isUpdating ? "Atualizando..." : "Forçar Atualização (Limpar Cache)"}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            Use se o app está mostrando uma versão antiga ou com bugs já corrigidos.
          </p>
        </div>
      )}
    </div>
  );
}
