import { useGamification } from "@/hooks/useGamification";
import { TrendingUp } from "lucide-react";
import { useEffect } from "react";

/**
 * Layer 3: Growth Milestone
 * Shows the highest reached milestone with a capacity hint.
 * Disappears when not relevant (no milestones reached).
 */
export function GrowthMilestone() {
  const { milestones, growthLevel, isLoading } = useGamification();

  // Show the most recent (last) milestone
  const topMilestone = milestones[milestones.length - 1];

  useEffect(() => {
    if (topMilestone && typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "growth_milestone_reached", {
        milestone_id: topMilestone.id,
        growth_level: growthLevel,
      });
    }
  }, [topMilestone?.id]);

  if (isLoading || !topMilestone) return null;

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm">
      <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-foreground">{topMilestone.label}</span>
        {topMilestone.capacityHint && (
          <span className="text-muted-foreground"> · {topMilestone.capacityHint}</span>
        )}
      </div>
    </div>
  );
}
