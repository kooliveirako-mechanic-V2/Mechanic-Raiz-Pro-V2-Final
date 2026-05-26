import { formatCurrency } from "@/lib/formatters";
import { 
  Brain, AlertTriangle, TrendingDown, Clock, DollarSign, 
  RefreshCcw, Shield, Crown, Lock 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useHistoricoEletrico } from "@/hooks/useHistoricoEletrico";
import { useNavigate } from "react-router-dom";
import { RiskBadgeEletrico } from "./RiskBadgeEletrico";

interface ResumoTecnicoCardProps {
  veiculoId: string;
  compact?: boolean;
  showUpgrade?: boolean;
}

export function ResumoTecnicoCard({ 
  veiculoId, 
  compact = false,
  showUpgrade = true 
}: ResumoTecnicoCardProps) {
  const navigate = useNavigate();
  const { resumoTecnico, recorrencias, isInfinity, isLoading } = useHistoricoEletrico(veiculoId);

  if (isLoading || resumoTecnico.totalDiagnosticos === 0) {
    return null;
  }

  const hasRecorrencias = recorrencias.length > 0;
  const riskLevel = resumoTecnico.riscoPotencial === "alto" ? "alto" 
    : hasRecorrencias ? "medio" 
    : "saudavel";

  if (compact) {
    return (
      <div className={cn(
        "p-3 rounded-xl border-2 flex items-center justify-between",
        riskLevel === "alto" && "bg-destructive/5 border-destructive/30",
        riskLevel === "medio" && "bg-warning/5 border-warning/30",
        riskLevel === "saudavel" && "bg-success/5 border-success/30"
      )}>
        <div className="flex items-center gap-3">
          {riskLevel === "alto" ? (
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="w-5 h-5 text-destructive animate-pulse" />
            </div>
          ) : riskLevel === "medio" ? (
            <div className="p-2 rounded-lg bg-warning/10">
              <RefreshCcw className="w-5 h-5 text-warning" />
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-success/10">
              <Shield className="w-5 h-5 text-success" />
            </div>
          )}
          <div>
            <p className="font-bold text-sm">
              {resumoTecnico.totalDiagnosticos} diagnóstico(s)
            </p>
            <p className="text-xs text-muted-foreground">
              {hasRecorrencias 
                ? `${recorrencias.length} recorrência(s) detectada(s)`
                : "Sem recorrências"}
            </p>
          </div>
        </div>
        
        <RiskBadgeEletrico risco={riskLevel} variant="compact" />
      </div>
    );
  }

  return (
    <div className={cn(
      "p-5 rounded-2xl border space-y-4",
      riskLevel === "alto" && "bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/40",
      riskLevel === "medio" && "bg-gradient-to-br from-warning/10 to-warning/5 border-warning/40",
      riskLevel === "saudavel" && "bg-gradient-to-br from-success/10 to-success/5 border-success/40"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Brain className="w-5 h-5 text-amber-500" />
          </div>
          <h4 className="font-bold">Resumo Técnico</h4>
        </div>
        <RiskBadgeEletrico risco={riskLevel} variant="badge" />
      </div>

      {/* Texto do resumo com narrativa consultiva */}
      <div className={cn(
        "p-3 rounded-lg border",
        riskLevel === "alto" && "bg-amber-500/5 border-amber-500/20",
        riskLevel === "medio" && "bg-warning/5 border-warning/20",
        riskLevel === "saudavel" && "bg-background border-border"
      )}>
        <p className="text-sm leading-relaxed font-medium">{resumoTecnico.textoResumo}</p>
        {riskLevel === "alto" && (
          <p className="text-xs text-amber-600 mt-2 font-medium">
            💡 Identificar a causa raiz pode evitar retorno do cliente.
          </p>
        )}
        {riskLevel === "medio" && (
          <p className="text-xs text-warning mt-2 font-medium">
            🔍 Consultar histórico antes do diagnóstico pode economizar tempo.
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-background rounded-xl p-3 text-center border shadow-sm">
          <p className="text-2xl font-bold">{resumoTecnico.totalDiagnosticos}</p>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Diagnósticos</p>
        </div>
        <div className="bg-background rounded-xl p-3 text-center border shadow-sm">
          <p className="text-2xl font-bold">
            {resumoTecnico.mediaTempoTecnico > 0 ? `${Math.round(resumoTecnico.mediaTempoTecnico)}min` : "-"}
          </p>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Tempo Médio</p>
        </div>
        <div className="bg-background rounded-xl p-3 text-center border shadow-sm">
          <p className="text-2xl font-bold text-success">
            {formatCurrency(resumoTecnico.valorMedioOS)}
          </p>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Valor Médio</p>
        </div>
      </div>

      {/* Recorrências - Linguagem orientativa */}
      {hasRecorrencias && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-2 uppercase tracking-wide">
            <RefreshCcw className="w-4 h-4 text-amber-600" />
            Padrões Identificados
          </p>
          {recorrencias.slice(0, 2).map((rec, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-background border border-amber-500/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-sm">
                  {rec.tipo === "codigo_obd" && `Código ${rec.identificador}`}
                  {rec.tipo === "modulo" && `Módulo ${rec.identificador}`}
                  {rec.tipo === "sistema" && `Sistema ${rec.identificador}`}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                <span className="font-semibold text-amber-600">{rec.ocorrencias}x</span> • {formatCurrency(rec.totalGasto)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Funcionalidade Oficina Completa - Tom calmo, sem pressão */}
      {!isInfinity && showUpgrade && (
        <div className="p-4 rounded-xl bg-muted border border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Crown className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">
              Análise completa disponível
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            O plano Oficina Completa acompanha padrões recorrentes e protege a margem.
          </p>
          <Button 
            size="sm" 
            variant="outline"
            className="w-full border-primary/30 text-primary hover:bg-primary/5 font-medium"
            onClick={() => navigate("/upgrade")}
          >
            <Crown className="w-4 h-4 mr-2" />
            Desbloquear histórico completo
          </Button>
        </div>
      )}

      {/* Feedback emocional final */}
      <div className="pt-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground italic text-center">
          💡 Esse histórico ajuda sua oficina a evitar retrabalho e proteger a margem.
        </p>
      </div>
    </div>
  );
}
