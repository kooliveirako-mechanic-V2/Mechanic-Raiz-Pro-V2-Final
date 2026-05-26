import { Loader2, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

export function PullToRefreshIndicator({ pullDistance, isRefreshing, threshold = 80 }: PullToRefreshIndicatorProps) {
  if (pullDistance <= 0 && !isRefreshing) return null;

  const progress = Math.min(pullDistance / threshold, 1);
  const isReady = progress >= 1;

  return (
    <div
      className="flex items-center justify-center overflow-hidden transition-all"
      style={{ height: isRefreshing ? 48 : pullDistance > 0 ? pullDistance * 0.6 : 0 }}
    >
      {isRefreshing ? (
        <div className="flex items-center gap-2 text-primary">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-xs font-medium">Atualizando...</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-muted-foreground">
          <ArrowDown
            className={cn(
              "w-4 h-4 transition-transform duration-200",
              isReady && "rotate-180 text-primary"
            )}
          />
          <span className="text-xs font-medium">
            {isReady ? "Solte para atualizar" : "Puxe para atualizar"}
          </span>
        </div>
      )}
    </div>
  );
}
