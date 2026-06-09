import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { differenceInDays, parseISO, addDays, isBefore, isToday, format, startOfMonth, endOfMonth } from "date-fns";
import { FEATURE_FLAGS_V2 } from "@/config/featureFlagsV2";
import { financeiroV2Service } from "@/services/financeiroV2Service";

// ============================================
// MODO GUERRA PRO - ALERTAS INTELIGENTES
// ============================================
// Substitui mock data por alertas reais baseados em:
// - Recorrências vencendo
// - Estoque baixo
// - OS atrasadas
// - Garantias ativas próximas do vencimento
// - OS com margem crítica (do useProfitIndicators)

export type AlertType = 
  | "recurrence" 
  | "stock" 
  | "overdue" 
  | "warranty" 
  | "margin_critical"
  | "margin_low"
  | "client_loss"
  | "diagnostic_undercharged"
  | "parcela_atrasada"
  | "parcela_vencendo"
  | "audit_logic_clean";

export type AlertSeverity = "critical" | "warning" | "info";

export interface SmartAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  time: string;
  // Para navegação/ação
  referenceId?: string;
  referenceType?: "os" | "estoque" | "cliente" | "veiculo" | "recorrencia";
  // Impacto financeiro (quando aplicável)
  impactoFinanceiro?: number;
}

export function useSmartAlerts() {
  const { oficinaAtual } = useOficina();

  const { data: alerts = [], isLoading, error, refetch } = useQuery({
    queryKey: ["smartAlerts", oficinaAtual?.id],
    queryFn: async (): Promise<SmartAlert[]> => {
      if (!oficinaAtual) return [];

      const allAlerts: SmartAlert[] = [];
      const hoje = new Date();

      // ============================================
      // 1. RECORRÊNCIAS VENCENDO (próximos 7 dias)
      // ============================================
      const { data: recorrencias } = await supabase
        .from("recorrencias")
        .select(`
          id,
          tipo_servico,
          proxima_execucao,
          intervalo_dias,
          veiculo:veiculos (
            marca,
            modelo,
            placa,
            cliente:clientes (nome)
          )
        `)
        .eq("oficina_id", oficinaAtual.id)
        .eq("ativo", true)
        .not("proxima_execucao", "is", null)
        .lte("proxima_execucao", addDays(hoje, 7).toISOString().split("T")[0]);

      (recorrencias || []).forEach((rec) => {
        const veiculo = rec.veiculo as any;
        const proxima = parseISO(rec.proxima_execucao!);
        const diasRestantes = differenceInDays(proxima, hoje);
        
        let severity: AlertSeverity = "info";
        let timeLabel = "";
        
        if (diasRestantes < 0) {
          severity = "critical";
          timeLabel = `Vencido há ${Math.abs(diasRestantes)} dia(s)`;
        } else if (diasRestantes === 0) {
          severity = "warning";
          timeLabel = "Vence hoje";
        } else if (diasRestantes <= 3) {
          severity = "warning";
          timeLabel = `Em ${diasRestantes} dia(s)`;
        } else {
          timeLabel = `Em ${diasRestantes} dia(s)`;
        }

        allAlerts.push({
          id: `rec-${rec.id}`,
          type: "recurrence",
          severity,
          title: rec.tipo_servico,
          description: veiculo 
            ? `${veiculo.marca} ${veiculo.modelo} ${veiculo.placa ? `- ${veiculo.placa}` : ""} (${veiculo.cliente?.nome || "Cliente"})`
            : "Veículo não identificado",
          time: timeLabel,
          referenceId: rec.id,
          referenceType: "recorrencia",
        });
      });

      // ============================================
      // 2. ESTOQUE BAIXO
      // ============================================
      const { data: estoqueBaixo } = await supabase
        .from("estoque")
        .select("id, nome, quantidade, alerta_minimo, categoria")
        .eq("oficina_id", oficinaAtual.id)
        .eq("arquivado", false);

      (estoqueBaixo || []).filter(item => item.quantidade <= item.alerta_minimo).forEach((item) => {
        const severity: AlertSeverity = item.quantidade === 0 ? "critical" : "warning";
        
        allAlerts.push({
          id: `stock-${item.id}`,
          type: "stock",
          severity,
          title: `${item.nome} - Estoque Baixo`,
          description: item.quantidade === 0 
            ? "Produto esgotado! Reposição urgente."
            : `Apenas ${item.quantidade} unidade(s) - Mínimo: ${item.alerta_minimo}`,
          time: item.quantidade === 0 ? "Urgente" : "Atenção",
          referenceId: item.id,
          referenceType: "estoque",
        });
      });

      // ============================================
      // 3. OS ATRASADAS (pendentes ou em_andamento com data passada)
      // ============================================
      const { data: osAtrasadas } = await supabase
        .from("ordens_servico")
        .select(`
          id,
          tipo_servico,
          data_servico,
          status,
          cliente:clientes (nome),
          veiculo:veiculos (marca, modelo, placa)
        `)
        .eq("oficina_id", oficinaAtual.id)
        .in("status", ["pendente", "em_andamento", "em_diagnostico", "aguardando_peca"])
        .lt("data_servico", hoje.toISOString().split("T")[0]);

      (osAtrasadas || []).forEach((os) => {
        const cliente = os.cliente as any;
        const veiculo = os.veiculo as any;
        const dataServico = parseISO(os.data_servico);
        const diasAtraso = differenceInDays(hoje, dataServico);

        const severity: AlertSeverity = diasAtraso >= 3 ? "critical" : "warning";

        allAlerts.push({
          id: `overdue-${os.id}`,
          type: "overdue",
          severity,
          title: `OS Atrasada - ${os.tipo_servico}`,
          description: veiculo 
            ? `${veiculo.marca} ${veiculo.modelo} (${cliente?.nome || "Cliente"})`
            : cliente?.nome || "Cliente",
          time: diasAtraso === 1 ? "1 dia de atraso" : `${diasAtraso} dias de atraso`,
          referenceId: os.id,
          referenceType: "os",
        });
      });

      // ============================================
      // 4. GARANTIAS ATIVAS PRÓXIMAS DO VENCIMENTO
      // ============================================
      const { data: garantias } = await supabase
        .from("ordens_servico")
        .select(`
          id,
          tipo_servico,
          data_conclusao,
          dias_garantia,
          cliente:clientes (nome),
          veiculo:veiculos (marca, modelo, placa)
        `)
        .eq("oficina_id", oficinaAtual.id)
        .eq("status", "finalizado")
        .eq("tem_garantia", true)
        .not("data_conclusao", "is", null)
        .gt("dias_garantia", 0);

      (garantias || []).forEach((os) => {
        const cliente = os.cliente as any;
        const veiculo = os.veiculo as any;
        const dataConclusao = parseISO(os.data_conclusao!);
        const dataVencimento = addDays(dataConclusao, os.dias_garantia || 0);
        const diasRestantes = differenceInDays(dataVencimento, hoje);

        // Só alertar se estiver nos próximos 15 dias e ainda válida
        if (diasRestantes >= 0 && diasRestantes <= 15) {
          const severity: AlertSeverity = diasRestantes <= 5 ? "warning" : "info";

          allAlerts.push({
            id: `warranty-${os.id}`,
            type: "warranty",
            severity,
            title: `Garantia: ${os.tipo_servico}`,
            description: veiculo 
              ? `${veiculo.marca} ${veiculo.modelo} (${cliente?.nome || "Cliente"})`
              : cliente?.nome || "Cliente",
            time: diasRestantes === 0 ? "Vence hoje" : `${diasRestantes} dia(s) restantes`,
            referenceId: os.id,
            referenceType: "os",
          });
        }
      });

      // ============================================
      // 5. OS COM MARGEM CRÍTICA (últimos 7 dias)
      // ============================================
      const seteDiasAtras = addDays(hoje, -7).toISOString().split("T")[0];
      
      const { data: osFinalizadas } = await supabase
        .from("ordens_servico")
        .select(`
          id,
          tipo_servico,
          valor_servico,
          custo_servico,
          lucro,
          data_servico,
          cliente:clientes (nome),
          veiculo:veiculos (marca, modelo)
        `)
        .eq("oficina_id", oficinaAtual.id)
        .eq("status", "finalizado")
        .gte("data_servico", seteDiasAtras);

      (osFinalizadas || []).forEach((os) => {
        const cliente = os.cliente as any;
        const veiculo = os.veiculo as any;
        const valor = Number(os.valor_servico) || 0;
        const custo = Number(os.custo_servico) || 0;
        const lucro = Number(os.lucro) || (valor - custo);
        const margem = valor > 0 ? (lucro / valor) * 100 : 0;

        // Apenas alertar para prejuízo ou margem muito baixa
        if (lucro < 0) {
          allAlerts.push({
            id: `margin-crit-${os.id}`,
            type: "margin_critical",
            severity: "critical",
            title: `OS com Prejuízo: ${os.tipo_servico}`,
            description: `${veiculo?.marca || ""} ${veiculo?.modelo || ""} - Você pagou R$ ${Math.abs(lucro).toFixed(0)} para trabalhar`,
            time: "Crítico",
            referenceId: os.id,
            referenceType: "os",
            impactoFinanceiro: lucro,
          });
        } else if (margem < 15 && margem >= 0) {
          allAlerts.push({
            id: `margin-low-${os.id}`,
            type: "margin_low",
            severity: "warning",
            title: `Margem Baixa: ${os.tipo_servico}`,
            description: `${veiculo?.marca || ""} ${veiculo?.modelo || ""} - Margem de ${margem.toFixed(0)}%`,
            time: "Atenção",
            referenceId: os.id,
            referenceType: "os",
            impactoFinanceiro: lucro,
          });
        }
      });

      // ============================================
      // 6. DIAGNÓSTICO MAL COBRADO (baseado em custo vs valor)
      // ============================================
      // Regra alternativa: Se custo > 50% do valor, é diagnóstico desvalorizado
      // Isso funciona mesmo sem o campo tempo_diagnostico_minutos
      const CUSTO_MAXIMO_PERCENTUAL = 50; // custo não deve passar de 50% do valor

      (osFinalizadas || []).forEach((os) => {
        const veiculo = os.veiculo as any;
        const valor = Number(os.valor_servico) || 0;
        const custo = Number(os.custo_servico) || 0;
        
        // Só analisar se tiver valor e custo registrados
        if (valor > 0 && custo > 0) {
          const custoPercentual = (custo / valor) * 100;
          
          // Se o custo representa mais de 50% do valor, é alerta
          if (custoPercentual > CUSTO_MAXIMO_PERCENTUAL && valor < 200) {
            const margemReal = valor - custo;
            
            // Evita duplicar alertas de margem_critical/margem_low
            const jaTemAlerta = allAlerts.some(a => a.id.includes(os.id));
            
            if (!jaTemAlerta && margemReal > 0 && margemReal < 50) {
              allAlerts.push({
                id: `diag-undercharge-${os.id}`,
                type: "diagnostic_undercharged",
                severity: "warning",
                title: `⚡ Serviço subvalorizado`,
                description: `${veiculo?.marca || ""} ${veiculo?.modelo || ""} - Cobrou R$ ${valor.toFixed(0)}, lucro de apenas R$ ${margemReal.toFixed(0)}`,
                time: `${custoPercentual.toFixed(0)}% custo`,
                referenceId: os.id,
                referenceType: "os",
                impactoFinanceiro: -margemReal,
              });
            }
          }
        }
      });

      // ============================================
      // 7. PARCELAS ATRASADAS E VENCENDO HOJE
      // ============================================
      const { data: parcelasPendentes } = await supabase
        .from("parcelas_pagamento")
        .select(`
          id,
          numero_parcela,
          total_parcelas,
          valor,
          data_vencimento,
          status,
          ordem_servico:ordem_servico_id (
            tipo_servico,
            cliente:clientes (nome)
          ),
          orcamento:orcamento_id (
            titulo,
            cliente:clientes (nome)
          )
        `)
        .eq("oficina_id", oficinaAtual.id)
        .in("status", ["pendente", "atrasado"])
        .lte("data_vencimento", addDays(hoje, 7).toISOString().split("T")[0]);

      (parcelasPendentes || []).forEach((parcela) => {
        const os = parcela.ordem_servico as any;
        const orc = parcela.orcamento as any;
        const referencia = os?.tipo_servico || orc?.titulo || "Serviço";
        const cliente = os?.cliente?.nome || orc?.cliente?.nome || "Cliente";
        const dataVencimento = parseISO(parcela.data_vencimento);
        const diasRestantes = differenceInDays(dataVencimento, hoje);

        if (parcela.status === "atrasado" || diasRestantes < 0) {
          allAlerts.push({
            id: `parcela-atraso-${parcela.id}`,
            type: "parcela_atrasada",
            severity: "critical",
            title: `💰 Parcela ${parcela.numero_parcela}/${parcela.total_parcelas} atrasada`,
            description: `${referencia} - ${cliente} | R$ ${Number(parcela.valor).toFixed(2)}`,
            time: Math.abs(diasRestantes) === 1 ? "1 dia de atraso" : `${Math.abs(diasRestantes)} dias de atraso`,
            impactoFinanceiro: Number(parcela.valor),
          });
        } else if (diasRestantes === 0) {
          allAlerts.push({
            id: `parcela-hoje-${parcela.id}`,
            type: "parcela_vencendo",
            severity: "warning",
            title: `💰 Parcela ${parcela.numero_parcela}/${parcela.total_parcelas} vence hoje`,
            description: `${referencia} - ${cliente} | R$ ${Number(parcela.valor).toFixed(2)}`,
            time: "Vence hoje",
            impactoFinanceiro: Number(parcela.valor),
          });
        }
      });

      // ============================================
      // 8. ALERTA DE AUDITORIA LÓGICA V2 (Portão 8C)
      // ============================================
      if (FEATURE_FLAGS_V2.FINANCEIRO_V2_IGNORE_TEST_MANIFEST_ENABLED) {
        try {
          const inicio = format(startOfMonth(hoje), "yyyy-MM-dd");
          const fim = format(endOfMonth(hoje), "yyyy-MM-dd");
          const preview = await financeiroV2Service.getFinanceiroV2PreviewLimpeza(oficinaAtual.id, inicio, fim);
          
          if (preview.auditoria?.registros_ignorados_por_manifesto?.length > 0) {
            const count = preview.auditoria.registros_ignorados_por_manifesto.length;
            const faturamentoIgnorado = preview.auditoria.registros_ignorados_por_manifesto.reduce((sum, r) => sum + (r.valor_liquido || 0), 0);
            
            allAlerts.push({
              id: "audit-v2-clean",
              type: "audit_logic_clean",
              severity: "info",
              title: "Modo V2 Limpo Ativo",
              description: `${count} registros de teste ignorados por manifesto. Faturamento reduzido em R$ ${faturamentoIgnorado.toFixed(0)}. Nenhum dado real foi alterado.`,
              time: "Auditável",
            });
          }
        } catch (err) {
          console.error("[SmartAlerts] Erro ao buscar auditoria V2:", err);
        }
      }

      // Ordenar: críticos primeiro, depois warning, depois info
      const severityOrder: Record<AlertSeverity, number> = {
        critical: 0,
        warning: 1,
        info: 2,
      };

      return allAlerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    },
    enabled: !!oficinaAtual,
    staleTime: 2 * 60 * 1000, // 2 minutos
    refetchInterval: 5 * 60 * 1000, // Atualiza a cada 5 minutos
  });

  // Contadores por tipo
  const alertsByType = {
    critical: alerts.filter(a => a.severity === "critical").length,
    warning: alerts.filter(a => a.severity === "warning").length,
    info: alerts.filter(a => a.severity === "info").length,
    total: alerts.length,
  };

  // Impacto financeiro total dos alertas críticos
  const impactoFinanceiroTotal = alerts
    .filter(a => a.impactoFinanceiro !== undefined && a.impactoFinanceiro < 0)
    .reduce((sum, a) => sum + Math.abs(a.impactoFinanceiro!), 0);

  return {
    alerts,
    alertsByType,
    impactoFinanceiroTotal,
    isLoading,
    error,
    refetch,
  };
}
