import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface ChartDataPoint {
  mes: string;
  faturamentoLiquido: number;
  lucroOperacional: number;
}

interface RevenueChartProps {
  data?: ChartDataPoint[];
}

const defaultData = [
  { mes: "Jan", faturamentoLiquido: 0, lucroOperacional: 0 },
  { mes: "Fev", faturamentoLiquido: 0, lucroOperacional: 0 },
  { mes: "Mar", faturamentoLiquido: 0, lucroOperacional: 0 },
  { mes: "Abr", faturamentoLiquido: 0, lucroOperacional: 0 },
  { mes: "Mai", faturamentoLiquido: 0, lucroOperacional: 0 },
  { mes: "Jun", faturamentoLiquido: 0, lucroOperacional: 0 },
];

export function RevenueChart({ data }: RevenueChartProps) {
  const chartData = data && data.length > 0 ? data : defaultData;
  const hasData = chartData.some(d => d.faturamentoLiquido > 0 || d.lucroOperacional > 0);

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Faturamento vs Lucro
          </h2>
          <p className="text-sm text-muted-foreground">Últimos 6 meses</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10 text-success">
          <TrendingUp className="w-4 h-4" />
        </div>
      </div>

      <div className="h-64">
        {!hasData ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Finalize serviços para ver o gráfico
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(222, 47%, 20%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(222, 47%, 20%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorLucro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(24, 95%, 53%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(24, 95%, 53%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="mes" tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => [formatCurrency(value)]} />
              <Area type="monotone" dataKey="faturamentoLiquido" stroke="hsl(222, 47%, 20%)" strokeWidth={2} fill="url(#colorFaturamento)" name="Faturamento" />
              <Area type="monotone" dataKey="lucroOperacional" stroke="hsl(24, 95%, 53%)" strokeWidth={2} fill="url(#colorLucro)" name="Lucro" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(222, 47%, 20%)" }} />
          <span className="text-xs text-muted-foreground">Faturamento Líquido</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(24, 95%, 53%)" }} />
          <span className="text-xs text-muted-foreground">Lucro Operacional</span>
        </div>
      </div>
    </div>
  );
}