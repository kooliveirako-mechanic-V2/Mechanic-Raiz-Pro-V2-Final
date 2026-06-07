import { supabase } from "@/integrations/supabase/client";

export interface CategoryMetrics {
  bruto: number;
  liquido: number;
}

export interface UnifiedMetrics {
  periodo: {
    inicio: string;
    fim: string;
  };
  faturamento: {
    bruto: number;
    descontos: number;
    liquido: number;
    pecas?: number;
    servicos?: number;
    outros?: number;
  };
  categorias: {
    pecas: CategoryMetrics;
    servicos: CategoryMetrics;
    nao_classificado: CategoryMetrics;
  };
  caixa: {
    entradas_oficina_periodo: number;
    saidas_oficina_periodo: number;
    lucro_caixa_oficina_periodo: number;
    recebido_vinculado_competencia: number;
    saldo_a_receber_competencia: number;
  };
  operacional: {
    custo_pecas: number;
    lucro_operacional: number;
    despesas_fixas_variaveis?: number;
  };
  auditoria: {
    total_itens_livres: number;
    total_itens_livres_sem_custo: number;
    valor_itens_livres_sem_custo: number;
    vendas_balcao_sem_custo: number;
    os_com_divergencia: number;
    pagamentos_parciais: number;
    alerta_lucro_inflado: boolean;
  };
  acesso_negado: boolean;
}

/**
 * Hook para consumir a fonte única da verdade financeira.
 * Garante que Dashboard e Relatórios usem a mesma lógica centralizada.
 */
export async function getUnifiedMetrics(params: {
  oficinaId: string;
  inicio: string;
  fim: string;
}): Promise<UnifiedMetrics> {
  const { data, error } = await supabase.rpc("get_metrics_financeiras_unificadas", {
    p_oficina_id: params.oficinaId,
    p_data_inicio: params.inicio,
    p_data_fim: params.fim,
  });

  if (error) {
    console.error("[UnifiedMetrics] Erro ao buscar métricas:", error);
    // Retornamos um objeto seguro em vez de lançar erro para não quebrar o dashboard
    return {
      faturamento: { bruto: 0, liquido: 0, descontos: 0 },
      operacional: { lucro_operacional: 0, custo_pecas: 0 },
      caixa: { entradas_oficina_periodo: 0, saidas_oficina_periodo: 0, lucro_caixa_oficina_periodo: 0, recebido_vinculado_competencia: 0, saldo_a_receber_competencia: 0 },
      categorias: { 
        pecas: { bruto: 0, liquido: 0 }, 
        servicos: { bruto: 0, liquido: 0 },
        nao_classificado: { bruto: 0, liquido: 0 }
      },
      auditoria: { total_itens_livres: 0, total_itens_livres_sem_custo: 0, valor_itens_livres_sem_custo: 0, vendas_balcao_sem_custo: 0, os_com_divergencia: 0, pagamentos_parciais: 0, alerta_lucro_inflado: false },
      periodo: { inicio: params.inicio, fim: params.fim },
      acesso_negado: true
    } as UnifiedMetrics;
  }

  return (data || {}) as unknown as UnifiedMetrics;
}

export interface UnifiedRankings {
  clientes: Array<{
    id: string;
    nome: string;
    total_os: number;
    faturamento_total: number;
    custo_total: number;
    lucro_total: number;
    margem_media: number;
  }>;
  servicos: Array<{
    tipo_servico: string;
    total_os: number;
    faturamento_total: number;
    custo_total: number;
    lucro_total: number;
    margem_media: number;
  }>;
  margens_os: Array<{
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
    risco: "critico" | "baixo" | "saudavel" | "excelente";
  }>;
  geral: {
    total_os_analisadas: number;
    faturamento_geral: number;
    custo_geral: number;
    lucro_geral: number;
    margem_media_geral: number;
  };
}

export async function getUnifiedRankings(params: {
  oficinaId: string;
  inicio: string;
  fim: string;
}): Promise<UnifiedRankings> {
  const { data, error } = await supabase.rpc("get_financeiro_rankings_unificados", {
    p_oficina_id: params.oficinaId,
    p_data_inicio: params.inicio,
    p_data_fim: params.fim,
  });

  if (error) {
    console.error("[UnifiedRankings] Erro ao buscar rankings:", error);
    throw new Error(error.message || "Erro ao carregar rankings financeiros.");
  }

  return data as unknown as UnifiedRankings;
}

export interface UnifiedSeriesData {
  mes: string;
  label: string;
  faturamento_liquido: number;
  pecas_liquido: number;
  servicos_liquido: number;
  lucro_operacional: number;
  entradas_caixa: number;
  saidas_caixa: number;
  lucro_caixa: number;
}

export async function getUnifiedSeries(params: {
  oficinaId: string;
  inicio: string;
  fim: string;
}): Promise<UnifiedSeriesData[]> {
  const { data, error } = await supabase.rpc("get_financeiro_series_unificadas", {
    p_oficina_id: params.oficinaId,
    p_data_inicio: params.inicio,
    p_data_fim: params.fim,
  });

  if (error) {
    console.error("[UnifiedSeries] Erro ao buscar series:", error);
    throw new Error(error.message || "Erro ao carregar series financeiras.");
  }

  return data as unknown as UnifiedSeriesData[];
}
