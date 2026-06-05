import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";

export interface PreFiscalData {
  metrics: {
    caixa: {
      entradas: number;
      saidas: number;
      lucro_caixa: number;
    };
    competencia: {
      faturamento_bruto: number;
      descontos: number;
      faturamento_liquido: number;
      pecas_liquido: number;
      servicos_liquido: number;
      cmv: number;
      lucro_operacional: number;
      saldo_a_receber: number;
    };
  };
  analitico: {
    id: string;
    data_competencia: string;
    data_pagamento: string | null;
    tipo: "entrada" | "saida";
    origem: string;
    categoria: string;
    descricao: string | null;
    valor_bruto: number;
    desconto: number;
    valor_liquido: number;
    status: string;
    classificacao: string;
    numero_documento: string | null;
    ordem_servico_id: string | null;
    observacoes_contador: string | null;
    is_estimado: boolean;
  }[];
  ressalvas: {
    tem_ressalva: boolean;
    itens_sem_custo: number;
    impacto_estimado: number;
  };
}

export function useFinanceiroPreFiscalUnificado(start: string, end: string) {
  const { oficinaAtual } = useOficina();

  return useQuery({
    queryKey: ["financeiro-prefiscal-unificado", oficinaAtual?.id, start, end],
    queryFn: async () => {
      if (!oficinaAtual) return null;

      const { data, error } = await supabase.rpc("get_pre_fiscal_unificado", {
        p_oficina_id: oficinaAtual.id,
        p_inicio: start,
        p_fim: end,
      });

      if (error) throw error;
      return data as unknown as PreFiscalData;
    },
    enabled: !!oficinaAtual && !!start && !!end,
  });
}
