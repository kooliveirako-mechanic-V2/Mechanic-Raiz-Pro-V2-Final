import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Clock,
  Car,
  Bike,
  CheckCircle2,
  PlayCircle,
  AlertCircle,
  Phone,
  ChevronLeft,
  ChevronRight,
  User,
  Loader2,
  Calendar,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { OrdemServicoFormModal } from "@/components/forms/OrdemServicoFormModal";
import { useOficina } from "@/contexts/OficinaContext";
import { openWhatsAppAgendamento } from "@/lib/whatsapp";
import {
  format,
  parseISO,
  isToday,
  isSameDay,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

type ServiceStatus = "pending" | "in-progress" | "completed" | "overdue";

const statusConfig: Record<ServiceStatus, { color: string; bgColor: string; icon: typeof Clock; label: string }> = {
  pending: { color: "text-warning", bgColor: "bg-warning", icon: Clock, label: "Aguardando" },
  "in-progress": { color: "text-info", bgColor: "bg-info", icon: PlayCircle, label: "Andamento" },
  completed: { color: "text-success", bgColor: "bg-success", icon: CheckCircle2, label: "Finalizado" },
  overdue: { color: "text-destructive", bgColor: "bg-destructive", icon: AlertCircle, label: "Atrasado" },
};

const mapStatusToLocal = (status: string): ServiceStatus => {
  switch (status) {
    case "finalizado": return "completed";
    case "em_andamento": return "in-progress";
    case "atrasado": return "overdue";
    default: return "pending";
  }
};

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function MobileAgenda() {
  const { ordens, isLoading } = useOrdensServico();
  const { oficinaAtual } = useOficina();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: Date[] = [];
    let day = calStart;
    while (day <= calEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  // Count services per date
  const servicesByDate = useMemo(() => {
    const map: Record<string, typeof ordens> = {};
    ordens.forEach((ordem) => {
      const key = format(parseISO(ordem.data_servico), "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(ordem);
    });
    return map;
  }, [ordens]);

  const selectedDayServices = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    return servicesByDate[key] || [];
  }, [selectedDate, servicesByDate]);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      {/* Header — limpo */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Calendar className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">Agenda</h1>
          <p className="text-xs text-muted-foreground">{ordens.length} agendamentos</p>
        </div>
      </div>

      {/* Full Calendar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-xl border border-border p-3"
      >
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={handlePrevMonth}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <button onClick={handleToday} className="text-center">
            <p className="font-bold text-base capitalize text-foreground">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </p>
          </button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={handleNextMonth}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="text-center text-xs font-semibold text-muted-foreground py-1">
              {label}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const count = servicesByDate[key]?.length || 0;
            const isSelected = isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);

            return (
              <button
                key={key}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "relative flex flex-col items-center justify-center h-14 rounded-xl text-sm transition-all active:scale-95",
                  !isCurrentMonth && "opacity-40",
                  isSelected
                    ? "bg-accent text-accent-foreground font-bold shadow-lg shadow-accent/30 ring-2 ring-accent/50"
                    : isTodayDate
                    ? "bg-primary/15 text-primary font-bold ring-2 ring-primary/40"
                    : "hover:bg-muted/60"
                )}
              >
                <span className="text-[15px]">{format(day, "d")}</span>
                {count > 0 && (
                  <div className={cn(
                    "absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1.5 rounded-full",
                    count === 1 ? "w-3" : count === 2 ? "w-5" : "w-7",
                    isSelected ? "bg-accent-foreground/60" : "bg-accent"
                  )} />
                )}
              </button>
            );
          })}
        </div>

        {/* Today button */}
        {!isSameMonth(new Date(), currentMonth) && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 h-9 text-sm border-accent/30 text-accent hover:bg-accent/10"
            onClick={handleToday}
          >
            Ir para Hoje
          </Button>
        )}
      </motion.div>

      {/* Selected Day Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex items-center justify-between px-1"
      >
        <div>
          <p className="font-bold text-foreground capitalize">
            {isToday(selectedDate)
              ? "Hoje"
              : format(selectedDate, "EEEE", { locale: ptBR })}
            {", "}
            <span className="font-normal text-muted-foreground">
              {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
            </span>
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {selectedDayServices.length}{" "}
          {selectedDayServices.length === 1 ? "agendamento" : "agendamentos"}
        </Badge>
      </motion.div>

      {/* Services List */}
      <AnimatePresence mode="wait">
        {selectedDayServices.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-card rounded-2xl border border-border p-8 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Clock className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="font-bold text-foreground mb-1">Nenhum agendamento</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isToday(selectedDate) ? "Nenhum serviço para hoje" : "Nenhum serviço para esta data"}
            </p>
            <Button
              className="bg-accent hover:bg-accent/90"
              size="sm"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Agendar
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            {selectedDayServices.map((ordem, index) => {
              const localStatus = mapStatusToLocal(ordem.status);
              const status = statusConfig[localStatus];
              const StatusIcon = status.icon;
              const vehicleType = ordem.veiculo?.tipo === "moto" ? "moto" : "car";

              return (
                <motion.div
                  key={ordem.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-card rounded-2xl border border-border p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    {/* Status Icon */}
                    <div
                      className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
                        status.bgColor
                      )}
                    >
                      <StatusIcon className="w-5 h-5 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-foreground">
                          {ordem.hora_agendamento
                            ? ordem.hora_agendamento.slice(0, 5)
                            : "Sem hora"}
                        </span>
                        <Badge variant="outline" className={cn("text-[10px]", status.color)}>
                          {status.label}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        {vehicleType === "moto" ? (
                          <Bike className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <Car className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium text-foreground truncate">
                          {ordem.cliente?.nome || "Cliente"}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {ordem.veiculo?.marca} {ordem.veiculo?.modelo} • {ordem.tipo_servico}
                      </p>

                      {ordem.responsavel_nome && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <User className="w-3 h-3 text-accent" />
                          <span className="text-xs text-accent">{ordem.responsavel_nome}</span>
                        </div>
                      )}

                      {/* Ações: telefone + compartilhar */}
                      <div className="flex items-center gap-2 mt-2">
                        {ordem.cliente?.telefone && (
                          <a
                            href={`tel:${ordem.cliente.telefone}`}
                            className="inline-flex items-center gap-1 text-xs text-accent"
                          >
                            <Phone className="w-3 h-3" />
                            {ordem.cliente.telefone}
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-primary gap-1 ml-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            openWhatsAppAgendamento(ordem, oficinaAtual?.nome || "Oficina");
                          }}
                        >
                          <Share2 className="w-3 h-3" />
                          Enviar
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Nova OS */}
      <OrdemServicoFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        initialDate={format(selectedDate, "yyyy-MM-dd")}
      />

      {/* FAB — azul sólido, sem glow */}
      <div className="fixed bottom-24 right-4 z-50">
        <Button
          onClick={() => setIsModalOpen(true)}
          size="lg"
          className="w-12 h-12 rounded-full bg-primary hover:bg-primary/90 shadow-md"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
