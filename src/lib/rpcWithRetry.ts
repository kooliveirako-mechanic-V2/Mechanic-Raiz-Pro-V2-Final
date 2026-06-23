// Helper versionado para chamadas RPC críticas: detecta erro de JWT/401
// e tenta renovar a sessão automaticamente antes de devolver erro ao usuário.
// Também reporta falhas das RPCs críticas para o Sentinela Raiz (Camada 1).
//
// Uso:
//   const { data, error } = await rpcWithRetry("criar_os_completa", params);

import { supabase } from "@/integrations/supabase/client";
import { isAuthError } from "@/lib/authGuard";

// Lista espelhada de RPCS_CRITICAS (evita import circular com sentinela.ts).
// Mantenha sincronizada com src/lib/sentinela.ts → RPCS_CRITICAS.
const CRITICAL_RPCS = new Set<string>([
  "criar_os_completa",
  "finalizar_os_atomica",
  "reabrir_os_atomica",
  "atomic_delete_os",
  "atomic_delete_cliente",
  "atomic_delete_veiculo",
  "atomic_delete_estoque",
  "atomic_delete_orcamento",
  "criar_venda_balcao",
  "gerar_parcelas_atomic",
  "registrar_sinal_os",
  "upsert_financeiro_os",
  "deletar_item_os_atomic",
  "recalcular_totais_orcamento",
]);

async function reportToSentinela(
  fnName: string,
  params: Record<string, unknown>,
  err: { message: string; code?: string; status?: number }
): Promise<void> {
  if (!CRITICAL_RPCS.has(fnName)) return;
  try {
    // Dynamic import evita ciclo (sentinela.ts importa este arquivo).
    const mod = await import("@/lib/sentinela");
    await mod.logFrontendError(`rpc:${fnName}`, err, { rpc: fnName, params });
  } catch {
    /* silencioso — log nunca pode quebrar o fluxo do usuário */
  }
}

export async function rpcWithRetry<T = unknown>(
  fnName: string,
  params: Record<string, unknown>,
  maxRetries = 1
): Promise<{ data: T | null; error: { message: string; code?: string; status?: number } | null }> {
  let lastError: { message: string; code?: string; status?: number } | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase.rpc(fnName as any, params as any);

    if (!error) {
      return { data: data as T, error: null };
    }

    lastError = error as { message: string; code?: string; status?: number };

    if (isAuthError(error) && attempt < maxRetries) {
      console.warn(`[RPC] Auth error em ${fnName} — renovando sessão (tentativa ${attempt + 1})`);
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error(`[RPC] Falha ao renovar sessão:`, refreshError.message);
        void reportToSentinela(fnName, params, lastError);
        if (typeof window !== "undefined") {
          window.location.href = "/auth";
        }
        return { data: null, error: lastError };
      }
      continue;
    }

    void reportToSentinela(fnName, params, lastError);
    return { data: null, error: lastError };
  }

  if (lastError) void reportToSentinela(fnName, params, lastError);
  return { data: null, error: lastError };
}
