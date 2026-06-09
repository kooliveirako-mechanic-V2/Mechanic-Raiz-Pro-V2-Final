import { cn } from "@/lib/utils";
import { Check, Clock, Wrench, Package, Send, CreditCard, AlertCircle } from "lucide-react";
import { StatusOS } from "@/hooks/useOrdensServico";

interface OSStatusTimelineProps {
  status: StatusOS;
  whatsappEnviado?: boolean;
  pagamentoStatus?: "pendente" | "parcial" | "pago";
  className?: string;
  compact?: boolean;
}

interface TimelineStep {
  key: string;
  label: string;
  icon: typeof Clock;
  isCompleted: boolean;
  isCurrent: boolean;
}

export function OSStatusTimeline({ 
  status, 
  whatsappEnviado = false, 
  pagamentoStatus = "pendente",
  className,
  compact = false
}: OSStatusTimelineProps) {
  const statusOrder: StatusOS[] = ["pendente", "em_andamento", "finalizado"];
  const currentIndex = statusOrder.indexOf(status === "em_diagnostico" ? "em_andamento" : status);

  const getSteps = (): TimelineStep[] => {
    const steps: TimelineStep[] = [
      {
        key: "criada",
        label: "Criada",
        icon: Clock,
        isCompleted: true,
        isCurrent: status === "pendente",
      },
      {
        key: "execucao",
        label: "Em Execução",
        icon: Wrench,
        isCompleted: currentIndex >= 1 || status === "finalizado",
        isCurrent: status === "em_andamento" || status === "em_diagnostico" || status === "aguardando_peca",
      },
      {
        key: "finalizada",
        label: "Finalizada",
        icon: Check,
        isCompleted: status === "finalizado",
        isCurrent: status === "finalizado" && !whatsappEnviado,
      },
      {
        key: "enviada",
        label: "Enviada",
        icon: Send,
        isCompleted: whatsappEnviado,
        isCurrent: status === "finalizado" && whatsappEnviado && pagamentoStatus !== "pago",
      },
      {
        key: "paga",
        label: pagamentoStatus === "parcial" ? "Parcial" : "Paga",
        icon: CreditCard,
        isCompleted: pagamentoStatus === "pago",
        isCurrent: pagamentoStatus === "parcial",
      },
    ];

    return steps;
  };

  const steps = getSteps();

  if (status === "cancelado") {
    return (
      <div className={cn("flex items-center gap-2 p-2 bg-destructive/10 rounded-lg", className)}>
        <AlertCircle className="w-4 h-4 text-destructive" />
        <span className="text-sm font-medium text-destructive">OS Cancelada</span>
      </div>
    );
  }

  if (compact) {
    // Versão compacta para listagem
    const currentStep = steps.find(s => s.isCurrent) || steps.find(s => s.isCompleted);
    const completedCount = steps.filter(s => s.isCompleted).length;

    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        {steps.map((step, index) => (
          <div
            key={step.key}
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-colors",
              step.isCompleted 
                ? "bg-success" 
                : step.isCurrent 
                  ? "bg-primary animate-pulse" 
                  : "bg-muted-foreground/30"
            )}
          />
        ))}
        <span className="text-xs text-muted-foreground ml-1">
          {completedCount}/{steps.length}
        </span>
      </div>
    );
  }

  // Versão completa para dentro da OS
  return (
    <div className={cn("p-3 bg-muted/30 rounded-lg", className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                    step.isCompleted
                      ? "bg-success text-success-foreground"
                      : step.isCurrent
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span
                  className={cn(
                    "text-[10px] mt-1 font-medium text-center leading-tight max-w-[60px]",
                    step.isCompleted
                      ? "text-success"
                      : step.isCurrent
                        ? "text-primary"
                        : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {!isLast && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-1.5 transition-colors",
                    step.isCompleted ? "bg-success" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
