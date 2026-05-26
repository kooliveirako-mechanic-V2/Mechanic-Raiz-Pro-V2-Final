import { OrdemServico, StatusOS } from "@/hooks/useOrdensServico";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Car, Bike, Clock, PlayCircle, Package, CheckCircle2, Phone, ChevronLeft, ChevronRight, User, Zap, Wrench, AlertTriangle, Timer } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useOficinaLabels } from "@/hooks/useOficinaLabels";
import { getElapsedTime, getTimeSinceUpdate } from "@/lib/osUtils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useOficina } from "@/contexts/OficinaContext";

interface KanbanViewProps {
  ordens: OrdemServico[];
  onEdit: (ordem: OrdemServico) => void;
  onUpdateStatus: (id: string, status: StatusOS) => void;
  filtroResponsavel?: string;
  onFiltroResponsavelChange?: (id: string) => void;
}

type KanbanStatus = "pendente" | "em_diagnostico" | "em_andamento" | "aguardando_peca" | "finalizado";
// NOTE: 'cancelado' OS are intentionally excluded from Kanban view

// Colunas padrão
const defaultKanbanColumns: { status: KanbanStatus; label: string; shortLabel: string; icon: typeof Clock; color: string; bgColor: string }[] = [
  { status: "pendente", label: "Pendente", shortLabel: "Pend.", icon: Clock, color: "text-warning", bgColor: "bg-warning/10" },
  { status: "em_diagnostico", label: "Em Diagnóstico", shortLabel: "Diagn.", icon: Wrench, color: "text-accent", bgColor: "bg-accent/10" },
  { status: "em_andamento", label: "Em Execução", shortLabel: "Exec.", icon: PlayCircle, color: "text-info", bgColor: "bg-info/10" },
  { status: "aguardando_peca", label: "Aguardando Peça", shortLabel: "Peça", icon: Package, color: "text-highlight", bgColor: "bg-highlight/10" },
  { status: "finalizado", label: "Finalizado", shortLabel: "Final.", icon: CheckCircle2, color: "text-success", bgColor: "bg-success/10" },
];

// Colunas para Auto Elétrica
const autoEletricaKanbanColumns: { status: KanbanStatus; label: string; shortLabel: string; icon: typeof Clock; color: string; bgColor: string }[] = [
  { status: "pendente", label: "Aguardando Análise", shortLabel: "Análise", icon: Clock, color: "text-warning", bgColor: "bg-warning/10" },
  { status: "em_diagnostico", label: "Em Diagnóstico", shortLabel: "Diagn.", icon: Wrench, color: "text-accent", bgColor: "bg-accent/10" },
  { status: "em_andamento", label: "Execução", shortLabel: "Exec.", icon: PlayCircle, color: "text-info", bgColor: "bg-info/10" },
  { status: "aguardando_peca", label: "Aguard. Componente", shortLabel: "Comp.", icon: Package, color: "text-highlight", bgColor: "bg-highlight/10" },
  { status: "finalizado", label: "Finalizado", shortLabel: "Final.", icon: CheckCircle2, color: "text-success", bgColor: "bg-success/10" },
];

export function KanbanView({ ordens, onEdit, onUpdateStatus, filtroResponsavel, onFiltroResponsavelChange }: KanbanViewProps) {
  const isMobile = useIsMobile();
  const { isAutoEletrica } = useOficinaLabels();
  const { oficinaAtual } = useOficina();
  const [activeColumn, setActiveColumn] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get unique responsaveis for filter
  const responsaveis = useMemo(() => {
    const map = new Map<string, string>();
    ordens.forEach(o => {
      if (o.responsavel_id && o.responsavel_nome) {
        map.set(o.responsavel_id, o.responsavel_nome);
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [ordens]);

  // Filter ordens by responsavel
  const filteredOrdens = useMemo(() => {
    if (!filtroResponsavel) return ordens;
    return ordens.filter(o => o.responsavel_id === filtroResponsavel);
  }, [ordens, filtroResponsavel]);

  // Selecionar colunas baseado no tipo de oficina
  const kanbanColumns = isAutoEletrica ? autoEletricaKanbanColumns : defaultKanbanColumns;

  // P1 FIX #4: Fetch itens_os totals to show full OS value (mão de obra + peças)
  // CAUSA RAIZ: Batch em chunks de 200 para evitar exceder limite de URL do PostgREST
  const osIds = useMemo(() => ordens.map(o => o.id), [ordens]);
  const { data: itensTotals } = useQuery({
    queryKey: ["itens_os_totals", oficinaAtual?.id, osIds],
    queryFn: async () => {
      if (osIds.length === 0) return {};
      const CHUNK = 200;
      const totals: Record<string, number> = {};
      for (let i = 0; i < osIds.length; i += CHUNK) {
        const chunk = osIds.slice(i, i + CHUNK);
        const { data } = await supabase
          .from("itens_os")
          .select("ordem_servico_id, valor_total")
          .in("ordem_servico_id", chunk);
        (data || []).forEach(item => {
          totals[item.ordem_servico_id] = (totals[item.ordem_servico_id] || 0) + (item.valor_total || 0);
        });
      }
      return totals;
    },
    enabled: !!oficinaAtual && osIds.length > 0,
    staleTime: 30000,
  });

  // CAUSA RAIZ: valor_servico já contém a soma de todos itens_os (via recalcOSTotals).
  // NÃO somar itens novamente — isso causava double-counting no Kanban.
  // Usamos itensTotals apenas como fallback caso valor_servico esteja zerado/desatualizado.
  const getOSTotal = (ordem: OrdemServico) => {
    const valorOS = Number(ordem.valor_servico || 0);
    if (valorOS > 0) return valorOS;
    // Fallback: se valor_servico não foi calculado, usar soma dos itens
    return itensTotals?.[ordem.id] || 0;
  };

  const getOrdersByStatus = (status: KanbanStatus) => {
    return filteredOrdens.filter((o) => o.status === status);
  };

  const getColumnTotal = (orders: OrdemServico[]) => {
    return orders.reduce((acc, o) => acc + getOSTotal(o), 0);
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}`;
  };

  // P0 FIX: Touch event support for mobile drag-and-drop
  const [draggedOrdem, setDraggedOrdem] = useState<string | null>(null);
  
  const handleDragStart = (e: React.DragEvent | React.TouchEvent, ordem: OrdemServico) => {
    setDraggedOrdem(ordem.id);
    if ('dataTransfer' in e) {
      e.dataTransfer.setData("ordemId", ordem.id);
    }
  };

  const handleDragEnd = () => {
    setDraggedOrdem(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: KanbanStatus) => {
    e.preventDefault();
    const ordemId = e.dataTransfer.getData("ordemId") || draggedOrdem;
    if (ordemId) {
      onUpdateStatus(ordemId, status as StatusOS);
    }
    setDraggedOrdem(null);
  };

  // Mobile navigation
  const goToColumn = (index: number) => {
    setActiveColumn(index);
    if (scrollRef.current) {
      const columnWidth = scrollRef.current.scrollWidth / kanbanColumns.length;
      scrollRef.current.scrollTo({ left: columnWidth * index, behavior: "smooth" });
    }
  };

  const nextColumn = () => {
    if (activeColumn < kanbanColumns.length - 1) {
      goToColumn(activeColumn + 1);
    }
  };

  const prevColumn = () => {
    if (activeColumn > 0) {
      goToColumn(activeColumn - 1);
    }
  };

  // Update active column based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current && isMobile) {
        const scrollLeft = scrollRef.current.scrollLeft;
        const columnWidth = scrollRef.current.scrollWidth / kanbanColumns.length;
        const newActive = Math.round(scrollLeft / columnWidth);
        setActiveColumn(Math.min(newActive, kanbanColumns.length - 1));
      }
    };

    const ref = scrollRef.current;
    if (ref) {
      ref.addEventListener("scroll", handleScroll);
      return () => ref.removeEventListener("scroll", handleScroll);
    }
  }, [isMobile]);

  // Mobile View
  if (isMobile) {
    return (
      <div className="space-y-3">
        {/* Mechanic Filter */}
        {responsaveis.length > 0 && onFiltroResponsavelChange && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => onFiltroResponsavelChange("")}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                !filtroResponsavel ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              <User className="w-3 h-3" />
              Todos
            </button>
            {responsaveis.map((r) => (
              <button
                key={r.id}
                onClick={() => onFiltroResponsavelChange(r.id === filtroResponsavel ? "" : r.id)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                  filtroResponsavel === r.id ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                <User className="w-3 h-3" />
                {r.nome}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
          {kanbanColumns.map((column, index) => {
            const Icon = column.icon;
            const columnOrders = getOrdersByStatus(column.status);
            const isActive = activeColumn === index;

            return (
              <button
                key={column.status}
                onClick={() => goToColumn(index)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                  isActive
                    ? `${column.bgColor} ${column.color}`
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {column.shortLabel}
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                  {columnOrders.length}
                </Badge>
              </button>
            );
          })}
        </div>

        {/* Swipeable Columns */}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-4 px-4 pb-4"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {kanbanColumns.map((column) => {
            const Icon = column.icon;
            const columnOrders = getOrdersByStatus(column.status);

            return (
              <div
                key={column.status}
                className="flex-shrink-0 w-full snap-center pr-4"
                style={{ scrollSnapAlign: "start" }}
              >
                <div className="flex flex-col h-full">
                  {/* Column Header */}
                  <div className={cn("rounded-t-xl p-3", column.bgColor)}>
                    <div className="flex items-center gap-2">
                      <Icon className={cn("w-4 h-4", column.color)} />
                      <span className={cn("font-semibold text-sm", column.color)}>
                        {column.label}
                      </span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {columnOrders.length}
                      </Badge>
                    </div>
                    {columnOrders.length > 0 && column.status !== "finalizado" && (
                      <p className="text-[10px] text-muted-foreground mt-1 ml-6">
                        {formatCurrency(getColumnTotal(columnOrders))}
                      </p>
                    )}
                  </div>

                  {/* Column Content */}
                  <div className="flex-1 min-h-[350px] bg-muted/30 rounded-b-xl p-3 space-y-3 border border-t-0 border-border">
                    {columnOrders.length === 0 ? (
                      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                        Nenhum serviço
                      </div>
                    ) : (
                      columnOrders.map((ordem) => (
                        <motion.div
                          key={ordem.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <Card
                            className="p-4 active:scale-[0.98] transition-transform cursor-pointer bg-card touch-manipulation"
                            onClick={() => onEdit(ordem)}
                          >
                            {/* Client + Vehicle Icon */}
                            <div className="flex items-start gap-3 mb-3">
                              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                {ordem.veiculo?.tipo === "carro" ? (
                                  <Car className="w-5 h-5 text-primary" />
                                ) : (
                                  <Bike className="w-5 h-5 text-primary" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-semibold text-foreground truncate">
                                    {ordem.cliente?.nome}
                                  </p>
                                  {ordem.numero && (
                                    <span className="text-[9px] font-mono text-muted-foreground bg-muted px-1 py-0.5 rounded flex-shrink-0">
                                      #{ordem.numero}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground truncate">
                                  {ordem.veiculo?.placa && (
                                    <span className="font-mono font-semibold text-foreground/70 mr-1">
                                      {ordem.veiculo.placa}
                                    </span>
                                  )}
                                  {ordem.veiculo?.marca} {ordem.veiculo?.modelo}
                                </p>
                              </div>
                            </div>

                            {/* Service Type + Elapsed Time */}
                            <div className="flex flex-col gap-1.5 mb-2">
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-muted-foreground truncate flex-1">
                                  {ordem.tipo_servico}
                                </p>
                                {ordem.status !== "finalizado" && (() => {
                                  const elapsed = getElapsedTime(ordem.created_at);
                                  const staleUpdate = getTimeSinceUpdate(ordem.updated_at);
                                  return (
                                    <div className="flex items-center gap-1">
                                      {staleUpdate.isStale && (
                                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-destructive/30 text-destructive bg-destructive/10 animate-pulse">
                                          <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                                          Parada
                                        </Badge>
                                      )}
                                      <Badge variant="outline" className={cn(
                                        "text-[10px] h-5 px-1.5",
                                        elapsed.isStale 
                                          ? "border-warning/30 text-warning bg-warning/10" 
                                          : "border-muted-foreground/20 text-muted-foreground"
                                      )}>
                                        <Timer className="w-2.5 h-2.5 mr-0.5" />
                                        {elapsed.text}
                                      </Badge>
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Indicadores técnicos para Auto Elétrica */}
                              {isAutoEletrica && (
                                <div className="flex flex-wrap gap-1">
                                  {ordem.codigo_obd && (
                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-warning/30 text-warning bg-warning/5">
                                      <Zap className="w-2 h-2 mr-0.5" />
                                      {ordem.codigo_obd}
                                    </Badge>
                                  )}
                                  {ordem.checklist_voltagem_bateria && (
                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-info/30 text-info bg-info/5">
                                      {ordem.checklist_voltagem_bateria}V
                                    </Badge>
                                  )}
                                  {ordem.tempo_diagnostico_minutos && ordem.status === "em_diagnostico" && (
                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-primary/30 text-primary bg-primary/5">
                                      Diagn. {ordem.tempo_diagnostico_minutos}min
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Responsável */}
                            {ordem.responsavel_nome && (
                              <div className="flex items-center gap-1.5 mb-3">
                                <User className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground truncate">
                                  {ordem.responsavel_nome}
                                </span>
                              </div>
                            )}

                            {/* Sinal recebido */}
                            {Number((ordem as any).valor_sinal || 0) > 0 && (
                              <div className="mb-2 px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                                💰 Sinal: {formatCurrency(Number((ordem as any).valor_sinal))}
                              </div>
                            )}

                            {/* Footer */}
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                {formatDate(ordem.data_servico)}
                              </span>
                              <span className="text-lg font-bold text-accent">
                                {formatCurrency(getOSTotal(ordem))}
                              </span>
                            </div>

                            {/* Phone indicator */}
                            {ordem.cliente?.telefone && (
                              <div className="mt-3 pt-3 border-t border-border">
                                <a
                                  href={`tel:${ordem.cliente.telefone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-2 text-sm text-muted-foreground active:text-primary"
                                >
                                  <Phone className="w-4 h-4" />
                                  {ordem.cliente.telefone}
                                </a>
                              </div>
                            )}

                            {/* Warranty badge */}
                            {ordem.tem_garantia && (
                              <Badge className="mt-3 bg-success/10 text-success border-success/20 text-xs">
                                Garantia {ordem.dias_garantia}d
                              </Badge>
                            )}
                          </Card>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation Arrows */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={prevColumn}
            disabled={activeColumn === 0}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex gap-1.5">
            {kanbanColumns.map((_, index) => (
              <button
                key={index}
                onClick={() => goToColumn(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  activeColumn === index ? "bg-primary w-6" : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={nextColumn}
            disabled={activeColumn === kanbanColumns.length - 1}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  }

  // Desktop/Tablet View - Grid
  return (
    <div className="space-y-3">
      {/* Mechanic Filter - Desktop */}
      {responsaveis.length > 0 && onFiltroResponsavelChange && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs text-muted-foreground font-medium mr-1">Filtrar:</span>
          <button
            onClick={() => onFiltroResponsavelChange("")}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
              !filtroResponsavel ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            Todos
          </button>
          {responsaveis.map((r) => (
            <button
              key={r.id}
              onClick={() => onFiltroResponsavelChange(r.id === filtroResponsavel ? "" : r.id)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                filtroResponsavel === r.id ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              <User className="w-3 h-3" />
              {r.nome}
            </button>
          ))}
        </div>
      )}
      <div className={cn(
        "grid gap-3 md:gap-4",
        isAutoEletrica ? "grid-cols-2 lg:grid-cols-5" : "grid-cols-2 lg:grid-cols-4"
      )}>
      {kanbanColumns.map((column) => {
        const Icon = column.icon;
        const columnOrders = getOrdersByStatus(column.status);

        return (
          <div
            key={column.status}
            className="flex flex-col"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.status)}
          >
            {/* Column Header */}
            <div className={cn("rounded-t-lg p-2.5 md:p-3", column.bgColor)}>
              <div className="flex items-center gap-2">
                <Icon className={cn("w-4 h-4", column.color)} />
                <span className={cn("font-semibold text-xs md:text-sm", column.color)}>
                  <span className="hidden md:inline">{column.label}</span>
                  <span className="md:hidden">{column.shortLabel}</span>
                </span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {columnOrders.length}
                </Badge>
              </div>
              {columnOrders.length > 0 && column.status !== "finalizado" && (
                <p className="text-[10px] text-muted-foreground mt-1 ml-6">
                  {formatCurrency(getColumnTotal(columnOrders))}
                </p>
              )}
            </div>

            {/* Column Content */}
            <div className="flex-1 min-h-[250px] md:min-h-[300px] bg-muted/30 rounded-b-lg p-2 space-y-2 border border-t-0 border-border">
              {columnOrders.length === 0 ? (
                <div className="flex items-center justify-center h-20 md:h-24 text-muted-foreground text-xs md:text-sm text-center px-2">
                  Arraste cards aqui
                </div>
              ) : (
                columnOrders.map((ordem) => (
                  <motion.div
                    key={ordem.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    draggable
                    onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, ordem)}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <Card
                      className="p-2.5 md:p-3 hover:shadow-md transition-shadow cursor-pointer bg-card"
                      onClick={() => onEdit(ordem)}
                    >
                      {/* Client + Vehicle Icon */}
                      <div className="flex items-start gap-2 mb-2">
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {ordem.veiculo?.tipo === "carro" ? (
                            <Car className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
                          ) : (
                            <Bike className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs md:text-sm truncate">
                            {ordem.cliente?.nome}
                          </p>
                          <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                            {ordem.veiculo?.marca} {ordem.veiculo?.modelo}
                            {ordem.veiculo?.placa && (
                              <span className="ml-1 font-mono font-semibold text-foreground/70">
                                • {ordem.veiculo.placa}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Service Type + Elapsed Time */}
                      <div className="flex flex-col gap-1 mb-1">
                        <div className="flex items-center gap-1">
                          <p className="text-[10px] md:text-xs text-muted-foreground truncate flex-1">
                            {ordem.tipo_servico}
                          </p>
                          {ordem.status !== "finalizado" && (() => {
                            const elapsed = getElapsedTime(ordem.created_at);
                            const staleUpdate = getTimeSinceUpdate(ordem.updated_at);
                            return (
                              <>
                                {staleUpdate.isStale && (
                                  <AlertTriangle className="w-3 h-3 text-destructive animate-pulse flex-shrink-0" />
                                )}
                                <Badge variant="outline" className={cn(
                                  "text-[8px] md:text-[9px] h-4 px-1",
                                  elapsed.isStale 
                                    ? "border-warning/30 text-warning bg-warning/10" 
                                    : "border-muted-foreground/20 text-muted-foreground"
                                )}>
                                  <Timer className="w-2 h-2 mr-0.5" />
                                  {elapsed.text}
                                </Badge>
                              </>
                            );
                          })()}
                        </div>

                        {/* Indicadores técnicos compactos para Desktop */}
                        {isAutoEletrica && (
                          <div className="flex flex-wrap gap-0.5">
                            {ordem.codigo_obd && (
                              <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-warning/30 text-warning bg-warning/5">
                                <Zap className="w-2 h-2 mr-0.5" />
                                {ordem.codigo_obd}
                              </Badge>
                            )}
                            {ordem.checklist_voltagem_bateria && (
                              <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-info/30 text-info bg-info/5">
                                {ordem.checklist_voltagem_bateria}V
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Responsável */}
                      {ordem.responsavel_nome && (
                        <div className="flex items-center gap-1 mb-2">
                          <User className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[10px] md:text-xs text-muted-foreground truncate">
                            {ordem.responsavel_nome}
                          </span>
                        </div>
                      )}

                      {/* Sinal recebido */}
                      {Number((ordem as any).valor_sinal || 0) > 0 && (
                        <div className="mb-2 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                          💰 Sinal: {formatCurrency(Number((ordem as any).valor_sinal))}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] md:text-xs text-muted-foreground">
                          {formatDate(ordem.data_servico)}
                        </span>
                        <span className="text-xs md:text-sm font-bold text-accent">
                          {formatCurrency(getOSTotal(ordem))}
                        </span>
                      </div>

                      {/* Phone indicator */}
                      {ordem.cliente?.telefone && (
                        <div className="mt-2 pt-2 border-t border-border">
                          <a
                            href={`tel:${ordem.cliente.telefone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-[10px] md:text-xs text-muted-foreground hover:text-primary"
                          >
                            <Phone className="w-3 h-3" />
                            <span className="truncate">{ordem.cliente.telefone}</span>
                          </a>
                        </div>
                      )}

                      {/* Warranty badge */}
                      {ordem.tem_garantia && (
                        <Badge className="mt-2 bg-success/10 text-success border-success/20 text-[9px] md:text-[10px]">
                          Garantia {ordem.dias_garantia}d
                        </Badge>
                      )}
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
