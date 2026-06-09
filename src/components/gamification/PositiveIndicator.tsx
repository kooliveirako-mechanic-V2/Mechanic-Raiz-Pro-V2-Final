import { useGamification } from "@/hooks/useGamification";
import { CheckCircle2 } from "lucide-react";
import { useEffect } from "react";

/**
 * Layer 2: Positive Indicator
 * Shows at most 1 indicator at a time — the most relevant one.
 * Purely textual, no badges, no pop-ups, no flashy elements.
 */
export function PositiveIndicator() {
  const { indicators, isLoading } = useGamification();

  // Pick only the first (most relevant) indicator
  const indicator = indicators[0];

  useEffect(() => {
    if (indicator && typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "indicator_positive_shown", {
        indicator_id: indicator.id,
        indicator_type: indicator.type,
      });
    }
  }, [indicator?.id]);

  if (isLoading || !indicator) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/5 border border-success/15 text-sm">
      <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
      <span className="text-foreground">{indicator.message}</span>
    </div>
  );
}
