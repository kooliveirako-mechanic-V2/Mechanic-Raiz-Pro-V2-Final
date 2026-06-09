import { useQuery } from "@tanstack/react-query";
import { useOficina } from "@/contexts/OficinaContext";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { getUnifiedRankings } from "@/services/financeiroService";

// Thresholds de margem (configuráveis)
const MARGEM_BAIXA = 15;
const MARGEM_SAUDAVEL = 30;

function classificarCliente(margem: number, lucro: number) {
  if (lucro < 0) return "prejuizo";
  if (margem < MARGEM_BAIXA) return "margem_baixa";
  if (margem >= MARGEM_SAUDAVEL) return "vip";
  return "lucrativo";
}

function gerarVeredictoCliente(classificacao: string, margem: number): string {
  switch (classificacao) {
    case "prejuizo":
      return "⚠️ Cliente dá prejuízo. Revisar preços ou descontinuar.";
    case "margem_baixa":
      return `📉 Margem de ${margem.toFixed(1)}% é baixa. Renegociar valores.`;
    case "lucrativo":
      return "✓ Cliente saudável. Manter relacionamento.";
    case "vip":
      return "🌟 TOP Cliente. Priorizar atendimento.";
    default:
      return "";
  }
}

export function useProfitIndicators() {
  const { oficinaAtual } = useOficina();

  const { data: rankings, isLoading, error } = useQuery({
    queryKey: ["profitIndicators-unified", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return null;

      const inicioMes = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const fimMes = format(endOfMonth(new Date()), "yyyy-MM-dd");

      return await getUnifiedRankings({
        oficinaId: oficinaAtual.id,
        inicio: inicioMes,
        fim: fimMes,
      });
    },
    enabled: !!oficinaAtual,
    staleTime: 5 * 60 * 1000,
  });

  const processedData = rankings ? {
    margemMediaGeral: rankings.geral.margem_media_geral,
    totalOSAnalisadas: rankings.geral.total_os_analisadas,
    osComPrejuizo: rankings.servicos.filter(s => s.lucro_total < 0).length,
    osComMargemBaixa: rankings.servicos.filter(s => s.margem_media < MARGEM_BAIXA && s.lucro_total >= 0).length,
    margensOS: rankings.margens_os || [],
    lucroPorTipo: (rankings.servicos || []).map(s => ({
      tipo_servico: s.tipo_servico,
      total_os: s.total_os,
      faturamento_total: s.faturamento_total,
      custo_total: s.custo_total,
      lucro_total: s.lucro_total,
      margem_media: s.margem_media,
      alerta: s.lucro_total < 0 ? "prejuizo" : s.margem_media < MARGEM_BAIXA ? "margem_baixa" : "ok",
      movimento_alto_lucro_baixo: s.total_os > 5 && s.margem_media < MARGEM_BAIXA
    })),
    clientesRentabilidade: (rankings.clientes || []).map(c => {
      const classif = classificarCliente(c.margem_media, c.lucro_total);
      return {
        id: c.id,
        nome: c.nome,
        total_os: c.total_os,
        faturamento_total: c.faturamento_total,
        lucro_total: c.lucro_total,
        margem_media: c.margem_media,
        ticket_medio: c.total_os > 0 ? c.faturamento_total / c.total_os : 0,
        classificacao: classif,
        veredicto: gerarVeredictoCliente(classif, c.margem_media)
      };
    }),
    servicosProblematicos: (rankings.servicos || [])
      .filter(s => s.lucro_total < 0 || s.margem_media < MARGEM_BAIXA)
      .map(s => ({
        tipo_servico: s.tipo_servico,
        motivo: s.lucro_total < 0 ? "Dá prejuízo em cada OS executada" : "Margem abaixo do aceitável",
        total_os: s.total_os,
        faturamento: s.faturamento_total,
        prejuizo_ou_margem_baixa: s.lucro_total,
        recomendacao: s.lucro_total < 0 ? "Revisar custos ou parar de oferecer" : "Aumentar preço ou otimizar processo"
      })),
    alertasCriticos: rankings.geral.lucro_geral < 0 ? [{
      tipo: "os_prejuizo",
      mensagem: "Operação geral com prejuízo este mês.",
      impacto: Math.abs(rankings.geral.lucro_geral)
    }] : []
  } : {
    margemMediaGeral: 0,
    totalOSAnalisadas: 0,
    osComPrejuizo: 0,
    osComMargemBaixa: 0,
    margensOS: [],
    lucroPorTipo: [],
    clientesRentabilidade: [],
    servicosProblematicos: [],
    alertasCriticos: []
  };

  return {
    indicators: processedData,
    isLoading,
    error,
  };
}