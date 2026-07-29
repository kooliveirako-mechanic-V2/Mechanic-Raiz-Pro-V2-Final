/**
 * Guarda de prejuízo — PR 1.
 *
 * Antes de finalizar uma OS, chama a RPC `preview_os_totais` (leitura pura)
 * para saber se o custo total supera o valor cobrado. Se sim, pede confirmação
 * explícita ao usuário. Não bloqueia — apenas alerta.
 *
 * Uso:
 *   const ok = await checkPrejuizoAndConfirm(osId, valorMaoObra);
 *   if (!ok) return;
 *   // ... segue para finalizar_os_atomica
 */
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";

export interface PreviewOSTotaisResult {
  found: boolean;
  valor_bruto?: number;
  desconto?: number;
  valor_liquido?: number;
  custo_total?: number;
  lucro_previsto?: number;
  prejuizo?: boolean;
  diferenca_prejuizo?: number;
}

/**
 * Retorna `true` se pode seguir (sem prejuízo OU usuário confirmou),
 * `false` se usuário cancelou.
 *
 * Em caso de erro na RPC, retorna `true` (fail-open) para não bloquear
 * finalização por causa de rede/RLS — o guard é auxiliar, não crítico.
 */
export async function checkPrejuizoAndConfirm(
  osId: string,
  valorMaoObra?: number | null,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("preview_os_totais" as any, {
      p_os_id: osId,
      p_valor_mao_obra: valorMaoObra ?? null,
    });

    if (error) {
      console.warn("[prejuizoGuard] preview_os_totais falhou, seguindo sem checar:", error.message);
      return true;
    }

    const preview = data as PreviewOSTotaisResult | null;
    if (!preview?.found || !preview.prejuizo) return true;

    const custo = preview.custo_total ?? 0;
    const valor = preview.valor_liquido ?? 0;
    const diff = preview.diferenca_prejuizo ?? Math.max(0, custo - valor);

    const msg =
      `⚠️ ATENÇÃO — Esta OS está com PREJUÍZO.\n\n` +
      `Custo dos itens:  ${formatCurrency(custo)}\n` +
      `Valor cobrado:    ${formatCurrency(valor)}\n` +
      `Prejuízo:         ${formatCurrency(diff)}\n\n` +
      `Deseja finalizar mesmo assim?`;

    // window.confirm é bloqueante, nativo e funciona bem em mobile 3G/4G.
    // Público-alvo (mecânicos, baixa afinidade tech) responde melhor ao diálogo nativo.
    return window.confirm(msg);
  } catch (err) {
    console.warn("[prejuizoGuard] exceção, seguindo sem checar:", err);
    return true;
  }
}
