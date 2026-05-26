import { formatCurrency } from "@/lib/formatters";
import { Zap, Clock, AlertTriangle, Crown, Lock, ChevronRight, Brain, RefreshCcw, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useHistoricoEletrico } from "@/hooks/useHistoricoEletrico";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { RiskBadgeEletrico, StatusModoGuerraBadge } from "./RiskBadgeEletrico";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface HistoricoEletricoMobileProps {
  veiculoId: string;
  veiculoInfo?: {
    marca: string;
    modelo: string;
    placa?: string;
  };
  onViewFull?: () => void;
}

export function HistoricoEletricoMobile({ 
  veiculoId, 
  veiculoInfo,
  onViewFull 
}: HistoricoEletricoMobileProps) {
  const navigate = useNavigate();
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
      <div className="animate-pulse space-y-3">
        <div className="h-14 bg-muted rounded-xl" />
        <div className="h-24 bg-muted rounded-xl" />
      </div>
    );
  }

  if (resumoTecnico.totalDiagnosticos === 0) {
    return (
      <Card className="border-2 border-dashed bg-muted/30">
        <CardContent className="py-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
            <Zap className="w-6 h-6 text-muted-foreground/50" />
          </div>
          <p className="font-medium text-muted-foreground">Sem histórico elétrico</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Os diagnósticos aparecerão aqui
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasRecorrencias = recorrencias.length > 0;
  const riskLevel = resumoTecnico.riscoPotencial === "alto" ? "alto" 
    : hasRecorrencias ? "medio" 
    : "saudavel";

  return (
    <div className="space-y-3">
      {/* Header compacto com RiskBadge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/30">
            <Zap className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h4 className="font-bold">Histórico Elétrico</h4>
            <p className="text-xs text-muted-foreground">
              {resumoTecnico.totalDiagnosticos} diagnóstico(s)
            </p>
          </div>
        </div>
        
        <RiskBadgeEletrico risco={riskLevel} variant="compact" />
      </div>

      {/* Card de Resumo Técnico - Mobile: 1 insight por tela */}
      <Card className={cn(
        "border overflow-hidden",
        riskLevel === "alto" && "border-amber-500/40 bg-amber-500/5",
        riskLevel === "medio" && "border-warning/40 bg-warning/5",
        riskLevel === "saudavel" && "border-success/40 bg-success/5"
      )}>
        <CardContent className="py-4 space-y-3">
          {/* Status visual - Primeira dobra (o que aparece de cara) */}
          <div className="flex items-center justify-between">
            <RiskBadgeEletrico risco={riskLevel} variant="badge" />
            <span className="text-[10px] text-muted-foreground">
              Baseado no histórico
            </span>
          </div>
          
          {/* Frase orientativa curta */}
          <p className="text-sm font-medium text-muted-foreground">
            Este histórico ajuda a evitar retrabalho e proteger sua margem.
          </p>
          
          {/* Stats inline - cards grandes para toque */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-background rounded-lg p-2.5 text-center border shadow-sm">
              <p className="text-lg font-bold">{resumoTecnico.totalDiagnosticos}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Diags</p>
            </div>
            <div className="bg-background rounded-lg p-2.5 text-center border shadow-sm">
              <p className="text-lg font-bold">
                {resumoTecnico.mediaTempoTecnico > 0 ? `${Math.round(resumoTecnico.mediaTempoTecnico)}m` : "-"}
              </p>
              <p className="text-[10px] text-muted-foreground font-medium">Tempo</p>
            </div>
            <div className="bg-background rounded-lg p-2.5 text-center border shadow-sm">
              <p className="text-lg font-bold text-success">
                {formatCurrency(resumoTecnico.valorMedioOS)}
              </p>
              <p className="text-[10px] text-muted-foreground font-medium">Médio</p>
            </div>
          </div>
          
          {/* CTA para ver detalhes técnicos - Segunda camada */}
          {resumoTecnico.totalDiagnosticos > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-muted-foreground text-xs"
              onClick={onViewFull}
            >
              Ver detalhes técnicos
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Recorrências - Tom orientativo */}
      {hasRecorrencias && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <RefreshCcw className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-semibold text-amber-600">
              Padrão identificado neste veículo
            </span>
          </div>
          {recorrencias.slice(0, 2).map((rec, i) => (
            <div 
              key={i}
              className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/30"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <span className="text-sm font-bold block">
                    {rec.tipo === "codigo_obd" && rec.identificador}
                    {rec.tipo === "modulo" && rec.identificador}
                    {rec.tipo === "sistema" && `Sistema ${rec.identificador}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {rec.diasEntreOcorrencias < 30 && (
                      <span className="text-amber-600 font-medium">Recente • </span>
                    )}
                    {rec.diasEntreOcorrencias} dias
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-foreground block">
                  {formatCurrency(rec.totalGasto)}
                </span>
                <span className="text-[10px] text-muted-foreground">{rec.ocorrencias}x</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Últimos eventos - Cards expandidos para mobile */}
      {eventosEletricos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground px-1 uppercase tracking-wide">
            Últimos Diagnósticos
          </p>
          {eventosEletricos.slice(0, 2).map((evento) => (
            <Card key={evento.id} className={cn(
              "border-2",
              evento.statusModoGuerra === "prejuizo" && "border-destructive/30",
              evento.statusModoGuerra === "margem_baixa" && "border-warning/30",
              evento.statusModoGuerra === "saudavel" && "border-success/30",
              evento.statusModoGuerra === "excelente" && "border-primary/30"
            )}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm truncate flex-1">{evento.tipo_servico}</span>
                  <StatusModoGuerraBadge status={evento.statusModoGuerra} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{format(new Date(evento.data_servico), "dd/MM/yyyy", { locale: ptBR })}</span>
                  <span className="font-bold text-foreground">
                    {formatCurrency(evento.valor_servico || 0)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* CTA para ver completo */}
      {onViewFull && eventosEletricos.length > 0 && (
        <Button 
          variant="outline" 
          size="lg" 
          className="w-full h-12 font-semibold"
          onClick={onViewFull}
        >
          Ver histórico completo
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      )}

      {/* Bloqueio Oficina Completa - Calmo, sem pressão */}
      {!isInfinity && totalEventosBloqueados > 0 && (
        <div className="p-4 rounded-xl bg-muted border border-border text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="font-semibold text-foreground">
              +{totalEventosBloqueados} diagnósticos disponíveis
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            O plano Oficina Completa identifica padrões recorrentes e evita retrabalho.
          </p>
          <Button 
            size="lg"
            variant="outline"
            className="w-full border-amber-500/30 text-amber-600 hover:bg-amber-500/5 font-semibold h-12"
            onClick={() => navigate("/upgrade")}
          >
            <Crown className="w-5 h-5 mr-2" />
            Ver histórico completo
          </Button>
        </div>
      )}
    </div>
  );
}
