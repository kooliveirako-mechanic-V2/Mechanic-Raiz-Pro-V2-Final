import { useNavigate } from "react-router-dom";
import { useGamification } from "@/hooks/useGamification";
import { Progress } from "@/components/ui/progress";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/tracking";

/**
 * Layer 1: Activation Checklist
 * Appears only until all steps are completed, then disappears.
 * Accessible later via "Status da oficina" concept.
 */
export function OnboardingChecklist() {
  const navigate = useNavigate();
  const { activation, isLoading } = useGamification();

  // Don't render if loading, complete, or no steps
  if (isLoading || activation.allComplete || activation.steps.length === 0) {
    return null;
  }

  const stepNavMap: Record<string, string> = {
    primeira_os: "/servicos",
    finalizar_os: "/servicos",
    cadastrar_cliente: "/clientes",
    cadastrar_veiculo: "/veiculos",
  };

  // [Fase B] gtag() direto removido — agora via trackEvent (dataLayer → GTM → GA4).
  const trackStep = (stepId: string) => {
    trackEvent("onboarding_step_completed", {
      params: {
        step_id: stepId,
        percent_complete: activation.percentComplete,
      },
    });
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          Sua oficina está {activation.percentComplete}% configurada
        </p>
        <span className="text-xs text-muted-foreground">
          {activation.steps.filter((s) => s.completed).length}/{activation.steps.length}
        </span>
      </div>

      <Progress value={activation.percentComplete} className="h-2" />

      <div className="space-y-1.5">
        {activation.steps.map((step) => (
          <button
            key={step.id}
            onClick={() => {
              if (!step.completed) {
                trackStep(step.id);
                navigate(stepNavMap[step.id] || "/");
              }
            }}
            disabled={step.completed}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors",
              step.completed
                ? "text-muted-foreground"
                : "text-foreground hover:bg-muted/50 cursor-pointer"
            )}
          >
            <div
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border",
                step.completed
                  ? "bg-success/15 border-success/30"
                  : "border-border"
              )}
            >
              {step.completed && <Check className="w-3 h-3 text-success" />}
            </div>
            <span className={cn(step.completed && "line-through")}>{step.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
