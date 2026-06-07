import { Users, TrendingUp, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/formatters";

interface TopClient {
  id: string;
  nome: string;
  totalServicos: number;
  valorTotal: number;
}

interface TopClientsTableProps {
  data: TopClient[];
}

export function TopClientsTable({ data }: TopClientsTableProps) {
  const navigate = useNavigate();
  const hasData = data && data.length > 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="bg-card rounded-xl border border-border overflow-hidden"
    >
      <div className="p-5 border-b border-border flex items-center justify-between bg-gradient-to-r from-accent/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Top Clientes</h2>
            <p className="text-sm text-muted-foreground">Mais frequentes este mês</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/clientes")}>
          Ver todos <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <div className="divide-y divide-border">
        {!hasData ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Nenhum cliente com serviços ainda
          </div>
        ) : (
          data.slice(0, 5).map((client, index) => (
            <motion.div 
              key={client.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * index }}
              whileHover={{ backgroundColor: "hsl(var(--muted) / 0.3)" }}
              className="p-4 flex items-center justify-between cursor-pointer"
              onClick={() => navigate("/clientes")}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-bold">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-foreground">{client.nome}</p>
                  <p className="text-xs text-muted-foreground">{client.totalServicos} serviço(s)</p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  {formatCurrency(client.valorTotal)}
                </Badge>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}
