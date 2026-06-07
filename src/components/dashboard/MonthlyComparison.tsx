import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/formatters";

interface MonthlyComparisonProps {
  currentMonth: {
    servicos: number;
    faturamento: number;
    clientes: number;
  };
  previousMonth: {
    servicos: number;
    faturamento: number;
    clientes: number;
  };
}

export function MonthlyComparison({ currentMonth, previousMonth }: MonthlyComparisonProps) {
  const calcVariation = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const metrics = [
    {
      label: "Serviços",
      current: currentMonth.servicos,
      previous: previousMonth.servicos,
      variation: calcVariation(currentMonth.servicos, previousMonth.servicos),
      format: (v: number) => v.toString(),
    },
    {
      label: "Faturamento",
      current: currentMonth.faturamento,
      previous: previousMonth.faturamento,
      variation: calcVariation(currentMonth.faturamento, previousMonth.faturamento),
      format: formatCurrency,
    },
    {
      label: "Novos Clientes",
      current: currentMonth.clientes,
      previous: previousMonth.clientes,
      variation: calcVariation(currentMonth.clientes, previousMonth.clientes),
      format: (v: number) => v.toString(),
    },
  ];

  const chartData = [
    { name: "Mês Anterior", servicos: previousMonth.servicos, faturamento: previousMonth.faturamento / 100 },
    { name: "Mês Atual", servicos: currentMonth.servicos, faturamento: currentMonth.faturamento / 100 },
  ];

  const getVariationIcon = (variation: number) => {
    if (variation > 0) return <TrendingUp className="w-4 h-4 text-success" />;
    if (variation < 0) return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getVariationColor = (variation: number) => {
    if (variation > 0) return "text-success";
    if (variation < 0) return "text-destructive";
    return "text-muted-foreground";
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="bg-card rounded-xl border border-border p-6"
    >
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Comparativo Mensal</h2>
        <p className="text-sm text-muted-foreground">Este mês vs mês anterior</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 * index }}
            className="bg-muted/30 rounded-lg p-4 text-center"
          >
            <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
            <p className="text-xl font-bold text-foreground">{metric.format(metric.current)}</p>
            <div className={`flex items-center justify-center gap-1 mt-2 text-xs ${getVariationColor(metric.variation)}`}>
              {getVariationIcon(metric.variation)}
              <span>{Math.abs(metric.variation).toFixed(0)}%</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bar Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
            <XAxis dataKey="name" tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip 
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Legend />
            <Bar dataKey="servicos" name="Serviços" fill="hsl(200, 100%, 40%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="faturamento" name="Faturamento (x100)" fill="hsl(24, 95%, 53%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
