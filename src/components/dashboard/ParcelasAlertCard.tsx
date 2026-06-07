import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useParcelasPendentes } from "@/hooks/useParcelas";
import { CreditCard, AlertTriangle, Clock, ChevronRight, DollarSign } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ParcelasAlertCardProps {
  className?: string;
}

export function ParcelasAlertCard({ className }: ParcelasAlertCardProps) {
  const { parcelas, atrasadas, vencendoHoje, totalPendente, isLoading } = useParcelasPendentes();

  if (isLoading || parcelas.length === 0) return null;

  const temAlerta = atrasadas.length > 0 || vencendoHoje.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border p-4",
        temAlerta 
          ? "bg-gradient-to-br from-destructive/5 via-warning/5 to-transparent border-warning/30"
          : "bg-gradient-to-br from-primary/5 to-transparent border-primary/20",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            temAlerta ? "bg-warning/10" : "bg-primary/10"
          )}>
            <CreditCard className={cn(
              "w-5 h-5",
              temAlerta ? "text-warning" : "text-primary"
            )} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Parcelas a Receber</h3>
            <p className="text-xs text-muted-foreground">
              {parcelas.length} parcela{parcelas.length > 1 ? "s" : ""} pendente{parcelas.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono font-bold text-lg">
            R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground">total pendente</p>
        </div>
      </div>

      {/* Alertas */}
      {temAlerta && (
        <div className="space-y-2 mb-3">
          {atrasadas.length > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <span className="text-sm font-medium text-destructive">
                {atrasadas.length} parcela{atrasadas.length > 1 ? "s" : ""} atrasada{atrasadas.length > 1 ? "s" : ""}
              </span>
              <Badge className="bg-destructive/20 text-destructive ml-auto text-xs">
                R$ {atrasadas.reduce((s, p) => s + Number(p.valor), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </Badge>
            </div>
          )}

          {vencendoHoje.length > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-warning/10">
              <Clock className="w-4 h-4 text-warning shrink-0" />
              <span className="text-sm font-medium text-warning">
                {vencendoHoje.length} parcela{vencendoHoje.length > 1 ? "s" : ""} vence{vencendoHoje.length > 1 ? "m" : ""} hoje
              </span>
              <Badge className="bg-warning/20 text-warning ml-auto text-xs">
                R$ {vencendoHoje.reduce((s, p) => s + Number(p.valor), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* Próximas parcelas (max 3) */}
      <div className="space-y-1">
        {parcelas.slice(0, 3).map((parcela) => {
          const os = parcela.ordem_servico as any;
          const orc = parcela.orcamento as any;
          const referencia = os?.tipo_servico || orc?.titulo || "Serviço";
          const cliente = os?.cliente?.nome || orc?.cliente?.nome || "";
          const isAtrasada = parcela.status === "atrasado";
          const isHoje = parcela.data_vencimento === new Date().toISOString().split("T")[0];

          return (
            <div
              key={parcela.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md text-sm",
                isAtrasada ? "bg-destructive/5" : isHoje ? "bg-warning/5" : "bg-muted/30"
              )}
            >
              <div className={cn(
                "w-6 h-6 rounded flex items-center justify-center shrink-0 text-xs font-bold",
                isAtrasada ? "bg-destructive/20 text-destructive" : 
                isHoje ? "bg-warning/20 text-warning" : "bg-muted"
              )}>
                {parcela.numero_parcela}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-xs">{referencia}</p>
                {cliente && (
                  <p className="text-xs text-muted-foreground truncate">{cliente}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono font-semibold text-xs">
                  R$ {Number(parcela.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className={cn(
                  "text-[10px]",
                  isAtrasada ? "text-destructive" : isHoje ? "text-warning" : "text-muted-foreground"
                )}>
                  {format(parseISO(parcela.data_vencimento), "dd/MM", { locale: ptBR })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {parcelas.length > 3 && (
        <Button variant="ghost" size="sm" className="w-full mt-2 text-xs h-8">
          Ver todas ({parcelas.length} parcelas)
          <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      )}
    </motion.div>
  );
}
