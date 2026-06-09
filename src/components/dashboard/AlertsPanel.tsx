import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, Package, Wrench, TrendingDown, Shield, DollarSign, ChevronRight, RefreshCw, Zap, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { useSmartAlerts, AlertType, AlertSeverity } from "@/hooks/useSmartAlerts";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const alertConfig: Record<
  AlertType,
  { icon: typeof AlertTriangle; label: string }
> = {
  recurrence: {
    icon: Clock,
    label: "Manutenção",
  },
  stock: {
    icon: Package,
    label: "Estoque",
  },
  overdue: {
    icon: AlertTriangle,
    label: "Atrasado",
  },
  warranty: {
    icon: Shield,
    label: "Garantia",
  },
  margin_critical: {
    icon: TrendingDown,
    label: "Prejuízo",
  },
  margin_low: {
    icon: DollarSign,
    label: "Margem",
  },
  client_loss: {
    icon: TrendingDown,
    label: "Cliente",
  },
  diagnostic_undercharged: {
    icon: Zap,
    label: "Diagnóstico",
  },
  parcela_atrasada: {
    icon: CreditCard,
    label: "Parcela",
  },
  parcela_vencendo: {
    icon: CreditCard,
    label: "Parcela",
  },
  audit_logic_clean: {
    icon: Shield,
    label: "Auditoria",
  },
};

const severityStyles: Record<AlertSeverity, { bgColor: string; iconColor: string; borderColor: string }> = {
  critical: {
    bgColor: "bg-destructive/10",
    iconColor: "text-destructive",
    borderColor: "border-destructive/20",
  },
  warning: {
    bgColor: "bg-warning/10",
    iconColor: "text-warning",
    borderColor: "border-warning/20",
  },
  info: {
    bgColor: "bg-info/10",
    iconColor: "text-info",
    borderColor: "border-info/20",
  },
};

export function AlertsPanel() {
  const navigate = useNavigate();
  const { alerts, alertsByType, impactoFinanceiroTotal, isLoading, refetch } = useSmartAlerts();

  const handleAlertClick = (alert: ReturnType<typeof useSmartAlerts>["alerts"][0]) => {
    switch (alert.referenceType) {
      case "os":
        navigate("/servicos");
        break;
      case "estoque":
        navigate("/estoque");
        break;
      case "recorrencia":
      case "veiculo":
        navigate("/veiculos");
        break;
      case "cliente":
        navigate("/clientes");
        break;
      default:
        break;
    }
  };


  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 flex items-start gap-3">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2 mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn(
              "w-5 h-5",
              alertsByType.critical > 0 ? "text-destructive" : "text-warning"
            )} />
            <h2 className="text-lg font-semibold text-foreground">Alertas</h2>
            {alertsByType.critical > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive rounded-full">
                {alertsByType.critical} crítico{alertsByType.critical > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="h-8 w-8"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        
        {alerts.length > 0 ? (
          <div className="flex items-center gap-4 mt-2">
            <p className="text-sm text-muted-foreground">
              {alerts.length} alerta{alerts.length > 1 ? "s" : ""} requer{alerts.length > 1 ? "em" : ""} atenção
            </p>
            {impactoFinanceiroTotal > 0 && (
              <span className="text-xs font-medium text-destructive">
                Impacto: {formatCurrency(impactoFinanceiroTotal)}
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mt-1">
            ✓ Tudo em ordem! Nenhum alerta no momento.
          </p>
        )}
      </div>

      <AnimatePresence>
        {alerts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-8 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
              <Wrench className="w-6 h-6 text-success" />
            </div>
            <p className="text-foreground font-medium">Operação Saudável</p>
            <p className="text-sm text-muted-foreground mt-1">
              Sem alertas pendentes. Continue assim!
            </p>
          </motion.div>
        ) : (
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto scrollbar-thin">
            {alerts.map((alert, index) => {
              const config = alertConfig[alert.type];
              const styles = severityStyles[alert.severity];
              const Icon = config.icon;

              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleAlertClick(alert)}
                  className={cn(
                    "p-4 hover:bg-muted/30 transition-all cursor-pointer group",
                    alert.severity === "critical" && "bg-destructive/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border",
                        styles.bgColor,
                        styles.borderColor
                      )}
                    >
                      <Icon className={cn("w-4 h-4", styles.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-foreground truncate">
                          {alert.title}
                        </p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            styles.bgColor,
                            styles.iconColor
                          )}>
                            {alert.time}
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        {alert.description}
                      </p>
                      {alert.impactoFinanceiro !== undefined && alert.impactoFinanceiro < 0 && (
                        <p className="text-xs text-destructive mt-1 font-medium">
                          Prejuízo: {formatCurrency(Math.abs(alert.impactoFinanceiro))}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
