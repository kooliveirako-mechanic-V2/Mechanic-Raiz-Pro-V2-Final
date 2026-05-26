import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingDown, 
  Crown, 
  ArrowRight, 
  Users,
  Zap,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePlan } from "@/hooks/usePlan";
import { useNavigate } from "react-router-dom";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { useClientes } from "@/hooks/useClientes";
import { useEstoque } from "@/hooks/useEstoque";
import { useMemo } from "react";
import { formatCurrency } from "@/lib/formatters";

interface ValueTrigger {
  id: string;
  icon: React.ReactNode;
  title: string;
  impact: string;
  description: string;
  color: "destructive" | "warning" | "info";
}

/**
 * Componente que mostra "gatilhos de desejo" com valor financeiro real
 * Só aparece para planos que não são Oficina Completa
 * Mostra prejuízo REAL baseado nos dados do usuário
 */
export function UpgradeValueTrigger() {
  const navigate = useNavigate();
  const { isOficinaPro, isTrialActive, hasActivePlan, isMotoPro } = usePlan();
  const { ordens: ordensServico } = useOrdensServico();
  const { clientes } = useClientes();
  const { itens: estoque } = useEstoque();

  // Oficina Completa = tem acesso completo
  const isPlanoCompleto = isOficinaPro && hasActivePlan && !isTrialActive;
  
  // Não mostrar para Oficina Completa
  if (isPlanoCompleto) return null;

  // Calcular métricas reais de perda
  const insights = useMemo(() => {
    // 1. OS sem lucro rastreado (sem custo preenchido)
    const osSemCusto = ordensServico.filter(os => 
      os.valor_servico && os.valor_servico > 0 && 
      (!os.custo_servico || os.custo_servico === 0) &&
      os.status === "finalizado"
    );
    
    // Estimativa: 30% do valor é custo médio não rastreado
    const lucroNaoRastreado = osSemCusto.reduce((sum, os) => 
      sum + (os.valor_servico || 0) * 0.3, 0
    );

    // 2. Diagnósticos com tempo alto e valor baixo (Auto Elétrica)
    const diagnosticosSubvalorizados = ordensServico.filter(os => 
      os.tipo_servico?.toLowerCase().includes("diagnóstico") &&
      os.valor_servico && os.valor_servico < 200
    );
    
    // Estimativa: R$ 150 perdido por diagnóstico mal cobrado
    const perdaDiagnosticos = diagnosticosSubvalorizados.length * 150;

    // 3. Clientes que não voltaram (última OS > 90 dias)
    const hoje = new Date();
    const clientesInativos = clientes.filter(cliente => {
      const osCliente = ordensServico.filter(os => os.cliente_id === cliente.id);
      if (osCliente.length === 0) return false;
      
      const ultimaOS = osCliente.sort((a, b) => 
        new Date(b.data_servico).getTime() - new Date(a.data_servico).getTime()
      )[0];
      
      const diasDesdeUltimaOS = Math.floor(
        (hoje.getTime() - new Date(ultimaOS.data_servico).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      return diasDesdeUltimaOS > 90;
    });
    
    // Estimativa: R$ 300 por cliente que não voltou
    const perdaClientesInativos = clientesInativos.length * 300;

    // 4. Estoque parado (itens sem movimentação)
    const estoqueParado = estoque.filter(item => 
      item.quantidade > 0 && 
      !item.ultima_saida
    );
    
    const valorEstoqueParado = estoqueParado.reduce((sum, item) => 
      sum + (item.custo_unitario || 0) * item.quantidade, 0
    );

    return {
      osSemCusto: osSemCusto.length,
      lucroNaoRastreado,
      diagnosticosSubvalorizados: diagnosticosSubvalorizados.length,
      perdaDiagnosticos,
      clientesInativos: clientesInativos.length,
      perdaClientesInativos,
      estoqueParado: estoqueParado.length,
      valorEstoqueParado,
      totalPerdaEstimada: lucroNaoRastreado + perdaDiagnosticos + perdaClientesInativos
    };
  }, [ordensServico, clientes, estoque]);

  // Só mostrar se tiver dados suficientes
  if (ordensServico.length < 3) return null;

  // Montar triggers baseados nos dados reais - Linguagem progressiva
  const triggers: ValueTrigger[] = [];

  if (insights.osSemCusto > 0 && insights.lucroNaoRastreado > 100) {
    triggers.push({
      id: "lucro-invisivel",
      icon: <TrendingDown className="w-5 h-5" />,
      title: "Custos não rastreados",
      impact: formatCurrency(insights.lucroNaoRastreado),
      description: `${insights.osSemCusto} serviços finalizados sem custo preenchido — pode haver oportunidade de melhoria`,
      color: "warning",
    });
  }

  if (insights.diagnosticosSubvalorizados > 0 && insights.perdaDiagnosticos > 0) {
    triggers.push({
      id: "diagnostico-barato",
      icon: <Zap className="w-5 h-5" />,
      title: "Diagnósticos para revisar",
      impact: formatCurrency(insights.perdaDiagnosticos),
      description: `${insights.diagnosticosSubvalorizados} diagnósticos abaixo de R$ 200 — vale avaliar se o preço cobre o tempo técnico`,
      color: "info",
    });
  }

  if (insights.clientesInativos > 2 && insights.perdaClientesInativos > 500) {
    triggers.push({
      id: "clientes-perdidos",
      icon: <Users className="w-5 h-5" />,
      title: "Clientes sem retorno recente",
      impact: formatCurrency(insights.perdaClientesInativos),
      description: `${insights.clientesInativos} clientes há +90 dias sem OS — lembretes automáticos podem ajudar`,
      color: "info",
    });
  }

  // Se não tem triggers relevantes, não mostrar
  if (triggers.length === 0) return null;

  const colorMap = {
    destructive: "border-amber-500/30 bg-amber-500/5",
    warning: "border-amber-500/30 bg-amber-500/5",
    info: "border-blue-500/30 bg-blue-500/5",
  };

  const iconColorMap = {
    destructive: "text-amber-600 bg-amber-500/10",
    warning: "text-amber-600 bg-amber-500/10",
    info: "text-blue-600 bg-blue-500/10",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* Header - Tom consultivo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-foreground">
            Oportunidades identificadas
          </h3>
        </div>
        <Badge variant="outline" className="text-[10px] border-muted text-muted-foreground">
          Baseado nos seus dados
        </Badge>
      </div>

      {/* Triggers */}
      <div className="space-y-2">
        <AnimatePresence>
          {triggers.slice(0, 2).map((trigger, index) => (
            <motion.div
              key={trigger.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={cn("border", colorMap[trigger.color])}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-lg", iconColorMap[trigger.color])}>
                      {trigger.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{trigger.title}</span>
                        <span className={cn(
                          "text-sm font-bold text-amber-600"
                        )}>
                          {trigger.impact}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {trigger.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Total + CTA - Tom calmo */}
      {insights.totalPerdaEstimada > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="p-4 rounded-xl bg-muted border border-border"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Valor envolvido:</span>
                <span className="text-lg font-bold text-foreground">
                  {formatCurrency(insights.totalPerdaEstimada)}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Oficinas com plano completo acompanham e ajustam essas métricas automaticamente
              </p>
            </div>
            <Button 
              onClick={() => navigate("/upgrade")}
              size="sm"
              variant="outline"
              className="border-amber-500/30 text-amber-600 hover:bg-amber-500/5 font-semibold shrink-0"
            >
              <Crown className="w-4 h-4 mr-1" />
              Conhecer
            </Button>
          </div>
          {/* Feedback emocional final */}
          <p className="text-[10px] text-muted-foreground mt-3 pt-3 border-t border-border">
            💡 Esse ajuste ajuda sua oficina a evitar retrabalho e proteger sua margem.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Banner compacto para mobile
 */
export function UpgradeValueTriggerMobile() {
  const navigate = useNavigate();
  const { isOficinaPro, isTrialActive, hasActivePlan } = usePlan();
  const { ordens: ordensServico } = useOrdensServico();

  const isPlanoCompleto = isOficinaPro && hasActivePlan && !isTrialActive;
  
  if (isPlanoCompleto) return null;

  // Cálculo simplificado para mobile
  const osSemCusto = ordensServico.filter(os => 
    os.valor_servico && os.valor_servico > 0 && 
    (!os.custo_servico || os.custo_servico === 0) &&
    os.status === "finalizado"
  );

  if (osSemCusto.length < 2) return null;

  const perdaEstimada = osSemCusto.reduce((sum, os) => 
    sum + (os.valor_servico || 0) * 0.3, 0
  );

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate("/upgrade")}
      className="w-full p-3 rounded-xl bg-muted border border-border flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
          <Eye className="w-4 h-4 text-amber-600" />
        </div>
        <div className="text-left">
          <p className="text-xs font-semibold text-foreground">
            Oportunidade identificada
          </p>
          <p className="text-[10px] text-muted-foreground">
            {osSemCusto.length} serviços para revisar
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-amber-600">
          {formatCurrency(perdaEstimada)}
        </span>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </motion.button>
  );
}
