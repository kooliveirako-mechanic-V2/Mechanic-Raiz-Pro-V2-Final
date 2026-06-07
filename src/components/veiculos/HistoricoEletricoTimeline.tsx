import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/formatters";
import { 
  Zap, Battery, Cpu, PlugZap, CircuitBoard, Calendar, Clock, 
  DollarSign, AlertTriangle, TrendingUp, TrendingDown,
  Lock, Crown, RefreshCcw, Brain, ChevronDown, ChevronUp, Shield
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useHistoricoEletrico } from "@/hooks/useHistoricoEletrico";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RiskBadgeEletrico, StatusModoGuerraBadge, RecorrenciaBadge } from "./RiskBadgeEletrico";

interface HistoricoEletricoTimelineProps {
  veiculoId: string;
  veiculoInfo?: {
    marca: string;
    modelo: string;
    placa?: string;
  };
  compact?: boolean;
}

const sistemaIcons = {
  bateria: Battery,
  alternador: Cpu,
  partida: PlugZap,
  modulos: CircuitBoard,
  geral: Zap,
};

const sistemaLabels = {
  bateria: "Sistema de Bateria",
  alternador: "Sistema de Carga",
  partida: "Sistema de Partida",
  modulos: "Módulos Eletrônicos",
  geral: "Sistema Elétrico",
};

const statusColors = {
  prejuizo: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/30", gradient: "from-destructive/20 to-destructive/5" },
  margem_baixa: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/30", gradient: "from-warning/20 to-warning/5" },
  saudavel: { bg: "bg-success/10", text: "text-success", border: "border-success/30", gradient: "from-success/20 to-success/5" },
  excelente: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/30", gradient: "from-primary/20 to-primary/5" },
};

export function HistoricoEletricoTimeline({ 
  veiculoId, 
  veiculoInfo,
  compact = false 
}: HistoricoEletricoTimelineProps) {
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const {
    eventosEletricos,
    recorrencias,
    resumoTecnico,
    isLoading,
    isInfinity,
    totalEventosBloqueados,
  } = useHistoricoEletrico(veiculoId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const hasRecorrencias = recorrencias.length > 0;
  const riskLevel = resumoTecnico.riscoPotencial === "alto" ? "alto" 
    : hasRecorrencias ? "medio" 
    : resumoTecnico.totalDiagnosticos > 0 ? "saudavel" 
    : "baixo";

  return (
    <div className="space-y-4">
      {/* Header com RiskBadge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/30">
            <Zap className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Histórico Elétrico do Veículo</h3>
            {veiculoInfo && (
              <p className="text-xs text-muted-foreground">
                {veiculoInfo.marca} {veiculoInfo.modelo} {veiculoInfo.placa && `• ${veiculoInfo.placa}`}
              </p>
            )}
          </div>
        </div>
        
        <RiskBadgeEletrico risco={riskLevel} variant="compact" />
      </div>

      {/* Resumo Técnico Automático - Tom consultivo, camadas */}
      <Card className={cn(
        "border-2 overflow-hidden",
        resumoTecnico.riscoPotencial === "alto" && "border-amber-500/50",
        resumoTecnico.riscoPotencial === "medio" && "border-warning/40",
        resumoTecnico.riscoPotencial === "baixo" && "border-border"
      )}>
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-50",
          resumoTecnico.riscoPotencial === "alto" && "from-amber-500/10 to-transparent",
          resumoTecnico.riscoPotencial === "medio" && "from-warning/10 to-transparent"
        )} />
        <CardHeader className="pb-2 relative">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10">
                <Brain className="w-4 h-4 text-amber-500" />
              </div>
              Resumo Automático
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">
              Baseado no histórico do veículo
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 relative">
          {/* Status visual - primeira dobra */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
            <RiskBadgeEletrico risco={riskLevel} variant="badge" />
            <p className="text-sm text-muted-foreground flex-1">
              Este histórico ajuda a evitar retrabalho e proteger sua margem.
            </p>
          </div>

          {/* Texto do resumo com narrativa consultiva */}
          <div className={cn(
            "p-3 rounded-lg border",
            resumoTecnico.riscoPotencial === "alto" && "bg-amber-500/5 border-amber-500/20",
            resumoTecnico.riscoPotencial === "medio" && "bg-warning/5 border-warning/20",
            resumoTecnico.riscoPotencial === "baixo" && "bg-muted/50 border-border"
          )}>
            <p className="text-sm leading-relaxed font-medium">{resumoTecnico.textoResumo}</p>
            
            {/* Frases consultivas - sem acusação */}
            {resumoTecnico.riscoPotencial === "alto" && (
              <p className="text-xs text-amber-600 mt-2 font-medium">
                💡 Identificar a causa raiz pode evitar retorno do cliente.
              </p>
            )}
            {resumoTecnico.riscoPotencial === "medio" && (
              <p className="text-xs text-warning mt-2 font-medium">
                🔍 Consultar histórico antes do diagnóstico pode economizar tempo.
              </p>
            )}
          </div>
          
          {/* Stats rápidos */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-background rounded-lg p-2.5 text-center border shadow-sm">
              <p className="text-xl font-bold">{resumoTecnico.totalDiagnosticos}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Diagnósticos</p>
            </div>
            <div className="bg-background rounded-lg p-2.5 text-center border shadow-sm">
              <p className="text-xl font-bold">
                {resumoTecnico.mediaTempoTecnico > 0 ? `${Math.round(resumoTecnico.mediaTempoTecnico)}min` : "-"}
              </p>
              <p className="text-[10px] text-muted-foreground font-medium">Tempo Médio</p>
            </div>
            <div className="bg-background rounded-lg p-2.5 text-center border shadow-sm">
              <p className="text-xl font-bold text-success">
                {formatCurrency(resumoTecnico.valorMedioOS)}
              </p>
              <p className="text-[10px] text-muted-foreground font-medium">Valor Médio</p>
            </div>
          </div>

          {/* Bloqueio Oficina Completa - Calmo e seguro */}
          {!isInfinity && resumoTecnico.totalDiagnosticos > 2 && (
            <div className="p-4 rounded-lg bg-muted border border-border relative overflow-hidden">
              <div className="flex items-center gap-2 mb-2 relative">
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                  <Lock className="w-4 h-4 text-amber-500" />
                </div>
                <span className="text-sm font-semibold text-foreground">Análise avançada disponível</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3 relative">
                O plano Oficina Completa identifica padrões recorrentes e evita retrabalho antes que vire prejuízo.
              </p>
              <Button 
                size="sm" 
                variant="outline"
                className="w-full border-amber-500/30 text-amber-600 hover:bg-amber-500/5 font-medium relative"
                onClick={() => navigate("/upgrade")}
              >
                <Crown className="w-4 h-4 mr-2" />
                Ver histórico completo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recorrências Detectadas - Linguagem orientativa */}
      {hasRecorrencias && (
        <Card className="border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/5 to-transparent overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/15">
                <RefreshCcw className="w-4 h-4 text-amber-600" />
              </div>
              <span className="font-bold">Padrão Recorrente Identificado</span>
              <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/5 font-medium">
                {recorrencias.length}
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Este dado ajuda a tomar decisões mais assertivas
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recorrencias.map((rec, i) => (
                <div 
                  key={`${rec.tipo}-${rec.identificador}-${i}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-background border border-amber-500/20 hover:border-amber-500/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">
                        {rec.tipo === "codigo_obd" && `Código ${rec.identificador}`}
                        {rec.tipo === "modulo" && `Módulo ${rec.identificador}`}
                        {rec.tipo === "sistema" && `Sistema de ${rec.identificador}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-amber-600">{rec.ocorrencias}x</span> em {rec.diasEntreOcorrencias} dias
                        {rec.diasEntreOcorrencias < 30 && (
                          <span className="ml-2 text-amber-600 font-medium">• Recente</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">
                      {formatCurrency(rec.totalGasto)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">investido</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Feedback consultivo */}
            <p className="text-xs text-muted-foreground mt-3 p-2 bg-muted/30 rounded-lg">
              💡 Identificar a causa raiz pode evitar retorno do cliente e proteger sua margem.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Timeline de Eventos */}
      <div className="space-y-2">
        <h4 className="text-sm font-bold text-muted-foreground flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Timeline de Diagnósticos
        </h4>
        
        <div className={compact ? "max-h-[300px] overflow-y-auto" : "max-h-[500px] overflow-y-auto"} style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
          {eventosEletricos.length === 0 ? (
            <div className="text-center py-8 bg-muted/30 rounded-lg border-2 border-dashed">
              <Zap className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground font-medium">
                Nenhum diagnóstico elétrico registrado
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Os diagnósticos aparecerão aqui após criar OSs
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {eventosEletricos.map((evento) => {
                const SistemaIcon = sistemaIcons[evento.tipoSistema];
                const statusStyle = statusColors[evento.statusModoGuerra];
                const isExpanded = expandedId === evento.id;
                
                return (
                  <div
                    key={evento.id}
                    className={cn(
                      "rounded-xl border-2 overflow-hidden transition-all shadow-sm hover:shadow-md",
                      statusStyle.border
                    )}
                  >
                    {/* Header do evento - Card grande para mobile */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : evento.id)}
                      className={cn(
                        "w-full p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors text-left",
                        `bg-gradient-to-r ${statusStyle.gradient}`
                      )}
                    >
                      <div className={cn("flex-shrink-0 p-3 rounded-xl", statusStyle.bg, "border", statusStyle.border)}>
                        <SistemaIcon className={cn("w-5 h-5", statusStyle.text)} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-sm truncate">
                            {evento.tipo_servico}
                          </span>
                          <StatusModoGuerraBadge status={evento.statusModoGuerra} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(evento.data_servico), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          {evento.tempo_diagnostico_minutos && evento.tempo_diagnostico_minutos > 0 && (
                            <span className="flex items-center gap-1 font-medium">
                              <Clock className="w-3 h-3" />
                              {evento.tempo_diagnostico_minutos}min
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {evento.valor_servico && (
                          <span className={cn("font-bold text-base", statusStyle.text)}>
                            {formatCurrency(evento.valor_servico)}
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* Detalhes expandidos */}
                    {isExpanded && (
                      <div className="border-t-2 p-4 space-y-4 bg-background">
                        {/* Descrição */}
                        {evento.descricao && (
                          <div>
                            <p className="text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wide">Descrição</p>
                            <p className="text-sm">{evento.descricao}</p>
                          </div>
                        )}

                        {/* Hipótese/Conclusão Técnica */}
                        {evento.hipotese_diagnostico && (
                          <div className="p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/30">
                            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1 uppercase tracking-wide">
                              <Brain className="w-3 h-3" />
                              Conclusão Técnica
                            </p>
                            <p className="text-sm font-medium">{evento.hipotese_diagnostico}</p>
                          </div>
                        )}

                        {/* Códigos OBD */}
                        {(evento.codigos_obd_lista?.length || evento.codigo_obd) && (
                          <div>
                            <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">Códigos OBD Detectados</p>
                            <div className="flex flex-wrap gap-2">
                              {(evento.codigos_obd_lista || [evento.codigo_obd]).filter(Boolean).map((codigo) => (
                                <Badge key={codigo} variant="outline" className="font-mono text-amber-600 bg-amber-500/10 border-amber-500/30 text-sm px-3 py-1">
                                  {codigo}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Módulos Testados */}
                        {evento.modulos_testados && evento.modulos_testados.length > 0 && (
                          <div>
                            <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">Módulos Testados</p>
                            <div className="flex flex-wrap gap-2">
                              {evento.modulos_testados.map((modulo) => (
                                <Badge key={modulo} variant="secondary" className="text-xs">
                                  <CircuitBoard className="w-3 h-3 mr-1" />
                                  {modulo}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Voltagem da Bateria */}
                        {evento.checklist_voltagem_bateria && (
                          <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                            <Battery className="w-5 h-5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Voltagem Bateria:</span>
                            <span className="font-bold text-sm">{evento.checklist_voltagem_bateria}</span>
                          </div>
                        )}

                        {/* Valor vs Ideal - Impacto Financeiro */}
                        {evento.valorIdeal && evento.valor_servico && (
                          <div className={cn(
                            "flex items-center justify-between p-3 rounded-lg border-2",
                            evento.valor_servico < evento.valorIdeal 
                              ? "bg-destructive/5 border-destructive/30" 
                              : "bg-success/5 border-success/30"
                          )}>
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-5 h-5 text-muted-foreground" />
                              <div>
                                <span className="text-xs text-muted-foreground block">Cobrado</span>
                                <span className="font-bold">{formatCurrency(evento.valor_servico)}</span>
                              </div>
                            </div>
                            <div className="text-center">
                              {evento.valor_servico < evento.valorIdeal ? (
                                <TrendingDown className="w-6 h-6 text-destructive mx-auto" />
                              ) : (
                                <TrendingUp className="w-6 h-6 text-success mx-auto" />
                              )}
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-muted-foreground block">Valor Ideal</span>
                              <span className={cn(
                                "font-bold",
                                evento.valor_servico < evento.valorIdeal ? "text-destructive" : "text-success"
                              )}>
                                {formatCurrency(evento.valorIdeal)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Bloqueio Oficina Completa para eventos */}
              {!isInfinity && totalEventosBloqueados > 0 && (
                <div className="p-6 rounded-xl bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-500/40 text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmYTUwMCIgc3Ryb2tlLW9wYWNpdHk9IjAuMDgiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-50" />
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center mx-auto mb-3 border border-amber-500/40">
                      <Lock className="w-7 h-7 text-amber-500" />
                    </div>
                    <p className="text-base font-bold mb-1 text-amber-700 dark:text-amber-400">
                      +{totalEventosBloqueados} diagnósticos bloqueados
                    </p>
                    <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
                      O plano Oficina Completa acessa histórico completo e identifica padrões de falha antes que causem retrabalho.
                    </p>
                    <Button 
                      className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold shadow-lg px-6"
                      onClick={() => navigate("/upgrade")}
                    >
                      <Crown className="w-4 h-4 mr-2" />
                      Desbloquear Histórico Completo
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
