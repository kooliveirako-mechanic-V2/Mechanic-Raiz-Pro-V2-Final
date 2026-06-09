import { supabase } from "@/integrations/supabase/client";
import { FEATURE_FLAGS_V2 } from "@/config/featureFlagsV2";
import { financeiroV2Service } from "./financeiroV2Service";

export interface UnifiedPreFiscalMetrics {
  periodo: {
    inicio: string;
    fim: string;
  };
  oficina: {
    id: string;
    nome: string;
  };
  competencia: {
    faturamentoBruto: number;
    descontos: number;
    faturamentoLiquido: number;
    osFinalizadas: number;
    vendasBalcaoConcluidas: number;
    pecasBruto: number;
    servicosBruto: number;
    vendaBalcaoBruto: number;
    saldoAReceber: number;
  };
  custos: {
    cmvOs: number;
    cmvBalcao: number;
    cmvTotal: number;
  };
  perdas: {
    total: number;
    retrabalho: number;
    garantia: number;
    sinistro: number;
    prejuizo: number;
  };
  caixa: {
    entradasPagas: number;
    saidasPagas: number;
    lucroCaixa: number;
  };
  despesas: {
    fixas: number;
    variaveis: number;
    comprasEstoque: number;
  };
  resultado: {
    lucroOperacional: number;
    resultadoLiquidoGerencial: number;
  };
  alertas: {
    itensSemCusto: number;
    vendasSemCusto: number;
    historicoComRessalva: boolean;
    categoriasNaoClassificadas: string[];
  };
  analitico: Array<{
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
  }>;
}

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
  // SELEÇÃO ATÔMICA PORTÃO 8C: Respeita flag de ignore test
  if (FEATURE_FLAGS_V2.FINANCEIRO_V2_IGNORE_TEST_MANIFEST_ENABLED) {
    const preview = await financeiroV2Service.getFinanceiroV2PreviewLimpeza(params.oficinaId, params.inicio, params.fim);
    
    return {
      periodo: preview.periodo,
      faturamento: {
        bruto: preview.competencia.faturamento_liquido, // Preview simplificado trata liq como base
        descontos: 0,
        liquido: preview.competencia.faturamento_liquido,
      },
      categorias: {
        pecas: { bruto: 0, liquido: 0 },
        servicos: { bruto: 0, liquido: 0 },
        nao_classificado: { bruto: 0, liquido: 0 }
      },
      caixa: {
        entradas_oficina_periodo: preview.caixa.entradas_pagas_no_periodo,
        saidas_oficina_periodo: preview.caixa.saidas_pagas_no_periodo,
        lucro_caixa_oficina_periodo: preview.caixa.saldo_caixa_periodo,
        recebido_vinculado_competencia: preview.competencia.recebido_vinculado_competencia,
        saldo_a_receber_competencia: preview.competencia.saldo_a_receber_competencia,
      },
      operacional: {
        custo_pecas: preview.custos.cmv_total,
        lucro_operacional: preview.resultado.lucro_operacional
      },
      auditoria: {
        total_itens_livres: 0,
        total_itens_livres_sem_custo: 0,
        valor_itens_livres_sem_custo: 0,
        vendas_balcao_sem_custo: 0,
        os_com_divergencia: 0,
        pagamentos_parciais: 0,
        alerta_lucro_inflado: false
      },
      acesso_negado: false,
      modo: "preview_limpeza_logica"
    } as any;
  }

  const { data, error } = await supabase.rpc("get_metrics_financeiras_unificadas", {
    p_oficina_id: params.oficinaId,
    p_data_inicio: params.inicio,
    p_data_fim: params.fim,
  });

  if (error) {
    console.error("[UnifiedMetrics] Erro ao buscar métricas:", error);
    throw new Error(`Erro ao carregar métricas financeiras: ${error.message}`);
  }

  if (!data) {
    throw new Error("RPC retornou dados vazios.");
  }

  const raw = data as any;

  // VALIDAÇÃO RÍGIDA DE CONTRATO
  // Se campos obrigatórios estiverem ausentes, lançamos erro para evitar "zero falso"
  const requiredFields = [
    { path: 'competencia.faturamento_liquido', value: raw.competencia?.faturamento_liquido },
    { path: 'operacional.lucro_operacional', value: raw.operacional?.lucro_operacional },
    { path: 'custos.cmv_total', value: raw.custos?.cmv_total },
    { path: 'caixa.lucro_caixa_oficina_periodo', value: raw.caixa?.lucro_caixa_oficina_periodo }
  ];

  const missingFields = requiredFields
    .filter(f => f.value === undefined || f.value === null)
    .map(f => f.path);

  if (missingFields.length > 0) {
    console.error("[UnifiedMetrics] Quebra de contrato RPC detectada. Campos ausentes:", missingFields);
    throw new Error(`Contrato financeiro incompleto. Campos ausentes: ${missingFields.join(', ')}`);
  }

  // Mapeamento explícito sem defaults mascaradores
  return {
    periodo: {
      inicio: raw.periodo?.inicio || params.inicio,
      fim: raw.periodo?.fim || params.fim
    },
    faturamento: {
      bruto: raw.competencia.faturamento_bruto,
      descontos: raw.competencia.descontos,
      liquido: raw.competencia.faturamento_liquido,
      pecas: raw.competencia.pecas_bruto,
      servicos: raw.competencia.servicos_bruto
    },
    categorias: {
      pecas: { bruto: raw.competencia.pecas_bruto || 0, liquido: raw.competencia.pecas_bruto || 0 },
      servicos: { bruto: raw.competencia.servicos_bruto || 0, liquido: raw.competencia.servicos_bruto || 0 },
      nao_classificado: { bruto: 0, liquido: 0 }
    },
    caixa: {
      entradas_oficina_periodo: raw.caixa.entradas_pagas,
      saidas_oficina_periodo: raw.caixa.saidas_pagas,
      lucro_caixa_oficina_periodo: raw.caixa.lucro_caixa_oficina_periodo,
      recebido_vinculado_competencia: raw.caixa.recebido_vinculado_competencia,
      saldo_a_receber_competencia: raw.competencia.saldo_a_receber
    },
    operacional: {
      custo_pecas: raw.custos.cmv_total,
      lucro_operacional: raw.operacional.lucro_operacional
    },
    auditoria: {
      total_itens_livres: raw.auditoria?.total_itens_livres || 0,
      total_itens_livres_sem_custo: raw.auditoria?.total_itens_livres_sem_custo || 0,
      valor_itens_livres_sem_custo: raw.auditoria?.valor_itens_livres_sem_custo || 0,
      vendas_balcao_sem_custo: raw.auditoria?.vendas_balcao_sem_custo || 0,
      os_com_divergencia: raw.auditoria?.os_com_divergencia || 0,
      pagamentos_parciais: raw.auditoria?.pagamentos_parciais || 0,
      alerta_lucro_inflado: raw.auditoria?.alerta_lucro_inflado || false
    },
    acesso_negado: false,
    // Preservar campos extras para o hook (como perdas_operacionais)
    ...raw
  } as UnifiedMetrics;
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

export async function getUnifiedPreFiscal(params: {
  oficinaId: string;
  inicio: string;
  fim: string;
}): Promise<UnifiedPreFiscalMetrics> {
  // SELEÇÃO ATÔMICA PORTÃO 8C: Respeita flag de ignore test
  if (FEATURE_FLAGS_V2.FINANCEIRO_V2_IGNORE_TEST_MANIFEST_ENABLED) {
    const preview = await financeiroV2Service.getFinanceiroV2PreviewLimpeza(params.oficinaId, params.inicio, params.fim);
    
    return {
      periodo: preview.periodo,
      oficina: preview.oficina,
      competencia: {
        faturamentoBruto: preview.competencia.faturamento_liquido,
        descontos: 0,
        faturamentoLiquido: preview.competencia.faturamento_liquido,
        osFinalizadas: preview.contadores.servicos_finalizados,
        vendasBalcaoConcluidas: preview.contadores.vendas_balcao,
        pecasBruto: 0,
        servicosBruto: 0,
        vendaBalcaoBruto: 0,
        saldoAReceber: preview.competencia.saldo_a_receber_competencia,
      },
      custos: {
        cmvOs: 0,
        cmvBalcao: 0,
        cmvTotal: preview.custos.cmv_total,
      },
      perdas: { total: 0, retrabalho: 0, garantia: 0, sinistro: 0, prejuizo: 0 },
      caixa: {
        entradasPagas: preview.caixa.entradas_pagas_no_periodo,
        saidasPagas: preview.caixa.saidas_pagas_no_periodo,
        lucroCaixa: preview.caixa.saldo_caixa_periodo,
      },
      despesas: { fixas: 0, variaveis: 0, comprasEstoque: 0 },
      resultado: {
        lucroOperacional: preview.resultado.lucro_operacional,
        resultadoLiquidoGerencial: preview.resultado.lucro_operacional,
      },
      alertas: {
        itensSemCusto: 0,
        vendasSemCusto: 0,
        historicoComRessalva: false,
        categoriasNaoClassificadas: [],
      },
      analitico: [], // No preview lógico não retornamos analítico completo por performance
      modo: "preview_limpeza_logica",
      auditoria: preview.auditoria
    } as any;
  }

  const { data, error } = await supabase.rpc("get_pre_fiscal_unificado", {
    p_oficina_id: params.oficinaId,
    p_inicio: params.inicio,
    p_fim: params.fim,
  });

  if (error) {
    console.error("[UnifiedPreFiscal] Erro ao buscar pré-fiscal:", error);
    throw new Error(error.message || "Erro ao carregar dados pré-fiscais.");
  }

  return data as unknown as UnifiedPreFiscalMetrics;
}
