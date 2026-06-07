import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Wrench } from "lucide-react";
import { motion } from "framer-motion";

interface TopServicesChartProps {
  data: { name: string; value: number; }[];
}

const COLORS = [
  "hsl(200, 100%, 40%)", // Primary blue
  "hsl(24, 95%, 53%)",   // Accent orange
  "hsl(142, 76%, 36%)",  // Success green
  "hsl(280, 87%, 47%)",  // Purple
  "hsl(340, 82%, 52%)",  // Pink
];

export function TopServicesChart({ data }: TopServicesChartProps) {
  const hasData = data && data.length > 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-card rounded-xl border border-border p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Wrench className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Top Serviços</h2>
          <p className="text-sm text-muted-foreground">Tipos mais realizados</p>
        </div>
      </div>

      <div className="h-64">
        {!hasData ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Nenhum serviço registrado ainda
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string) => [value, name]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend 
                formatter={(value) => <span className="text-sm text-muted-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
