import { useOficina } from "@/contexts/OficinaContext";
import { useProfitIndicators } from "./useProfitIndicators";
import { useSmartAlerts } from "./useSmartAlerts";
import { usePlan } from "./usePlan";
import { useOficinaLabels } from "./useOficinaLabels";
import { useState, useMemo } from "react";

// ============================================
// MODO GUERRA PRO - ALERTAS ACIONÁVEIS
// ============================================
// Alertas não são notificações.
// São ordens táticas com impacto financeiro obrigatório.

export type ModoGuerraSeverity = "critical" | "attention" | "insight";
export type ModoGuerraStatus = "ativo" | "resolvido" | "ignorado";

export interface ModoGuerraAlert {
  id: string;
  tipo: "prejuizo_os" | "margem_baixa" | "diagnostico_subvalorizado" | "cliente_risco" | "servico_problematico" | "estoque_critico";
  severity: ModoGuerraSeverity;
  status: ModoGuerraStatus;
  
  // Obrigatório: impacto financeiro
  impactoFinanceiro: number;
  impactoLabel: string;
  
  // Conteúdo
  titulo: string;
  descricao: string;
  timestamp: Date;
  recorrencia?: number; // quantas vezes já ocorreu
  
  // Ações
  acaoRecomendada: string;
  ctaPrimario: string;
  ctaSecundario?: string;
  
  // Vínculo
  referenciaId?: string;
  referenciaTipo?: "os" | "cliente" | "estoque" | "servico";
}

export interface ModoGuerraStats {
  // Métricas de impacto
  prejuizoEvitado: number;
  alertasResolvidos: number;
  alertasIgnorados: number;
  alertasAtivos: number;
  
  // Ranking de causas
  causasPrejuizo: {
    causa: string;
    impacto: number;
    quantidade: number;
  }[];
  
  // Para planos inferiores
  valorOcultoEstimado: number;
}

export function useModoGuerraAlerts() {
  const { oficinaAtual } = useOficina();
  const { indicators, isLoading: indicatorsLoading, refetch: refetchIndicators } = useProfitIndicators();
  const { alerts: smartAlerts, isLoading: alertsLoading, refetch: refetchAlerts } = useSmartAlerts();
  const { currentPlan } = usePlan();
  const { labels, isAutoEletrica } = useOficinaLabels();
  
  // Oficina Completa = oficina_pro (plano mais completo)
  const isOficinaCompleta = currentPlan === "oficina_pro";

  // Estado local para alertas ignorados/resolvidos (persiste em sessionStorage)
  const [alertStates, setAlertStates] = useState<Record<string, ModoGuerraStatus>>(() => {
    try {
      const stored = sessionStorage.getItem(`modo-guerra-states-${oficinaAtual?.id}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Transformar dados em alertas Modo Guerra
  const modoGuerraAlerts = useMemo((): ModoGuerraAlert[] => {
    if (!oficinaAtual) return [];

    const alerts: ModoGuerraAlert[] = [];
    const agora = new Date();

    // ============================================
    // 1. OS COM PREJUÍZO (CRÍTICO)
    // ============================================
    indicators.margensOS
      .filter(os => os.risco === "critico" && os.lucro < 0)
      .forEach(os => {
        const id = `prejuizo-${os.id}`;
        alerts.push({
          id,
          tipo: "prejuizo_os",
          severity: "critical",
          status: alertStates[id] || "ativo",
          impactoFinanceiro: Math.abs(os.lucro),
          impactoLabel: `Prejuízo: R$ ${Math.abs(os.lucro).toFixed(0)}`,
          titulo: `⚠️ ${isAutoEletrica ? 'Diagnóstico' : 'OS'} com Prejuízo`,
          descricao: `${os.tipo_servico} - ${os.veiculo_info}. Você pagou R$ ${Math.abs(os.lucro).toFixed(0)} para trabalhar.`,
          timestamp: new Date(os.data_servico),
          acaoRecomendada: "Revisar custos e precificação deste tipo de serviço",
          ctaPrimario: "Ver detalhes",
          ctaSecundario: "Ignorar",
          referenciaId: os.id,
          referenciaTipo: "os",
        });
      });

    // ============================================
    // 2. MARGEM BAIXA (ATENÇÃO)
    // ============================================
    indicators.margensOS
      .filter(os => os.risco === "baixo" && os.margem_percentual < 15 && os.margem_percentual >= 0)
      .slice(0, 5) // Limitar a 5 para não poluir
      .forEach(os => {
        const id = `margem-${os.id}`;
        const potencialPerdido = os.valor_servico * 0.15 - os.lucro; // Quanto perdeu vs margem ideal
        
        alerts.push({
          id,
          tipo: "margem_baixa",
          severity: "attention",
          status: alertStates[id] || "ativo",
          impactoFinanceiro: potencialPerdido > 0 ? potencialPerdido : 0,
          impactoLabel: `Margem: ${os.margem_percentual.toFixed(0)}%`,
          titulo: `📉 Margem abaixo do ideal`,
          descricao: `${os.tipo_servico} - Margem de ${os.margem_percentual.toFixed(0)}%. Deveria ser ≥15%.`,
          timestamp: new Date(os.data_servico),
          acaoRecomendada: "Ajustar precificação ou renegociar custos",
          ctaPrimario: "Rever valor",
          ctaSecundario: "Entendido",
          referenciaId: os.id,
          referenciaTipo: "os",
        });
      });

    // ============================================
    // 3. DIAGNÓSTICO SUBVALORIZADO (Auto Elétrica)
    // ============================================
    smartAlerts
      .filter(a => a.type === "diagnostic_undercharged")
      .forEach(alert => {
        const id = `subvalorizado-${alert.referenceId}`;
        const impacto = alert.impactoFinanceiro ? Math.abs(alert.impactoFinanceiro) : 50;
        
        alerts.push({
          id,
          tipo: "diagnostico_subvalorizado",
          severity: "attention",
          status: alertStates[id] || "ativo",
          impactoFinanceiro: impacto,
          impactoLabel: `Lucro mínimo: R$ ${impacto.toFixed(0)}`,
          titulo: `⚡ ${isAutoEletrica ? 'Diagnóstico' : 'Serviço'} subvalorizado`,
          descricao: alert.description,
          timestamp: agora,
          acaoRecomendada: isAutoEletrica 
            ? "Reavaliar valor do diagnóstico técnico"
            : "Rever valor do serviço",
          ctaPrimario: "Rever valor",
          ctaSecundario: "Ignorar",
          referenciaId: alert.referenceId,
          referenciaTipo: "os",
        });
      });

    // ============================================
    // 4. CLIENTES DE RISCO (CRÍTICO)
    // ============================================
    indicators.clientesRentabilidade
      .filter(c => c.classificacao === "prejuizo")
      .forEach(cliente => {
        const id = `cliente-risco-${cliente.id}`;
        
        alerts.push({
          id,
          tipo: "cliente_risco",
          severity: "critical",
          status: alertStates[id] || "ativo",
          impactoFinanceiro: Math.abs(cliente.lucro_total),
          impactoLabel: `Prejuízo total: R$ ${Math.abs(cliente.lucro_total).toFixed(0)}`,
          titulo: `👤 Cliente dá prejuízo`,
          descricao: `${cliente.nome} - ${cliente.total_os} OS no mês com prejuízo de R$ ${Math.abs(cliente.lucro_total).toFixed(0)}`,
          timestamp: agora,
          recorrencia: cliente.total_os,
          acaoRecomendada: "Renegociar valores ou reconsiderar atendimento",
          ctaPrimario: "Ver cliente",
          ctaSecundario: "Ignorar",
          referenciaId: cliente.id,
          referenciaTipo: "cliente",
        });
      });

    // ============================================
    // 5. SERVIÇOS PROBLEMÁTICOS (INSIGHT)
    // ============================================
    indicators.servicosProblematicos
      .filter(s => s.prejuizo_ou_margem_baixa < 0)
      .forEach(servico => {
        const id = `servico-prob-${servico.tipo_servico.replace(/\s/g, '-')}`;
        
        alerts.push({
          id,
          tipo: "servico_problematico",
          severity: servico.prejuizo_ou_margem_baixa < -100 ? "critical" : "insight",
          status: alertStates[id] || "ativo",
          impactoFinanceiro: Math.abs(servico.prejuizo_ou_margem_baixa),
          impactoLabel: `Perda: R$ ${Math.abs(servico.prejuizo_ou_margem_baixa).toFixed(0)}`,
          titulo: `🔧 ${servico.tipo_servico} não está pagando`,
          descricao: `${servico.motivo}. ${servico.total_os} OS com esse serviço.`,
          timestamp: agora,
          recorrencia: servico.total_os,
          acaoRecomendada: servico.recomendacao,
          ctaPrimario: "Revisar serviço",
          ctaSecundario: "Entendido",
          referenciaTipo: "servico",
        });
      });

    // ============================================
    // 6. ITENS SEM CUSTO (ALERTA DE SEGURANÇA)
    // ============================================
    if (indicators.alertasCriticos.some(a => a.tipo === "itens_sem_custo")) {
      alerts.push({
        id: "alerta-sem-custo-global",
        tipo: "servico_problematico",
        severity: "critical",
        status: "ativo",
        impactoFinanceiro: 0,
        impactoLabel: "Risco de lucro falso",
        titulo: "⚠️ Itens sem custo detectados",
        descricao: "Existem itens sendo vendidos sem custo de aquisição registrado. Isso infla o lucro artificialmente.",
        timestamp: agora,
        acaoRecomendada: "Cadastrar custo médio ou preço de compra nos produtos",
        ctaPrimario: "Ver estoque",
        ctaSecundario: "Entendido",
        referenciaTipo: "estoque"
      });
    }

    // 7. ESTOQUE CRÍTICO (de smartAlerts)
    smartAlerts
      .filter(a => a.type === "stock" && a.severity === "critical")
      .slice(0, 3)
      .forEach(alert => {
        const id = `estoque-${alert.referenceId}`;
        
        alerts.push({
          id,
          tipo: "estoque_critico",
          severity: "attention",
          status: alertStates[id] || "ativo",
          impactoFinanceiro: 0, // Estoque não tem impacto direto, mas bloqueia serviço
          impactoLabel: "Parada operacional",
          titulo: `📦 ${alert.title}`,
          descricao: alert.description,
          timestamp: agora,
          acaoRecomendada: "Reabastecer estoque para evitar parada de serviços",
          ctaPrimario: "Ver estoque",
          ctaSecundario: "Ignorar",
          referenciaId: alert.referenceId,
          referenciaTipo: "estoque",
        });
      });


    // Ordenar por severidade e impacto
    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, attention: 1, insight: 2 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return b.impactoFinanceiro - a.impactoFinanceiro;
    });
  }, [indicators, smartAlerts, alertStates, oficinaAtual, isAutoEletrica]);

  // Filtrar por status
  const alertasAtivos = modoGuerraAlerts.filter(a => a.status === "ativo");
  const alertasResolvidos = modoGuerraAlerts.filter(a => a.status === "resolvido");
  const alertasIgnorados = modoGuerraAlerts.filter(a => a.status === "ignorado");

  // ============================================
  // ESTATÍSTICAS MODO GUERRA
  // ============================================
  const stats = useMemo((): ModoGuerraStats => {
    // Prejuízo evitado = alertas resolvidos com impacto
    const prejuizoEvitado = alertasResolvidos.reduce((sum, a) => sum + a.impactoFinanceiro, 0);
    
    // Ranking de causas
    const causasMap = new Map<string, { impacto: number; quantidade: number }>();
    
    modoGuerraAlerts.forEach(alert => {
      const causa = alert.tipo === "prejuizo_os" ? "OS com prejuízo" :
                    alert.tipo === "margem_baixa" ? "Margem baixa" :
                    alert.tipo === "diagnostico_subvalorizado" ? "Diagnóstico subvalorizado" :
                    alert.tipo === "cliente_risco" ? "Cliente problemático" :
                    alert.tipo === "servico_problematico" ? "Serviço não paga" :
                    "Outros";
      
      const current = causasMap.get(causa) || { impacto: 0, quantidade: 0 };
      causasMap.set(causa, {
        impacto: current.impacto + alert.impactoFinanceiro,
        quantidade: current.quantidade + 1,
      });
    });

    const causasPrejuizo = Array.from(causasMap.entries())
      .map(([causa, data]) => ({ causa, ...data }))
      .sort((a, b) => b.impacto - a.impacto);

    // Valor oculto estimado (para planos inferiores)
    const valorOcultoBase = alertasAtivos.reduce((sum, a) => sum + a.impactoFinanceiro, 0);
    const valorOcultoEstimado = isOficinaCompleta ? 0 : Math.max(valorOcultoBase * 1.5, indicators.totalOSAnalisadas * 30);

    return {
      prejuizoEvitado,
      alertasResolvidos: alertasResolvidos.length,
      alertasIgnorados: alertasIgnorados.length,
      alertasAtivos: alertasAtivos.length,
      causasPrejuizo,
      valorOcultoEstimado,
    };
  }, [modoGuerraAlerts, alertasAtivos, alertasResolvidos, alertasIgnorados, isOficinaCompleta, indicators]);

  // ============================================
  // AÇÕES
  // ============================================
  const updateAlertStatus = (alertId: string, newStatus: ModoGuerraStatus) => {
    const newStates = { ...alertStates, [alertId]: newStatus };
    setAlertStates(newStates);
    
    // Persistir em sessionStorage
    try {
      sessionStorage.setItem(`modo-guerra-states-${oficinaAtual?.id}`, JSON.stringify(newStates));
    } catch (e) {
      console.warn("Erro ao salvar estado de alertas:", e);
    }
  };

  const resolverAlerta = (alertId: string) => updateAlertStatus(alertId, "resolvido");
  const ignorarAlerta = (alertId: string) => updateAlertStatus(alertId, "ignorado");
  const reativarAlerta = (alertId: string) => updateAlertStatus(alertId, "ativo");

  return {
    // Alertas
    alertas: alertasAtivos,
    todosAlertas: modoGuerraAlerts,
    alertasResolvidos,
    alertasIgnorados,
    
    // Stats
    stats,
    
    // Estado
    isLoading: indicatorsLoading || alertsLoading,
    isInfinity: isOficinaCompleta,
    
    // Ações
    resolverAlerta,
    ignorarAlerta,
    reativarAlerta,
    refetch: () => {
      refetchIndicators();
      refetchAlerts();
    }
  };
}
