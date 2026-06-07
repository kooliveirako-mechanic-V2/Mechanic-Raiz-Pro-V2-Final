import { motion } from "framer-motion";
import { AlertTriangle, TrendingDown, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

interface FinanceiroAlertsProps {
  lucroTotal: number;
  totalSaidas: number;
  totalEntradas: number;
  totalAPagar: number;
  totalAReceber: number;
  percentualMudanca: number;
  alertaLucroInflado?: boolean;
}

export function FinanceiroAlerts({
  lucroTotal,
  totalSaidas,
  totalEntradas,
  totalAPagar,
  totalAReceber,
  percentualMudanca,
  alertaLucroInflado,
}: FinanceiroAlertsProps) {
  const alerts: { icon: React.ElementType; message: string; type: "warning" | "danger" | "info" }[] = [];

  // Alerta de Lucro Inflado (Backfill pendente)
  if (alertaLucroInflado) {
    alerts.push({
      icon: AlertTriangle,
      message: "Este período possui 17 itens históricos sem custo. O lucro operacional pode estar inflado em aproximadamente R$ 350,88 até a normalização estimada ser aprovada.",
      type: "warning",
    });
  }

  // Mês no vermelho
  if (lucroTotal < 0) {
    alerts.push({
      icon: TrendingDown,
      message: `Atenção! Mês no vermelho: despesas ${formatCurrency(Math.abs(lucroTotal))} acima da receita.`,
      type: "danger",
    });
  }

  // Despesas altas (mais de 80% da receita)
  if (totalEntradas > 0 && totalSaidas / totalEntradas > 0.8 && lucroTotal >= 0) {
    const percentual = Math.round((totalSaidas / totalEntradas) * 100);
    alerts.push({
      icon: AlertTriangle,
      message: `Despesas representam ${percentual}% da receita. Considere revisar gastos.`,
      type: "warning",
    });
  }

  // Queda significativa em relação ao mês anterior
  if (percentualMudanca < -20) {
    alerts.push({
      icon: TrendingDown,
      message: `Receita ${Math.abs(percentualMudanca)}% menor que o mês anterior.`,
      type: "warning",
    });
  }

  // Valores a receber pendentes
  if (totalAReceber > 0) {
    alerts.push({
      icon: Clock,
      message: `${formatCurrency(totalAReceber)} a receber pendente.`,
      type: "info",
    });
  }

  // Valores a pagar pendentes
  if (totalAPagar > 0) {
    alerts.push({
      icon: AlertCircle,
      message: `${formatCurrency(totalAPagar)} a pagar pendente.`,
      type: "warning",
    });
  }

  if (alerts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      {alerts.map((alert, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg border",
            alert.type === "danger" && "bg-destructive/10 border-destructive/30 text-destructive",
            alert.type === "warning" && "bg-warning/10 border-warning/30 text-warning",
            alert.type === "info" && "bg-primary/10 border-primary/30 text-primary"
          )}
        >
          <alert.icon className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{alert.message}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}
