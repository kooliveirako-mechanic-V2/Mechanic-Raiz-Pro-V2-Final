import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useModalUrl } from "@/hooks/useModalUrl";
import { MobileAgenda } from "@/components/agenda/MobileAgenda";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Car,
  Bike,
  CheckCircle2,
  PlayCircle,
  AlertCircle,
  Loader2,
  User,
  Wrench,
  Phone,
  Calendar,
  DollarSign,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { OrdemServicoFormModal } from "@/components/forms/OrdemServicoFormModal";
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks, parseISO, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOficina } from "@/contexts/OficinaContext";
import { openWhatsAppAgendamento } from "@/lib/whatsapp";

type ServiceStatus = "pending" | "in-progress" | "completed" | "overdue";

const statusConfig: Record<ServiceStatus, { color: string; bgColor: string; icon: typeof Clock; label: string }> = {
  pending: { color: "text-warning", bgColor: "bg-warning", icon: Clock, label: "Aguardando" },
  "in-progress": { color: "text-info", bgColor: "bg-info", icon: PlayCircle, label: "Em Andamento" },
  completed: { color: "text-success", bgColor: "bg-success", icon: CheckCircle2, label: "Finalizado" },
  overdue: { color: "text-destructive", bgColor: "bg-destructive", icon: AlertCircle, label: "Atrasado" },
};

const mapStatusToLocal = (status: string): ServiceStatus => {
  switch (status) {
    case "finalizado":
      return "completed";
    case "em_andamento":
      return "in-progress";
    case "atrasado":
      return "overdue";
    default:
      return "pending";
  }
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

const weekTransition = {
  initial: { opacity: 0, x: 50 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -50 },
};

export default function Agenda() {
  const { ordens, isLoading } = useOrdensServico();
  const isMobile = useIsMobile();
  const { oficinaAtual } = useOficina();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useModalUrl("os-completa");
  const [direction, setDirection] = useState(0); // -1 for previous, 1 for next

  // Generate week days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // Group orders by date
  const ordersByDate = useMemo(() => {
    const grouped: Record<string, typeof ordens> = {};
    ordens.forEach((ordem) => {
      const dateKey = format(parseISO(ordem.data_servico), "yyyy-MM-dd");
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(ordem);
    });
    return grouped;
  }, [ordens]);

  // Get services for selected day
  const selectedDayServices = useMemo(() => {
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return ordersByDate[dateKey] || [];
  }, [selectedDate, ordersByDate]);

  const handlePreviousWeek = () => {
    setDirection(-1);
    setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  };

  const handleNextWeek = () => {
    setDirection(1);
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  };

  const getServicesCountForDay = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    return ordersByDate[dateKey]?.length || 0;
  };

  // Mobile view
  if (isMobile) {
    return (
      <MainLayout>
        <MobileAgenda />
      </MainLayout>
    );
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="w-8 h-8 text-accent" />
          </motion.div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4"
      >
        {/* Header Compacto */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Agenda</h1>
            <p className="text-sm text-muted-foreground">
              {ordens.length} serviços agendados
            </p>
          </div>
          <Button 
            className="bg-accent hover:bg-accent/90"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Agendar Serviço
          </Button>
        </div>

        {/* Premium Week Navigation */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl border border-border p-5"
        >
          
          <div className="flex items-center justify-between mb-5">
            <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handlePreviousWeek}
                className="rounded-full hover:bg-gradient-to-br hover:from-accent/20 hover:to-accent/10 hover:text-accent hover:shadow-lg hover:shadow-accent/10"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </motion.div>
            
            <AnimatePresence mode="wait">
              <motion.h2 
                key={currentWeekStart.toISOString()}
                initial={{ opacity: 0, y: direction > 0 ? 10 : -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: direction > 0 ? -10 : 10 }}
                className="font-bold text-foreground text-lg capitalize bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent"
              >
                {format(currentWeekStart, "MMMM yyyy", { locale: ptBR })}
              </motion.h2>
            </AnimatePresence>
            
            <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleNextWeek}
                className="rounded-full hover:bg-gradient-to-br hover:from-accent/20 hover:to-accent/10 hover:text-accent hover:shadow-lg hover:shadow-accent/10"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </motion.div>
          </div>

          {/* Days */}
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentWeekStart.toISOString()}
              initial={{ opacity: 0, x: direction * 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -50 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="grid grid-cols-7 gap-2"
            >
              {weekDays.map((day, index) => {
                const servicesCount = getServicesCountForDay(day);
                const isSelected = isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);

                return (
                  <motion.button
                    key={day.toISOString()}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "relative flex flex-col items-center p-3 rounded-xl transition-all duration-300",
                      isSelected
                        ? "bg-gradient-to-br from-accent via-accent to-accent/80 text-accent-foreground shadow-xl shadow-accent/40"
                        : isTodayDate
                        ? "bg-gradient-to-br from-primary/20 to-primary/10 text-primary ring-2 ring-primary/30 shadow-lg shadow-primary/10"
                        : "hover:bg-gradient-to-br hover:from-muted hover:to-muted/50 hover:shadow-md"
                    )}
                  >
                    <span className={cn(
                      "text-xs font-semibold mb-1 uppercase tracking-wide",
                      isSelected ? "text-accent-foreground/90" : "text-muted-foreground"
                    )}>
                      {format(day, "EEE", { locale: ptBR })}
                    </span>
                    <span className="text-xl font-bold">{format(day, "d")}</span>
                    
                    {/* Service indicators */}
                    <div className="flex gap-1 mt-2 h-2">
                      {servicesCount > 0 && (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="flex gap-0.5"
                        >
                          {Array.from({ length: Math.min(servicesCount, 3) }).map((_, i) => (
                            <motion.div
                              key={i}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: i * 0.1 }}
                              className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                isSelected
                                  ? "bg-accent-foreground/70"
                                  : "bg-accent"
                              )}
                            />
                          ))}
                          {servicesCount > 3 && (
                            <span className={cn(
                              "text-[10px] ml-0.5",
                              isSelected ? "text-accent-foreground/70" : "text-accent"
                            )}>
                              +{servicesCount - 3}
                            </span>
                          )}
                        </motion.div>
                      )}
                    </div>

                    {/* Today indicator dot */}
                    {isTodayDate && !isSelected && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full border-2 border-card"
                      />
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Premium Timeline Schedule */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl border border-border overflow-hidden"
        >
          <div className="p-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground capitalize">
                  {isToday(selectedDate) ? "Hoje" : format(selectedDate, "EEEE", { locale: ptBR })}, {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selectedDayServices.length} {selectedDayServices.length === 1 ? "serviço agendado" : "serviços agendados"}
                </p>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {selectedDayServices.length === 0 ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-12 text-center"
              >
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                  className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4"
                >
                  <Clock className="w-10 h-10 text-muted-foreground" />
                </motion.div>
                <h3 className="font-semibold text-foreground mb-2">
                  Nenhum agendamento
                </h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                  Não há serviços agendados para este dia. Aproveite para organizar outros serviços!
                </p>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsModalOpen(true)}
                    className="border-dashed border-2"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agendar Serviço
                  </Button>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div 
                key="timeline"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="p-6"
              >
                {/* Timeline */}
                <div className="relative">
                  {/* Vertical Line */}
                  <div className="absolute left-[23px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-accent via-accent/50 to-transparent" />

                  {selectedDayServices.map((ordem, index) => {
                    const localStatus = mapStatusToLocal(ordem.status);
                    const status = statusConfig[localStatus];
                    const StatusIcon = status.icon;
                    const vehicleType = ordem.veiculo?.tipo === "moto" ? "moto" : "car";

                    return (
                      <motion.div
                        key={ordem.id}
                        variants={itemVariants}
                        className="relative pl-14 pb-8 last:pb-0"
                      >
                        {/* Timeline Node */}
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: index * 0.1 + 0.2 }}
                          className={cn(
                            "absolute left-0 w-12 h-12 rounded-xl flex items-center justify-center z-10 shadow-lg",
                            status.bgColor
                          )}
                        >
                          <StatusIcon className="w-5 h-5 text-white" />
                        </motion.div>

                        {/* Card with Hover Preview */}
                        <HoverCard openDelay={200} closeDelay={100}>
                          <HoverCardTrigger asChild>
                            <motion.div
                              whileHover={{ scale: 1.01, x: 4 }}
                              whileTap={{ scale: 0.99 }}
                              className={cn(
                                "group bg-gradient-to-r from-muted/50 to-transparent rounded-xl p-4 cursor-pointer",
                                "border border-transparent hover:border-accent/20 hover:shadow-md",
                                "transition-all duration-300"
                              )}
                            >
                              <div className="flex items-start gap-4">
                                {/* Time Column */}
                                <div className="min-w-[70px]">
                                  <p className="text-lg font-bold text-foreground">
                                    {ordem.hora_agendamento 
                                      ? ordem.hora_agendamento.slice(0, 5) 
                                      : "A definir"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {ordem.valor_servico 
                                      ? `R$ ${ordem.valor_servico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                                      : "A definir"}
                                  </p>
                                </div>

                                {/* Vehicle Icon */}
                                <motion.div 
                                  whileHover={{ rotate: [0, -5, 5, 0] }}
                                  transition={{ duration: 0.5 }}
                                  className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                                    "bg-primary/10 group-hover:bg-primary/15 transition-colors"
                                  )}
                                >
                                  {vehicleType === "car" ? (
                                    <Car className="w-6 h-6 text-primary" />
                                  ) : (
                                    <Bike className="w-6 h-6 text-primary" />
                                  )}
                                </motion.div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <h3 className="font-semibold text-foreground">
                                      {ordem.cliente?.nome || "Cliente"}
                                    </h3>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-xs font-medium transition-all",
                                        localStatus === "completed" && "bg-success/10 text-success border-success/20",
                                        localStatus === "in-progress" && "bg-info/10 text-info border-info/20",
                                        localStatus === "pending" && "bg-warning/10 text-warning border-warning/20",
                                        localStatus === "overdue" && "bg-destructive/10 text-destructive border-destructive/20"
                                      )}
                                    >
                                      {status.label}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {ordem.veiculo?.marca} {ordem.veiculo?.modelo}
                                    {ordem.veiculo?.placa && (
                                      <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">
                                        {ordem.veiculo.placa}
                                      </span>
                                    )}
                                  </p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">
                                      {ordem.tipo_servico}
                                    </span>
                                  </div>
                                  {ordem.responsavel_nome && (
                                    <div className="flex items-center gap-2 mt-1">
                                      <User className="w-3.5 h-3.5 text-accent" />
                                      <span className="text-sm text-accent font-medium">
                                        {ordem.responsavel_nome}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Share button */}
                                <div className="flex flex-col items-center gap-2 self-center">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-primary hover:bg-primary/10"
                                    title="Enviar agendamento pelo WhatsApp"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openWhatsAppAgendamento(ordem, oficinaAtual?.nome || "Oficina");
                                    }}
                                  >
                                    <Share2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          </HoverCardTrigger>
                          
                          {/* Hover Preview Card */}
                          <HoverCardContent 
                            side="right" 
                            align="start"
                            className="w-80 p-0 overflow-hidden"
                          >
                            <div className={cn(
                              "p-4 text-white",
                              status.bgColor
                            )}>
                              <div className="flex items-center gap-2">
                                <StatusIcon className="w-5 h-5" />
                                <span className="font-medium">{status.label}</span>
                              </div>
                              <p className="text-sm opacity-90 mt-1">
                                {ordem.tipo_servico}
                              </p>
                            </div>
                            
                            <div className="p-4 space-y-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <User className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{ordem.cliente?.nome || "Cliente"}</p>
                                  <p className="text-xs text-muted-foreground">Cliente</p>
                                </div>
                              </div>

                              {ordem.cliente?.telefone && (
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                                    <Phone className="w-4 h-4 text-success" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">{ordem.cliente.telefone}</p>
                                    <p className="text-xs text-muted-foreground">Telefone</p>
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                                  {vehicleType === "car" ? (
                                    <Car className="w-4 h-4 text-accent" />
                                  ) : (
                                    <Bike className="w-4 h-4 text-accent" />
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">
                                    {ordem.veiculo?.marca} {ordem.veiculo?.modelo}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {ordem.veiculo?.placa || "Sem placa"}
                                  </p>
                                </div>
                              </div>

                              {ordem.responsavel_nome && (
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
                                    <User className="w-4 h-4 text-info" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">{ordem.responsavel_nome}</p>
                                    <p className="text-xs text-muted-foreground">Responsável</p>
                                  </div>
                                </div>
                              )}

                              {ordem.valor_servico && (
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                                    <DollarSign className="w-4 h-4 text-warning" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">
                                      R$ {ordem.valor_servico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Valor do serviço</p>
                                  </div>
                                </div>
                              )}

                              {ordem.descricao && (
                                <div className="pt-2 border-t border-border">
                                  <p className="text-xs text-muted-foreground mb-1">Descrição:</p>
                                  <p className="text-sm text-foreground line-clamp-2">
                                    {ordem.descricao}
                                  </p>
                                </div>
                              )}
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      <OrdemServicoFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        initialDate={format(selectedDate, "yyyy-MM-dd")}
      />
    </MainLayout>
  );
}
