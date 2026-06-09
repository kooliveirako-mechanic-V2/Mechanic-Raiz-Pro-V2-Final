import { useNavigate } from "react-router-dom";
import { Calendar, Clock, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { isToday, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

export function TodayAgendaPanel() {
  const navigate = useNavigate();
  const { ordens, isLoading } = useOrdensServico();

  const todayScheduled = ordens
    .filter(os => {
      if (!os.data_servico) return false;
      return isToday(parseISO(os.data_servico)) && os.hora_agendamento;
    })
    .sort((a, b) => (a.hora_agendamento || "").localeCompare(b.hora_agendamento || ""))
    .slice(0, 4);

  const formatTime = (time: string) => time.substring(0, 5);

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border/50 p-4">
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="space-y-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-11 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-card rounded-xl border border-border/50 overflow-hidden"
    >
      <div className="flex items-center justify-between p-4 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">Agenda de Hoje</h3>
          {todayScheduled.length > 0 && (
            <span className="px-2 py-0.5 text-[11px] font-medium bg-primary/10 text-primary rounded-full">
              {todayScheduled.length}
            </span>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate("/agenda")}
          className="text-xs text-muted-foreground h-7"
        >
          Ver agenda
          <ChevronRight className="w-3 h-3 ml-0.5" />
        </Button>
      </div>

      {todayScheduled.length === 0 ? (
        <div className="p-5 text-center">
          <Calendar className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-2">Nenhum agendamento hoje</p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate("/agenda")}
            className="text-xs h-8"
          >
            <Plus className="w-3 h-3 mr-1" />
            Agendar serviço
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {todayScheduled.map((os) => (
            <button
              key={os.id}
              onClick={() => navigate("/servicos")}
              className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
                <Clock className="w-3.5 h-3.5 text-primary mb-0.5" />
                <span className="text-[10px] font-bold text-primary">
                  {formatTime(os.hora_agendamento!)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">
                  {os.cliente?.nome || "Cliente"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {os.veiculo?.modelo} · {os.tipo_servico}
                </p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
