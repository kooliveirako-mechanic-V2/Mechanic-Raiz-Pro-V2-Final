import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { startOfMonth, endOfMonth, format, subMonths } from "date-fns";

// ============================================
// MODO GUERRA PRO - INDICADORES DE LUCRO REAL
// ============================================
// Este hook expõe a VERDADE da operação:
// - Margem por OS
// - Lucro por tipo de serviço
// - Cliente lucrativo vs prejuízo
// - Serviço que dá movimento e mata lucro

export interface MargemOS {
  id: string;
  tipo_servico: string;
  cliente_nome: string;
  veiculo_info: string;
  valor_servico: number;
  custo_servico: number;
  lucro: number;
  margem_percentual: number;
  data_servico: string;
  status: string;
  // Classificação de risco
  risco: "critico" | "baixo" | "saudavel" | "excelente";
}

export interface LucroPorTipoServico {
  tipo_servico: string;
  total_os: number;
  faturamento_total: number;
  custo_total: number;
  lucro_total: number;
  margem_media: number;
  // Indicador de alerta
  alerta: "prejuizo" | "margem_baixa" | "ok" | "top_performer";
  // Tendência
  movimento_alto_lucro_baixo: boolean;
}

export interface ClienteRentabilidade {
  id: string;
  nome: string;
  telefone: string | null;
  total_os: number;
  faturamento_total: number;
  custo_total: number;
  lucro_total: number;
  margem_media: number;
  ticket_medio: number;
  // Classificação
  classificacao: "prejuizo" | "margem_baixa" | "lucrativo" | "vip";
  // Veredicto
  veredicto: string;
}

export interface ServicoProblematico {
  tipo_servico: string;
  motivo: string;
  total_os: number;
  faturamento: number;
  prejuizo_ou_margem_baixa: number;
  recomendacao: string;
}

export interface ProfitIndicators {
  // Métricas gerais
  margemMediaGeral: number;
  totalOSAnalisadas: number;
  osComPrejuizo: number;
  osComMargemBaixa: number;
  
  // Detalhamento
  margensOS: MargemOS[];
  lucroPorTipo: LucroPorTipoServico[];
  clientesRentabilidade: ClienteRentabilidade[];
  servicosProblematicos: ServicoProblematico[];
  
  // Alertas críticos
  alertasCriticos: {
    tipo: string;
    mensagem: string;
    impacto: number;
  }[];
}

// Thresholds de margem (configuráveis)
const MARGEM_CRITICA = 0; // 0% ou menos = prejuízo
const MARGEM_BAIXA = 15; // abaixo de 15% = margem baixa
const MARGEM_SAUDAVEL = 30; // acima de 30% = saudável
const MARGEM_EXCELENTE = 50; // acima de 50% = excelente

function classificarRiscoOS(margem: number): MargemOS["risco"] {
  if (margem <= MARGEM_CRITICA) return "critico";
  if (margem < MARGEM_BAIXA) return "baixo";
  if (margem < MARGEM_EXCELENTE) return "saudavel";
  return "excelente";
}

function classificarTipoServico(margem: number, movimento_alto: boolean): LucroPorTipoServico["alerta"] {
  if (margem <= MARGEM_CRITICA) return "prejuizo";
  if (margem < MARGEM_BAIXA || movimento_alto) return "margem_baixa";
  if (margem >= MARGEM_SAUDAVEL) return "top_performer";
  return "ok";
}

function classificarCliente(margem: number, lucro: number): ClienteRentabilidade["classificacao"] {
  if (lucro < 0) return "prejuizo";
  if (margem < MARGEM_BAIXA) return "margem_baixa";
  if (margem >= MARGEM_SAUDAVEL) return "vip";
  return "lucrativo";
}

function gerarVeredictoCliente(classificacao: ClienteRentabilidade["classificacao"], margem: number): string {
  switch (classificacao) {
    case "prejuizo":
      return "⚠️ Cliente dá prejuízo. Revisar preços ou descontinuar.";
    case "margem_baixa":
      return `📉 Margem de ${margem.toFixed(1)}% é baixa. Renegociar valores.`;
    case "lucrativo":
      return "✓ Cliente saudável. Manter relacionamento.";
    case "vip":
      return "🌟 TOP Cliente. Priorizar atendimento.";
  }
}

export function useProfitIndicators() {
  const { oficinaAtual } = useOficina();

  const { data: indicators, isLoading, error } = useQuery({
    queryKey: ["profitIndicators", oficinaAtual?.id],
    queryFn: async (): Promise<ProfitIndicators> => {
      if (!oficinaAtual) {
        return {
          margemMediaGeral: 0,
          totalOSAnalisadas: 0,
          osComPrejuizo: 0,
          osComMargemBaixa: 0,
          margensOS: [],
          lucroPorTipo: [],
          clientesRentabilidade: [],
          servicosProblematicos: [],
          alertasCriticos: [],
        };
      }

      const inicioMes = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const fimMes = format(endOfMonth(new Date()), "yyyy-MM-dd");

      // Buscar todas as OS finalizadas do mês com dados completos
      const { data: ordensServico, error: osError } = await supabase
        .from("ordens_servico")
        .select(`
          id,
          tipo_servico,
          valor_servico,
          custo_servico,
          lucro,
          data_servico,
          status,
          cliente_id,
          cliente:clientes(id, nome, telefone),
          veiculo:veiculos(id, marca, modelo, placa),
          itens_os(valor_total, quantidade, valor_unitario, estoque_id, estoque:estoque_id(custo_unitario))
        `)
        .eq("oficina_id", oficinaAtual.id)
        .eq("status", "finalizado")
        .gte("data_servico", inicioMes)
        .lte("data_servico", fimMes);

      if (osError) throw osError;

      const ordens = ordensServico || [];
      
      // ============================================
      // 1. MARGEM POR OS
      // ============================================
      const margensOS: MargemOS[] = ordens.map((os) => {
        const itensOS = (os as any).itens_os || [];
        const totalItens = itensOS.reduce((acc: number, item: any) => 
          acc + (item.valor_total ?? ((item.quantidade || 0) * (item.valor_unitario || 0))), 0);
        // CAUSA RAIZ: valor_servico JÁ inclui itens (via recalcOSTotals). Usar fallback apenas.
        const valor = (Number(os.valor_servico) || 0) > 0 ? (Number(os.valor_servico) || 0) : totalItens;
        const custoItens = itensOS.reduce((acc: number, item: any) => {
          if (!item.estoque_id) return acc;
          const custoUnit = item.estoque?.custo_unitario || 0;
          return acc + (custoUnit * (item.quantidade || 1));
        }, 0);
        const custo = custoItens > 0 ? custoItens : (Number(os.custo_servico) || 0);
        const lucro = valor - custo;
        const margem = valor > 0 ? (lucro / valor) * 100 : 0;
        
        const cliente = os.cliente as any;
        const veiculo = os.veiculo as any;
        
        return {
          id: os.id,
          tipo_servico: os.tipo_servico,
          cliente_nome: cliente?.nome || "Cliente não identificado",
          veiculo_info: veiculo ? `${veiculo.marca} ${veiculo.modelo} - ${veiculo.placa || "S/P"}` : "Veículo não identificado",
          valor_servico: valor,
          custo_servico: custo,
          lucro,
          margem_percentual: margem,
          data_servico: os.data_servico,
          status: os.status,
          risco: classificarRiscoOS(margem),
        };
      }).sort((a, b) => a.margem_percentual - b.margem_percentual); // Piores primeiro

      // ============================================
      // 2. LUCRO POR TIPO DE SERVIÇO
      // ============================================
      const tipoServicoMap = new Map<string, {
        total_os: number;
        faturamento: number;
        custo: number;
        lucro: number;
      }>();

      ordens.forEach((os) => {
        const tipo = os.tipo_servico || "Outros";
        const itensOS = (os as any).itens_os || [];
        const totalItens = itensOS.reduce((acc: number, item: any) => 
          acc + (item.valor_total ?? ((item.quantidade || 0) * (item.valor_unitario || 0))), 0);
        // CAUSA RAIZ: valor_servico JÁ inclui itens (via recalcOSTotals). Usar fallback apenas.
        const valor = (Number(os.valor_servico) || 0) > 0 ? (Number(os.valor_servico) || 0) : totalItens;
        const custoItens = itensOS.reduce((acc: number, item: any) => {
          if (!item.estoque_id) return acc;
          return acc + ((item.estoque?.custo_unitario || 0) * (item.quantidade || 1));
        }, 0);
        const custo = custoItens > 0 ? custoItens : (Number(os.custo_servico) || 0);
        const lucro = valor - custo;

        const current = tipoServicoMap.get(tipo) || { total_os: 0, faturamento: 0, custo: 0, lucro: 0 };
        tipoServicoMap.set(tipo, {
          total_os: current.total_os + 1,
          faturamento: current.faturamento + valor,
          custo: current.custo + custo,
          lucro: current.lucro + lucro,
        });
      });

      const mediaGeralOS = ordens.length > 0 ? ordens.length / tipoServicoMap.size : 0;

      const lucroPorTipo: LucroPorTipoServico[] = Array.from(tipoServicoMap.entries())
        .map(([tipo, dados]) => {
          const margem = dados.faturamento > 0 ? (dados.lucro / dados.faturamento) * 100 : 0;
          // "Movimento alto, lucro baixo" = muitas OS mas margem ruim
          const movimento_alto_lucro_baixo = dados.total_os >= mediaGeralOS && margem < MARGEM_BAIXA;
          
          return {
            tipo_servico: tipo,
            total_os: dados.total_os,
            faturamento_total: dados.faturamento,
            custo_total: dados.custo,
            lucro_total: dados.lucro,
            margem_media: margem,
            alerta: classificarTipoServico(margem, movimento_alto_lucro_baixo),
            movimento_alto_lucro_baixo,
          };
        })
        .sort((a, b) => a.margem_media - b.margem_media); // Piores primeiro

      // ============================================
      // 3. CLIENTE LUCRATIVO VS PREJUÍZO
      // ============================================
      const clienteMap = new Map<string, {
        id: string;
        nome: string;
        telefone: string | null;
        total_os: number;
        faturamento: number;
        custo: number;
        lucro: number;
      }>();

      ordens.forEach((os) => {
        const cliente = os.cliente as any;
        if (!cliente?.id) return;

        const itensOS = (os as any).itens_os || [];
        const totalItens = itensOS.reduce((acc: number, item: any) => 
          acc + (item.valor_total ?? ((item.quantidade || 0) * (item.valor_unitario || 0))), 0);
        // CAUSA RAIZ: valor_servico JÁ inclui itens (via recalcOSTotals). Usar fallback apenas.
        const valor = (Number(os.valor_servico) || 0) > 0 ? (Number(os.valor_servico) || 0) : totalItens;
        const custoItens = itensOS.reduce((acc: number, item: any) => {
          if (!item.estoque_id) return acc;
          return acc + ((item.estoque?.custo_unitario || 0) * (item.quantidade || 1));
        }, 0);
        const custo = custoItens > 0 ? custoItens : (Number(os.custo_servico) || 0);
        const lucro = valor - custo;

        const current = clienteMap.get(cliente.id) || {
          id: cliente.id,
          nome: cliente.nome || "Cliente",
          telefone: cliente.telefone,
          total_os: 0,
          faturamento: 0,
          custo: 0,
          lucro: 0,
        };

        clienteMap.set(cliente.id, {
          ...current,
          total_os: current.total_os + 1,
          faturamento: current.faturamento + valor,
          custo: current.custo + custo,
          lucro: current.lucro + lucro,
        });
      });

      const clientesRentabilidade: ClienteRentabilidade[] = Array.from(clienteMap.values())
        .map((cliente) => {
          const margem = cliente.faturamento > 0 ? (cliente.lucro / cliente.faturamento) * 100 : 0;
          const ticket_medio = cliente.total_os > 0 ? cliente.faturamento / cliente.total_os : 0;
          const classificacao = classificarCliente(margem, cliente.lucro);
          
          return {
            id: cliente.id,
            nome: cliente.nome,
            telefone: cliente.telefone,
            total_os: cliente.total_os,
            faturamento_total: cliente.faturamento,
            custo_total: cliente.custo,
            lucro_total: cliente.lucro,
            margem_media: margem,
            ticket_medio,
            classificacao,
            veredicto: gerarVeredictoCliente(classificacao, margem),
          };
        })
        .sort((a, b) => a.lucro_total - b.lucro_total); // Piores primeiro

      // ============================================
      // 4. SERVIÇOS PROBLEMÁTICOS
      // ============================================
      const servicosProblematicos: ServicoProblematico[] = lucroPorTipo
        .filter((s) => s.alerta === "prejuizo" || s.alerta === "margem_baixa")
        .map((s) => {
          let motivo = "";
          let recomendacao = "";
          
          if (s.alerta === "prejuizo") {
            motivo = "Dá prejuízo em cada OS executada";
            recomendacao = "Revisar custos ou parar de oferecer este serviço";
          } else if (s.movimento_alto_lucro_baixo) {
            motivo = "Alto volume, mas margem baixa. Trabalho demais, lucro de menos.";
            recomendacao = "Aumentar preço ou otimizar processo para reduzir tempo";
          } else {
            motivo = `Margem de ${s.margem_media.toFixed(1)}% está abaixo do aceitável`;
            recomendacao = "Revisar precificação ou negociar com fornecedores";
          }

          return {
            tipo_servico: s.tipo_servico,
            motivo,
            total_os: s.total_os,
            faturamento: s.faturamento_total,
            prejuizo_ou_margem_baixa: s.lucro_total,
            recomendacao,
          };
        });

      // ============================================
      // 5. ALERTAS CRÍTICOS
      // ============================================
      const alertasCriticos: ProfitIndicators["alertasCriticos"] = [];

      // Alerta: OS com prejuízo
      const osComPrejuizo = margensOS.filter((m) => m.risco === "critico").length;
      if (osComPrejuizo > 0) {
        const prejuizoTotal = margensOS
          .filter((m) => m.risco === "critico")
          .reduce((sum, m) => sum + Math.abs(m.lucro), 0);
        
        alertasCriticos.push({
          tipo: "os_prejuizo",
          mensagem: `${osComPrejuizo} OS com prejuízo este mês. Você está pagando para trabalhar.`,
          impacto: prejuizoTotal,
        });
      }

      // Alerta: Serviços problemáticos
      if (servicosProblematicos.length > 0) {
        const impactoTotal = servicosProblematicos
          .filter((s) => s.prejuizo_ou_margem_baixa < 0)
          .reduce((sum, s) => sum + Math.abs(s.prejuizo_ou_margem_baixa), 0);
        
        alertasCriticos.push({
          tipo: "servico_problematico",
          mensagem: `${servicosProblematicos.length} tipo(s) de serviço com margem crítica.`,
          impacto: impactoTotal,
        });
      }

      // Alerta: Clientes com prejuízo
      const clientesPrejuizo = clientesRentabilidade.filter((c) => c.classificacao === "prejuizo");
      if (clientesPrejuizo.length > 0) {
        const prejuizoClientes = clientesPrejuizo.reduce((sum, c) => sum + Math.abs(c.lucro_total), 0);
        
        alertasCriticos.push({
          tipo: "cliente_prejuizo",
          mensagem: `${clientesPrejuizo.length} cliente(s) dão prejuízo. Revise esses relacionamentos.`,
          impacto: prejuizoClientes,
        });
      }

      // Calcular métricas gerais
      const totalFaturamento = margensOS.reduce((sum, m) => sum + m.valor_servico, 0);
      const totalLucro = margensOS.reduce((sum, m) => sum + m.lucro, 0);
      const margemMediaGeral = totalFaturamento > 0 ? (totalLucro / totalFaturamento) * 100 : 0;
      const osComMargemBaixa = margensOS.filter((m) => m.risco === "baixo").length;

      return {
        margemMediaGeral,
        totalOSAnalisadas: ordens.length,
        osComPrejuizo,
        osComMargemBaixa,
        margensOS,
        lucroPorTipo,
        clientesRentabilidade,
        servicosProblematicos,
        alertasCriticos,
      };
    },
    enabled: !!oficinaAtual,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  return {
    indicators: indicators || {
      margemMediaGeral: 0,
      totalOSAnalisadas: 0,
      osComPrejuizo: 0,
      osComMargemBaixa: 0,
      margensOS: [],
      lucroPorTipo: [],
      clientesRentabilidade: [],
      servicosProblematicos: [],
      alertasCriticos: [],
    },
    isLoading,
    error,
  };
}
