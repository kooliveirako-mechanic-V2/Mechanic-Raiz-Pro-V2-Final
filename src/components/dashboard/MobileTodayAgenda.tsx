import { useNavigate } from "react-router-dom";
import { Clock, ChevronRight, Calendar } from "lucide-react";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { isToday, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

export function MobileTodayAgenda() {
  const navigate = useNavigate();
  const { ordens, isLoading } = useOrdensServico();

  if (isLoading) return null;

  const todayScheduled = ordens
    .filter(os => {
      if (!os.data_servico) return false;
      return isToday(parseISO(os.data_servico)) && os.hora_agendamento;
    })
    .sort((a, b) => (a.hora_agendamento || "").localeCompare(b.hora_agendamento || ""))
    .slice(0, 3);

  if (todayScheduled.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border border-border/70 overflow-hidden">
      <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Calendar className="w-3 h-3 text-violet-500" />
          </div>
          <span className="font-semibold text-xs text-foreground">Agenda de hoje</span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-violet-500/10 text-violet-500 rounded-full">
            {todayScheduled.length}
          </span>
        </div>
        <button
          onClick={() => navigate("/agenda")}
          className="text-[10px] text-primary font-medium flex items-center gap-0.5"
        >
          Ver agenda
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="divide-y divide-border/40">
        {todayScheduled.map((os) => (
          <button
            key={os.id}
            onClick={() => navigate("/servicos")}
            className="w-full flex items-center gap-2.5 p-2.5 active:bg-muted/30 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex flex-col items-center justify-center flex-shrink-0">
              <Clock className="w-3 h-3 text-violet-500 mb-0.5" />
              <span className="text-[10px] font-bold text-violet-500">
                {os.hora_agendamento!.substring(0, 5)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-xs truncate">
                {os.cliente?.nome || "Cliente"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {os.veiculo?.modelo} • {os.tipo_servico}
              </p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
