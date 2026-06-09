import { motion, AnimatePresence } from "framer-motion";
import { 
  Flame, 
  Shield, 
  TrendingUp, 
  Lock,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ShieldCheck
} from "lucide-react";
import { FEATURE_FLAGS_V2 } from "@/config/featureFlagsV2";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ModoGuerraAlertCard } from "./ModoGuerraAlertCard";
import { useModoGuerraAlerts } from "@/hooks/useModoGuerraAlerts";
import { useModoGuerraV2 } from "@/hooks/useModoGuerraV2";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/formatters";

// FEATURE FLAG: FINANCEIRO_V2_MODO_GUERRA_ENABLED
export const FINANCEIRO_V2_MODO_GUERRA_ENABLED = FEATURE_FLAGS_V2.MODO_GUERRA_V2_ENABLED;

export function ModoGuerraAlertsPanel() {
  const navigate = useNavigate();
  const { 
    alertas, 
    stats, 
    isLoading: isLoadingAlerts, 
    isInfinity,
    resolverAlerta,
    ignorarAlerta,
    refetch 
  } = useModoGuerraAlerts();

  const { data: metricsV2, isLoading: isLoadingV2, auditoriaLimpa } = useModoGuerraV2();
  
  const isV2 = FINANCEIRO_V2_MODO_GUERRA_ENABLED;
  const isLoading = isLoadingAlerts || (isV2 && isLoadingV2);

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32 mt-2" />
        </div>
        <div className="p-6 space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  // Separar alertas visíveis
  const alertasVisiveis = isInfinity ? alertas : alertas.slice(0, 2);
  const alertasBloqueados = isInfinity ? 0 : Math.max(0, alertas.length - 2);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {isV2 && (
        <Badge variant="outline" className="w-full rounded-none border-0 border-b border-primary/20 bg-primary/5 text-primary py-2 px-6">
          <Info className="w-4 h-4 mr-2" /> Painel Modo Guerra V2 Ativo (Leitura)
        </Badge>
      )}
      
      {/* Header - Tom consultivo */}
      <div className="p-6 border-b border-border bg-gradient-to-r from-amber-500/5 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Flame className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                Oportunidades identificadas
                {stats.alertasAtivos > 0 && (
                  <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600">
                    {stats.alertasAtivos}
                  </Badge>
                )}
              </h2>
              <p className="text-sm text-muted-foreground">
                Pontos de atenção baseados nos seus dados
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => refetch()}
              title="Recarregar análises"
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Stats resumo - Feedback positivo */}
        {isInfinity && stats.prejuizoEvitado > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 rounded-lg bg-success/10 border border-success/20"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-success" />
              <span className="text-sm text-success font-medium">
                Você identificou {formatCurrency(stats.prejuizoEvitado)} em oportunidades este mês
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 ml-7">
              💡 Esse acompanhamento ajuda sua oficina a proteger a margem.
            </p>
          </motion.div>
        )}
      </div>

      {/* Oportunidades identificadas */}
      <div className="p-6">
        {isV2 && metricsV2 && (
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Faturamento Comp.</p>
                <p className="text-sm font-bold">{formatCurrency(metricsV2.competencia.faturamento_liquido)}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Saldo Rec. Comp.</p>
                <p className="text-sm font-bold text-accent">{formatCurrency(metricsV2.competencia.saldo_a_receber_competencia)}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Entradas Caixa</p>
                <p className="text-sm font-bold text-success">{formatCurrency(metricsV2.caixa.entradas_pagas_no_periodo)}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">CMV Total</p>
                <p className="text-sm font-bold text-destructive">{formatCurrency(metricsV2.custos.cmv_total)}</p>
              </div>
            </div>

            <div className="space-y-2">
              {metricsV2.auditoria.avisos.map((aviso, i) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/10 text-xs text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{aviso}</span>
                </div>
              ))}
              {metricsV2.auditoria.registros_os.some(os => os.is_teste) && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-xs text-amber-600">
                  <Info className="w-4 h-4" />
                  <span>Existem registros de teste ativos afetando os indicadores. Limpeza pendente.</span>
                </div>
              )}
              {auditoriaLimpa?.isModoLimpo && (
                <div className="bg-info/10 border border-info/30 rounded-xl p-3 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-info shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[10px] text-info uppercase font-bold tracking-wide">Modo V2 Limpo Ativo</p>
                    <p className="text-[11px] text-info/90 leading-tight">
                      Registros de teste ignorados por manifesto ({auditoriaLimpa.registrosIgnorados?.length || 0} itens). 
                      Cálculos gerenciais ajustados sem alteração física no banco.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {alertas.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-success" />
            </div>
            <p className="font-medium text-foreground">Tudo certo por aqui</p>
            <p className="text-sm text-muted-foreground mt-1">
              Nenhuma oportunidade pendente. Continue assim!
            </p>
            <p className="text-xs text-muted-foreground mt-2 italic">
              💡 O sistema monitora continuamente para identificar melhorias.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {alertasVisiveis.map((alert) => (
                <ModoGuerraAlertCard
                  key={alert.id}
                  alert={alert}
                  onResolver={resolverAlerta}
                  onIgnorar={ignorarAlerta}
                />
              ))}
            </AnimatePresence>

            {/* Funcionalidades Oficina Completa - Tom calmo */}
            {!isInfinity && alertasBloqueados > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative p-4 rounded-xl border border-border bg-muted"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        +{alertasBloqueados} análise{alertasBloqueados > 1 ? 's' : ''} disponíve{alertasBloqueados > 1 ? 'is' : 'l'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Oficinas no plano Completa acompanham todas as oportunidades
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate("/upgrade")}
                    className="text-xs border-primary/30 text-primary hover:bg-primary/5"
                  >
                    Ver mais
                    <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Ranking de causas (Oficina Completa only) - Tom orientativo */}
        {isInfinity && stats.causasPrejuizo.length > 0 && (
          <div className="mt-6 pt-6 border-t border-border">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Padrões mais frequentes
            </h4>
            <div className="space-y-2">
              {stats.causasPrejuizo.slice(0, 3).map((causa, index) => (
                <div 
                  key={causa.causa}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-5">
                      #{index + 1}
                    </span>
                    <span className="text-sm">{causa.causa}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {causa.quantidade}x
                    </Badge>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {formatCurrency(causa.impacto)}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3 italic">
              💡 Identificar padrões ajuda a evitar recorrências e proteger sua margem.
            </p>
          </div>
        )}

        {/* Histórico resumido */}
        {(stats.alertasResolvidos > 0 || stats.alertasIgnorados > 0) && (
          <div className="mt-4 pt-4 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
            {stats.alertasResolvidos > 0 && (
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-success" />
                {stats.alertasResolvidos} resolvido{stats.alertasResolvidos > 1 ? 's' : ''}
              </div>
            )}
            {stats.alertasIgnorados > 0 && (
              <div className="flex items-center gap-1">
                <XCircle className="w-3 h-3 text-muted-foreground" />
                {stats.alertasIgnorados} ignorado{stats.alertasIgnorados > 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Versão compacta para mobile
export function ModoGuerraAlertsMobile() {
  const navigate = useNavigate();
  const { alertas, stats, isLoading, isInfinity, resolverAlerta } = useModoGuerraAlerts();

  if (isLoading || alertas.length === 0) return null;

  const topAlertas = alertas.slice(0, 3);

  return (
    <div className="space-y-3">
      {/* Header compacto - Tom orientativo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-amber-600" />
          <h3 className="font-semibold text-sm">Oportunidades</h3>
          {stats.alertasAtivos > 0 && (
            <Badge variant="outline" className="text-[10px] h-5 border-amber-500/30 text-amber-600">
              {stats.alertasAtivos}
            </Badge>
          )}
        </div>
        {isInfinity && stats.prejuizoEvitado > 0 && (
          <Badge variant="outline" className="text-[10px] text-success border-success/30">
            <Shield className="w-3 h-3 mr-1" />
            {formatCurrency(stats.prejuizoEvitado)} identificado
          </Badge>
        )}
      </div>

      {/* Alertas compactos */}
      <div className="space-y-2">
        <AnimatePresence>
          {topAlertas.map((alert) => (
            <ModoGuerraAlertCard
              key={alert.id}
              alert={alert}
              onResolver={resolverAlerta}
              compact
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Ver mais - Tom calmo */}
      {!isInfinity && alertas.length > 3 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/upgrade")}
          className="w-full text-xs text-muted-foreground"
        >
          <TrendingUp className="w-3 h-3 mr-1" />
          +{alertas.length - 3} análises disponíveis no Oficina Completa
        </Button>
      )}
    </div>
  );
}
