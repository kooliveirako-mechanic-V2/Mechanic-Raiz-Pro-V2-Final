import { supabase } from "@/integrations/supabase/client";
import { FEATURE_FLAGS_V2 } from "@/config/featureFlagsV2";

/**
 * CONTRATO FINANCEIRO V2 - CENTRALIZADO
 * Este service é a única fonte da verdade para dados financeiros.
 * Proibido aplicar zero falso (|| 0) em campos obrigatórios.
 * Proibido criar aliases paralelos para CMV.
 */

export interface FinanceiroV2RegistroOS {
  id: string;
  numero: number;
  status: string;
  valor_servico: number;
  valor_itens: number;
  desconto: number;
  valor_bruto: number;
  valor_liquido: number;
  cmv: number;
  lucro: number;
  pago: boolean;
  valor_pago: number;
  saldo_a_receber: number;
  data_competencia_usada: string;
  campo_data_usado: string;
  incluido_no_faturamento: boolean;
  incluido_no_caixa: boolean;
  is_teste: boolean;
  criterio_teste: string;
}

export interface FinanceiroV2RegistroVenda {
  id: string;
  numero: number;
  status: string;
  valor_bruto: number;
  desconto: number;
  valor_liquido: number;
  cmv: number;
  lucro: number;
  pago: boolean;
  valor_pago: number;
  saldo_a_receber: number;
  data_competencia_usada: string;
  campo_data_usado: string;
  incluido_no_faturamento: boolean;
  incluido_no_caixa: boolean;
  is_teste: boolean;
  criterio_teste: string;
}

export interface FinanceiroV2RegistroFinanceiro {
  id: string;
  tipo: string;
  status: string;
  valor: number;
  origem: string;
  ordem_servico_id: string | null;
  venda_balcao_id: string | null;
  data_pagamento: string;
  incluido_no_caixa: boolean;
  motivo: string;
}

export interface FinanceiroV2Response {
  periodo: {
    inicio: string;
    fim: string;
  };
  oficina: {
    id: string;
    nome: string;
  };
  competencia: {
    faturamento_liquido: number;
    os_liquido: number;
    vendas_balcao_liquido: number;
    recebido_vinculado_competencia: number;
    saldo_a_receber_competencia: number;
  };
  custos: {
    cmv_total: number;
  };
  resultado: {
    lucro_operacional: number;
  };
  caixa: {
    entradas_pagas_no_periodo: number;
    saidas_pagas_no_periodo: number;
    saldo_caixa_periodo: number;
  };
  contadores: {
    servicos_finalizados: number;
    vendas_balcao: number;
  };
  auditoria: {
    registros_os: FinanceiroV2RegistroOS[];
    registros_vendas: FinanceiroV2RegistroVenda[];
    registros_financeiro: FinanceiroV2RegistroFinanceiro[];
    registros_com_data_invalida: any[];
    registros_cancelados: any[];
    avisos: string[];
  };
}

export interface FinanceiroV2PreviewLimpezaResponse extends FinanceiroV2Response {
  modo: "preview_limpeza_logica";
  dados_alterados: false;
  auditoria: {
    registros_os: FinanceiroV2RegistroOS[];
    registros_vendas: FinanceiroV2RegistroVenda[];
    registros_financeiro: FinanceiroV2RegistroFinanceiro[];
    registros_com_data_invalida: any[];
    registros_cancelados: any[];
    registros_ignorados_por_manifesto: Array<{
      tipo: string;
      numero: number;
      id: string;
      valor_liquido: number;
      cmv: number;
      lucro: number;
      pago: boolean;
      caixa_ignorado: number;
      saldo_a_receber_ignorado: number;
      motivo: string;
    }>;
    avisos: string[];
  };
}

/**
 * Validação Rígida do Contrato Financeiro V2
 */
function validateFinanceiroV2Contract(raw: any): void {
  const requiredPaths = [
    'periodo.inicio',
    'periodo.fim',
    'competencia.faturamento_liquido',
    'competencia.recebido_vinculado_competencia',
    'competencia.saldo_a_receber_competencia',
    'custos.cmv_total',
    'resultado.lucro_operacional',
    'caixa.entradas_pagas_no_periodo',
    'caixa.saidas_pagas_no_periodo',
    'caixa.saldo_caixa_periodo',
    'auditoria.avisos'
  ];

  for (const path of requiredPaths) {
    const parts = path.split('.');
    let current = raw;
    for (const part of parts) {
      if (current === undefined || current === null) {
        throw new Error(`Contrato Financeiro V2 inválido: campo ausente ou nulo [${path}]`);
      }
      current = current[part];
    }
    
    // Validar tipos numéricos críticos
    if (['faturamento_liquido', 'cmv_total', 'lucro_operacional', 'saldo_caixa_periodo'].some(s => path.includes(s))) {
      if (typeof current !== 'number') {
        throw new Error(`Contrato Financeiro V2 inválido: campo [${path}] deve ser um número, recebeu [${typeof current}]`);
      }
    }
  }
}

export interface FinanceiroV2SeriesItem {
  mes: string;
  inicio: string;
  fim: string;
  competencia: {
    faturamento_liquido: number;
    os_liquido: number;
    vendas_balcao_liquido: number;
    recebido_vinculado_competencia: number;
    saldo_a_receber_competencia: number;
  };
  custos: {
    cmv_total: number;
  };
  resultado: {
    lucro_operacional: number;
  };
  caixa: {
    entradas_pagas_no_periodo: number;
    saidas_pagas_no_periodo: number;
    saldo_caixa_periodo: number;
  };
  contadores: {
    servicos_finalizados: number;
    vendas_balcao: number;
  };
}

export interface FinanceiroV2SeriesResponse {
  periodo: { inicio: string; fim: string };
  oficina: { id: string; nome: string };
  series: FinanceiroV2SeriesItem[];
  auditoria: { avisos: string[] };
}

export const financeiroV2Service = {
  /**
   * Chamada atômica: decide entre V2 contaminado e V2 limpo via Feature Flag
   */
  async getMetrics(oficinaId: string, dataInicio: string, dataFim: string): Promise<FinanceiroV2Response> {
    if (FEATURE_FLAGS_V2.FINANCEIRO_V2_IGNORE_TEST_MANIFEST_ENABLED) {
      return this.getFinanceiroV2PreviewLimpeza(oficinaId, dataInicio, dataFim);
    }

    console.log(`[FinanceiroV2] Chamando RPC get_financeiro_v2 (MODO CONTAMINADO) para oficina ${oficinaId}`);
    const { data, error } = await supabase.rpc('get_financeiro_v2', {
      p_oficina_id: oficinaId,
      p_data_inicio: dataInicio,
      p_data_fim: dataFim
    });

    if (error) {
      console.error('[FinanceiroV2] Erro técnico na RPC:', error);
      throw new Error(`Erro técnico ao buscar financeiro V2: ${error.message}`);
    }

    if (!data) throw new Error('Contrato Financeiro V2 inválido: data nula');
    validateFinanceiroV2Contract(data);
    return data as unknown as FinanceiroV2Response;
  },

  /**
   * PORTÃO 8C: Busca o Preview Limpo Lógico (Sem alteração de dados)
   */
  async getFinanceiroV2PreviewLimpeza(oficinaId: string, dataInicio: string, dataFim: string): Promise<FinanceiroV2PreviewLimpezaResponse> {
    console.log(`[FinanceiroV2] Chamando RPC get_financeiro_v2_preview_limpeza (MODO LIMPO) para oficina ${oficinaId}`);

    const { data, error } = await supabase.rpc('get_financeiro_v2_preview_limpeza', {
      p_oficina_id: oficinaId,
      p_data_inicio: dataInicio,
      p_data_fim: dataFim
    });

    if (error) {
      console.error('[FinanceiroV2] Erro na RPC de preview limpeza:', error);
      throw new Error(`Erro técnico ao buscar preview de limpeza V2: ${error.message}`);
    }

    const response = data as any;

    if (!response) throw new Error('Contrato Financeiro V2 Limpo inválido: data nula');
    if (response.modo !== "preview_limpeza_logica") throw new Error('Contrato Financeiro V2 Limpo inválido: modo incorreto');
    if (response.dados_alterados !== false) throw new Error('Contrato Financeiro V2 Limpo inválido: dados_alterados deve ser false');
    if (!response.auditoria?.registros_ignorados_por_manifesto) throw new Error('Contrato Financeiro V2 Limpo inválido: auditoria de ignorados ausente');

    validateFinanceiroV2Contract(response);

    return response as unknown as FinanceiroV2PreviewLimpezaResponse;
  },

  /**
   * Busca série histórica financeira (V2)
   */
  async getSeries(oficinaId: string, dataInicio: string, dataFim: string): Promise<FinanceiroV2SeriesResponse> {
    console.log(`[FinanceiroV2] Chamando RPC get_financeiro_v2_series para oficina ${oficinaId}`);

    const { data, error } = await supabase.rpc('get_financeiro_v2_series', {
      p_oficina_id: oficinaId,
      p_data_inicio: dataInicio,
      p_data_fim: dataFim
    });

    if (error) {
      console.error('[FinanceiroV2] Erro na RPC de série:', error);
      throw new Error(`Erro técnico ao buscar série V2: ${error.message}`);
    }

    if (!data || !Array.isArray((data as any).series)) {
      throw new Error('Contrato Financeiro V2 de série inválido');
    }

    return data as unknown as FinanceiroV2SeriesResponse;
  }
};
