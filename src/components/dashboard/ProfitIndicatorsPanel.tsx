import { motion } from "framer-motion";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Target, 
  Users, 
  Wrench,
  DollarSign,
  BarChart3,
  ChevronRight,
  Skull,
  Crown,
  AlertCircle,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProfitIndicators } from "@/hooks/useProfitIndicators";
import { useUserRole } from "@/hooks/useUserRole";
import { useOficinaLabels } from "@/hooks/useOficinaLabels";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";

const formatPercent = (value: number) => {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
};

// ============================================
// INDICADORES DE RENTABILIDADE - MODO GUERRA PRO
// Tom consultivo: orienta decisões, não acusa
// ============================================

export function ProfitIndicatorsPanel() {
  const { indicators, isLoading } = useProfitIndicators();
  const { canViewLucro } = useUserRole();
  const { labels, isAutoEletrica } = useOficinaLabels();

  // Só mostrar para quem tem permissão de ver lucro
  if (!canViewLucro) return null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const hasData = indicators.totalOSAnalisadas > 0;
  const hasCriticalAlerts = indicators.alertasCriticos.length > 0;

  return (
    <div className="space-y-4">
      {/* Pontos de atenção - Aparecem primeiro se existirem */}
      {hasCriticalAlerts && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-warning/10 border border-warning/30 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-warning" />
            <h3 className="font-semibold text-warning">Pontos de atenção</h3>
          </div>
          <div className="space-y-2">
            {indicators.alertasCriticos.map((alerta, idx) => (
              <div 
                key={idx}
                className="flex items-center justify-between bg-background/50 rounded-lg px-3 py-2"
              >
                <span className="text-sm text-foreground">{alerta.mensagem}</span>
                {alerta.impacto > 0 && (
                  <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
                    {formatCurrency(alerta.impacto)} em oportunidade
                  </Badge>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 italic">
            💡 Esses ajustes podem melhorar a rentabilidade da sua oficina.
          </p>
        </motion.div>
      )}

      {/* Resumo Geral de Margem */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {/* Margem Média */}
        <div className={cn(
          "bg-card border rounded-xl p-4",
          indicators.margemMediaGeral >= 30 
            ? "border-success/30" 
            : indicators.margemMediaGeral >= 15 
              ? "border-warning/30" 
              : "border-destructive/30"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Target className={cn(
              "w-4 h-4",
              indicators.margemMediaGeral >= 30 
                ? "text-success" 
                : indicators.margemMediaGeral >= 15 
                  ? "text-warning" 
                  : "text-destructive"
            )} />
            <span className="text-xs text-muted-foreground">Margem Média</span>
          </div>
          <p className={cn(
            "text-2xl font-bold",
            indicators.margemMediaGeral >= 30 
              ? "text-success" 
              : indicators.margemMediaGeral >= 15 
                ? "text-warning" 
                : "text-destructive"
          )}>
            {indicators.margemMediaGeral.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {indicators.totalOSAnalisadas} {isAutoEletrica ? "diagnósticos" : "OS"} {isAutoEletrica ? "analisados" : "analisadas"}
          </p>
        </div>

        {/* OS para revisar */}
        <div className={cn(
          "bg-card border rounded-xl p-4",
          indicators.osComPrejuizo > 0 ? "border-warning/30" : "border-border"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Target className={cn(
              "w-4 h-4",
              indicators.osComPrejuizo > 0 ? "text-warning" : "text-muted-foreground"
            )} />
            <span className="text-xs text-muted-foreground">
              {isAutoEletrica ? "Diagnósticos para revisar" : "OS para revisar"}
            </span>
          </div>
          <p className={cn(
            "text-2xl font-bold",
            indicators.osComPrejuizo > 0 ? "text-warning" : "text-foreground"
          )}>
            {indicators.osComPrejuizo}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {indicators.osComPrejuizo > 0 
              ? "Oportunidade de ajuste" 
              : "Nenhuma"}
          </p>
        </div>

        {/* OS com Margem Baixa */}
        <div className={cn(
          "bg-card border rounded-xl p-4",
          indicators.osComMargemBaixa > 0 ? "border-warning/30" : "border-border"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={cn(
              "w-4 h-4",
              indicators.osComMargemBaixa > 0 ? "text-warning" : "text-muted-foreground"
            )} />
            <span className="text-xs text-muted-foreground">Ajuste recomendado</span>
          </div>
          <p className={cn(
            "text-2xl font-bold",
            indicators.osComMargemBaixa > 0 ? "text-warning" : "text-foreground"
          )}>
            {indicators.osComMargemBaixa}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            &lt;15% de margem
          </p>
        </div>

        {/* Clientes VIP */}
        <div className="bg-card border border-success/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-success" />
            <span className="text-xs text-muted-foreground">Clientes VIP</span>
          </div>
          <p className="text-2xl font-bold text-success">
            {indicators.clientesRentabilidade.filter(c => c.classificacao === "vip").length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Margem &gt;30%
          </p>
        </div>
      </motion.div>

      {/* Serviços com oportunidade de melhoria */}
      {indicators.servicosProblematicos.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-xl overflow-hidden"
        >
          <div className="p-4 border-b border-border bg-warning/5">
            <div className="flex items-center gap-2">
              {isAutoEletrica ? (
                <Zap className="w-5 h-5 text-warning" />
              ) : (
                <Wrench className="w-5 h-5 text-warning" />
              )}
              <h3 className="font-semibold text-foreground">
                {isAutoEletrica ? "Diagnósticos com oportunidade" : "Serviços com oportunidade"}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isAutoEletrica 
                ? "Esses diagnósticos podem ter margem melhor com pequenos ajustes" 
                : "Esses serviços podem melhorar com pequenos ajustes"}
            </p>
          </div>
          <div className="divide-y divide-border">
            {indicators.servicosProblematicos.slice(0, 3).map((servico, idx) => (
              <div key={idx} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-foreground">{servico.tipo_servico}</span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      servico.prejuizo_ou_margem_baixa < 0 
                        ? "bg-warning/10 text-warning border-warning/30" 
                        : "bg-warning/10 text-warning border-warning/30"
                    )}
                  >
                    {servico.prejuizo_ou_margem_baixa < 0 ? "REVISAR" : "AJUSTE RECOMENDADO"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{servico.motivo}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {servico.total_os} OS • {formatCurrency(servico.faturamento)} faturado
                  </span>
                  <span className={cn(
                    "font-medium",
                    servico.prejuizo_ou_margem_baixa >= 0 ? "text-warning" : "text-warning"
                  )}>
                    {formatCurrency(Math.abs(servico.prejuizo_ou_margem_baixa))} {servico.prejuizo_ou_margem_baixa >= 0 ? 'lucro' : 'em oportunidade'}
                  </span>
                </div>
                <p className="text-xs text-primary mt-2 font-medium">
                  💡 {servico.recomendacao}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Top 5 Clientes por Rentabilidade */}
      {hasData && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-xl overflow-hidden"
        >
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Rentabilidade por Cliente</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ranking de clientes por margem real (não por volume)
            </p>
          </div>
          <div className="divide-y divide-border">
            {indicators.clientesRentabilidade.slice(0, 5).map((cliente, idx) => (
              <div key={cliente.id} className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      cliente.classificacao === "vip" 
                        ? "bg-success/20 text-success" 
                        : cliente.classificacao === "lucrativo"
                          ? "bg-primary/20 text-primary"
                          : cliente.classificacao === "margem_baixa"
                            ? "bg-warning/20 text-warning"
                            : "bg-destructive/20 text-destructive"
                    )}>
                      {idx + 1}
                    </div>
                    <span className="font-medium text-foreground">{cliente.nome}</span>
                  </div>
                  <Badge 
                    variant="outline"
                    className={cn(
                      "text-xs",
                      cliente.classificacao === "vip" 
                        ? "bg-success/10 text-success border-success/30" 
                        : cliente.classificacao === "lucrativo"
                          ? "bg-primary/10 text-primary border-primary/30"
                          : cliente.classificacao === "margem_baixa"
                            ? "bg-warning/10 text-warning border-warning/30"
                            : "bg-destructive/10 text-destructive border-destructive/30"
                    )}
                  >
                    {cliente.margem_media.toFixed(1)}% margem
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{cliente.total_os} OS • Ticket médio: {formatCurrency(cliente.ticket_medio)}</span>
                  <span className={cn(
                    "font-medium",
                    cliente.lucro_total >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {formatCurrency(cliente.lucro_total)} lucro
                  </span>
                </div>
                <p className="text-xs mt-2 opacity-80">{cliente.veredicto}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Lucro por Tipo de Serviço */}
      {hasData && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-xl overflow-hidden"
        >
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2">
              {isAutoEletrica ? (
                <Zap className="w-5 h-5 text-warning" />
              ) : (
                <BarChart3 className="w-5 h-5 text-accent" />
              )}
              <h3 className="font-semibold text-foreground">
                {isAutoEletrica ? "Rentabilidade por Diagnóstico" : "Lucro por Tipo de Serviço"}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isAutoEletrica 
                ? "Quais diagnósticos valem a pena pegar" 
                : "Onde você realmente ganha dinheiro"}
            </p>
            {isAutoEletrica && (
              <div className="flex items-center gap-3 mt-2 text-xs">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> Prejuízo</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" /> Baixa</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> Saudável</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Excelente</span>
              </div>
            )}
          </div>
          <div className="divide-y divide-border">
            {indicators.lucroPorTipo.slice(0, 5).map((tipo, idx) => {
              const barWidth = Math.min(100, Math.max(0, tipo.margem_media));
              return (
                <div key={tipo.tipo_servico} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{tipo.tipo_servico}</span>
                      {tipo.movimento_alto_lucro_baixo && (
                        <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
                          ⚠️ Alto volume, baixo lucro
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {tipo.total_os} {isAutoEletrica ? "diag." : "OS"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all",
                          tipo.margem_media >= 50 
                            ? "bg-primary" 
                            : tipo.margem_media >= 30 
                              ? "bg-success" 
                              : tipo.margem_media >= 15 
                                ? "bg-warning" 
                                : "bg-destructive"
                        )}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className={cn(
                      "text-sm font-medium w-16 text-right",
                      tipo.margem_media >= 50 
                        ? "text-primary" 
                        : tipo.margem_media >= 30 
                          ? "text-success" 
                          : tipo.margem_media >= 15 
                            ? "text-warning" 
                            : "text-destructive"
                    )}>
                      {tipo.margem_media.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>Fat: {formatCurrency(tipo.faturamento_total)}</span>
                    <span className={cn(
                      "font-medium",
                      tipo.lucro_total >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {isAutoEletrica ? "Resultado" : "Lucro"}: {formatCurrency(tipo.lucro_total)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {!hasData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card border border-border rounded-xl p-8 text-center"
        >
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-foreground mb-2">Aguardando dados</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Finalize OS com valores de custo e venda para ver os indicadores.
            O sistema precisa de dados financeiros para identificar oportunidades.
          </p>
          <p className="text-xs text-muted-foreground mt-3 italic">
            💡 Quanto mais dados, melhores serão as análises para sua oficina.
          </p>
        </motion.div>
      )}
    </div>
  );
}
