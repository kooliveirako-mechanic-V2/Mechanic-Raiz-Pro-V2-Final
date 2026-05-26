import { supabase } from "@/integrations/supabase/client";
import { Sentry } from "@/lib/sentry";
import { UpsertFinanceiroOSResult } from "@/lib/rpcTypes";

/**
 * Centralized financial record creation for OS finalization.
 * Uses a server-side SECURITY DEFINER function with ON CONFLICT
 * to guarantee atomicity and prevent race conditions.
 * 
 * Called from:
 * - Servicos.tsx (Kanban status change)
 * - OrdemServicoFormModal.tsx (form update/create)
 * - OSRapidaModal.tsx (quick OS creation)
 */
export async function upsertFinanceiroOS(params: {
  oficina_id: string;
  ordem_servico_id: string;
  tipo_servico: string;
  valor_mao_de_obra: number;
  forma_pagamento_id?: string | null;
  origem?: string;
  numero_parcelas?: number;
}): Promise<{ success: boolean; error?: string; action?: "created" | "exists" | "skipped" }> {
  const { oficina_id, ordem_servico_id, tipo_servico, valor_mao_de_obra, forma_pagamento_id, origem, numero_parcelas } = params;

  try {
    const { data, error } = await supabase.rpc("upsert_financeiro_os" as any, {
      p_oficina_id: oficina_id,
      p_ordem_servico_id: ordem_servico_id,
      p_tipo_servico: tipo_servico,
      p_valor_mao_de_obra: valor_mao_de_obra,
      p_forma_pagamento_id: forma_pagamento_id || null,
      p_origem: origem || null,
      p_numero_parcelas: numero_parcelas || 1,
    });

    if (error) {
      console.error("[financeiroOS] Erro na RPC:", error.message);
      Sentry.captureException(error, { extra: { params, context: "upsertFinanceiroOS.rpc" } });
      return { success: false, error: error.message };
    }

    const result = data as UpsertFinanceiroOSResult;
    
    if (!result.success) {
      console.error("[financeiroOS] Falha:", result.error);
      return { success: false, error: result.error };
    }

    return { 
      success: true, 
      action: result.action as "created" | "exists" | "skipped" 
    };
  } catch (err) {
    console.error("[financeiroOS] Erro inesperado:", err);
    Sentry.captureException(err, { extra: { params, context: "upsertFinanceiroOS.catch" } });
    return { success: false, error: String(err) };
  }
}
