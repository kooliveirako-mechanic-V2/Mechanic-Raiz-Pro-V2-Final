import { motion, AnimatePresence } from "framer-motion";
import { 
  Crown, 
  Lock, 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  EyeOff,
  Shield,
  Target,
  AlertTriangle,
  Zap,
  ArrowRight,
  Sparkles,
  BarChart3,
  DollarSign,
  Users,
  Wrench
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useProfitIndicators } from "@/hooks/useProfitIndicators";
import { usePlan } from "@/hooks/usePlan";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { useOficina } from "@/contexts/OficinaContext";
import { formatCurrency } from "@/lib/formatters";

// ============================================
// PAINEL OFICINA COMPLETA EXCLUSIVO
// Motor de upgrade através de valor real bloqueado
// ============================================

interface IntelligenceMetric {
  label: string;
  value: number | string;
  subtext?: string;
  icon: React.ReactNode;
  color: "destructive" | "warning" | "success" | "info";
  locked?: boolean;
}

export function InfinityIntelligencePanel() {
  const navigate = useNavigate();
  const { indicators, isLoading } = useProfitIndicators();
  const { isOficinaPro, isTrialActive, hasActivePlan } = usePlan();
  const { canViewLucro } = useUserRole();
  const { oficinaAtual } = useOficina();

  // Oficina Completa = oficina_pro (plano completo)
  const isOficinaCompleta = isOficinaPro && hasActivePlan && !isTrialActive;
  const hasFullAccess = isOficinaCompleta && canViewLucro;
  
  // Se não tem permissão de ver lucro, não mostrar
  if (!canViewLucro) return null;

  // Calcular métricas de inteligência
  const perdasEvitadas = indicators.alertasCriticos.reduce((sum, a) => sum + a.impacto, 0);
  const osComProblema = indicators.osComPrejuizo + indicators.osComMargemBaixa;
  const clientesRisco = indicators.clientesRentabilidade.filter(
    c => c.classificacao === "prejuizo" || c.classificacao === "margem_baixa"
  ).length;
  const servicosProblematicos = indicators.servicosProblematicos.length;
  
  // Valor oculto para planos inferiores (simulação de ROI)
  // Valor oculto com cálculo mais realista
  const valorOcultoEstimado = perdasEvitadas > 0 
    ? perdasEvitadas * 2.5 // Estimativa: 2.5x o valor identificado poderia ser recuperado
    : indicators.totalOSAnalisadas * 50; // R$50 por OS em média de melhoria

  // Métricas que serão exibidas
  const metrics: IntelligenceMetric[] = [
    {
      label: "Perdas Identificadas",
      value: formatCurrency(perdasEvitadas),
      subtext: `${indicators.osComPrejuizo} OS com prejuízo`,
      icon: <TrendingDown className="w-5 h-5" />,
      color: "destructive",
      locked: !hasFullAccess,
    },
    {
      label: "Clientes em Risco",
      value: clientesRisco,
      subtext: "Margem baixa ou prejuízo",
      icon: <Users className="w-5 h-5" />,
      color: "warning",
      locked: !hasFullAccess,
    },
    {
      label: "Serviços Críticos",
      value: servicosProblematicos,
      subtext: "Precisam de revisão",
      icon: <Wrench className="w-5 h-5" />,
      color: "warning",
      locked: !hasFullAccess,
    },
    {
      label: "Margem Média",
      value: `${indicators.margemMediaGeral.toFixed(1)}%`,
      subtext: indicators.margemMediaGeral >= 30 ? "Saudável" : "Abaixo do ideal",
      icon: <BarChart3 className="w-5 h-5" />,
      color: indicators.margemMediaGeral >= 30 ? "success" : "warning",
      locked: !hasFullAccess,
    },
  ];

  // Comparativo de planos
  const planComparison = [
    { feature: "Alertas de prejuízo", motoPro: true, completa: true },
    { feature: "Identificar perdas invisíveis", motoPro: false, completa: true },
    { feature: "Ranking de rentabilidade por cliente", motoPro: false, completa: true },
    { feature: "Análise por tipo de serviço", motoPro: false, completa: true },
    { feature: "Alertas de diagnóstico subvalorizado", motoPro: false, completa: true },
    { feature: "DRE simplificado", motoPro: false, completa: true },
  ];

  const colorMap = {
    destructive: "text-destructive bg-destructive/10 border-destructive/30",
    warning: "text-warning bg-warning/10 border-warning/30",
    success: "text-success bg-success/10 border-success/30",
    info: "text-info bg-info/10 border-info/30",
  };

  if (isLoading) {
    return (
      <Card className="border-2 border-dashed border-muted animate-pulse">
        <CardContent className="p-6">
          <div className="h-48 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============================================
  // VERSÃO COMPLETA (OFICINA COMPLETA)
  // ============================================
  if (hasFullAccess) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="relative overflow-hidden border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5">
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-orange-500/10 opacity-50" />
          
          {/* Header */}
          <CardHeader className="relative pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div 
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30"
                >
                  <Crown className="w-6 h-6 text-white" />
                </motion.div>
                <div>
                  <CardTitle className="text-lg font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                    Inteligência Oficina Completa
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Visão completa da sua operação
                  </p>
                </div>
              </div>
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                <Sparkles className="w-3 h-3 mr-1" />
                Ativo
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="relative space-y-4 pt-2">
            {/* Métricas Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {metrics.map((metric, index) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "p-3 rounded-xl border",
                    colorMap[metric.color]
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {metric.icon}
                    <span className="text-xs font-medium opacity-80">{metric.label}</span>
                  </div>
                  <div className="text-xl font-bold">{metric.value}</div>
                  {metric.subtext && (
                    <div className="text-[10px] opacity-70 mt-0.5">{metric.subtext}</div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Feedback de proteção - Tom consultivo */}
            {perdasEvitadas > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="p-4 rounded-xl bg-gradient-to-r from-success/10 to-success/5 border border-success/30"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-success" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-success">
                        Proteção ativa
                      </span>
                      <Badge variant="outline" className="text-[10px] border-success/50 text-success">
                        Monitorando
                      </Badge>
                    </div>
                    <p className="text-xs text-success/80 mt-0.5">
                      {formatCurrency(perdasEvitadas)} em oportunidades identificadas este mês. 
                      Você está tomando decisões com dados reais.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate("/financeiro")}
                className="text-xs"
              >
                <BarChart3 className="w-3 h-3 mr-1" />
                Ver Financeiro Completo
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate("/servicos")}
                className="text-xs"
              >
                <Target className="w-3 h-3 mr-1" />
                Analisar Diagnósticos
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // ============================================
  // VERSÃO BLOQUEADA (OUTROS PLANOS)
  // Motor de upgrade
  // ============================================
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="relative overflow-hidden border-2 border-muted bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        {/* Lock overlay pattern */}
        <div className="absolute inset-0 opacity-5">
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `repeating-linear-gradient(
                45deg,
                transparent,
                transparent 20px,
                currentColor 20px,
                currentColor 21px
              )`
            }}
          />
        </div>
        
        {/* Header */}
        <CardHeader className="relative pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-muted-foreground/30 to-muted-foreground/50 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-white/50" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-muted-foreground flex items-center justify-center">
                  <Lock className="w-3 h-3 text-white" />
                </div>
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-muted-foreground">
                  Inteligência Oficina Completa
                </CardTitle>
                <p className="text-xs text-muted-foreground/70">
                  Bloqueado no seu plano atual
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-amber-500/50 text-amber-600">
              <Zap className="w-3 h-3 mr-1" />
              Oficina Completa
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="relative space-y-4 pt-2">
          {/* Valor Oculto - Tom calmo, sem pressão */}
          <motion.div
            className="p-4 rounded-xl bg-muted border border-border"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <EyeOff className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-foreground">
                    {formatCurrency(valorOcultoEstimado)}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    em insights disponíveis
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Esse valor representa oportunidades que o plano Oficina Completa ajuda a visualizar.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Métricas Bloqueadas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {metrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="relative p-3 rounded-xl border border-muted bg-muted/30"
              >
                {/* Blur overlay */}
                <div className="absolute inset-0 backdrop-blur-sm bg-background/50 rounded-xl flex items-center justify-center">
                  <Lock className="w-4 h-4 text-muted-foreground/50" />
                </div>
                
                <div className="flex items-center gap-2 mb-1 opacity-30">
                  {metric.icon}
                  <span className="text-xs font-medium">{metric.label}</span>
                </div>
                <div className="text-xl font-bold opacity-30">???</div>
              </motion.div>
            ))}
          </div>

          {/* Comparativo de Planos - Linguagem consultiva */}
          <div className="p-4 rounded-xl bg-muted/50 border border-muted">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-600" />
              O que você pode acessar
            </h4>
            <div className="space-y-2">
              {planComparison.slice(1, 5).map((item, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-muted last:border-0"
                >
                  <span className="text-muted-foreground">{item.feature}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">
                      {item.motoPro ? "✓" : "—"}
                    </span>
                    <span className="text-success font-bold">✓</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-4 mt-2 text-[10px] text-muted-foreground">
              <span>Seu plano</span>
              <span className="text-amber-600 font-semibold">Oficina Completa</span>
            </div>
          </div>

          {/* CTA Upgrade - Calmo */}
          <Button 
            onClick={() => navigate("/upgrade")}
            variant="outline"
            className="w-full h-12 border-amber-500/30 text-amber-600 hover:bg-amber-500/5 font-semibold"
          >
            <Crown className="w-5 h-5 mr-2" />
            Conhecer plano Oficina Completa
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          {/* Feedback emocional - Disclaimer */}
          <p className="text-[10px] text-center text-muted-foreground">
            💡 Esse ajuste ajuda sua oficina a evitar retrabalho e proteger sua margem.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================
// MINI BANNER para áreas bloqueadas
// ============================================
export function InfinityLockedBanner({ feature }: { feature: string }) {
  const navigate = useNavigate();
  const { isOficinaPro, isTrialActive, hasActivePlan } = usePlan();
  
  const isOficinaCompleta = isOficinaPro && hasActivePlan && !isTrialActive;
  
  if (isOficinaCompleta) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-amber-600" />
        <span className="text-xs text-amber-700 font-medium">
          {feature} • Exclusivo Oficina Completa
        </span>
      </div>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => navigate("/upgrade")}
        className="text-xs text-amber-600 hover:text-amber-700 h-7 px-2"
      >
        Desbloquear
        <ArrowRight className="w-3 h-3 ml-1" />
      </Button>
    </motion.div>
  );
}
