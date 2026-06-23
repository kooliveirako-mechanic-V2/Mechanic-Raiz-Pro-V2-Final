/**
 * SENTINELA RAIZ — Camada 1 (Captura)
 *
 * Wrapper para RPCs críticas. Garante:
 *  - Comportamento idêntico ao rpcWithRetry (mesma assinatura)
 *  - Em caso de erro, grava em public.audit_logs (action='runtime_error')
 *    com contexto (oficina, usuário, RPC, payload sanitizado, mensagem)
 *  - Reporta para Sentry com tags úteis
 *
 * IMPORTANTE: NUNCA lança exceção própria. Se a gravação de log falhar,
 * o erro é silenciado para não mascarar o erro real do RPC.
 *
 * Uso:
 *   const { data, error } = await rpcSentinela("criar_os_completa", params);
 */

import { supabase } from "@/integrations/supabase/client";
import { rpcWithRetry } from "@/lib/rpcWithRetry";
import { Sentry } from "@/lib/sentry";

/** Lista oficial das RPCs críticas monitoradas (referência usada pelo score). */
export const RPCS_CRITICAS = [
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
] as const;

export type RpcCritica = (typeof RPCS_CRITICAS)[number];

const SENSITIVE_KEYS = new Set([
  "password",
  "senha",
  "token",
  "access_token",
  "refresh_token",
  "api_key",
  "secret",
  "cpf",
  "cnpj",
  "cartao",
  "credit_card",
]);

/** Remove campos sensíveis e trunca payload para não estourar a coluna jsonb. */
function sanitizePayload(payload: unknown): unknown {
  if (payload == null || typeof payload !== "object") return payload;
  try {
    const clone: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        clone[k] = "[REDACTED]";
      } else if (typeof v === "string" && v.length > 500) {
        clone[k] = v.slice(0, 500) + "…";
      } else {
        clone[k] = v;
      }
    }
    const json = JSON.stringify(clone);
    if (json.length > 8000) return { _truncated: true, preview: json.slice(0, 8000) };
    return clone;
  } catch {
    return { _unserializable: true };
  }
}

async function getContext(): Promise<{ user_id: string | null; oficina_id: string | null }> {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const user_id = sess?.session?.user?.id ?? null;
    let oficina_id: string | null = null;
    try {
      oficina_id = localStorage.getItem("oficina_id_ativa") ?? null;
    } catch {
      /* SSR/sandbox sem localStorage */
    }
    return { user_id, oficina_id };
  } catch {
    return { user_id: null, oficina_id: null };
  }
}

/** Log silencioso para audit_logs + Sentry. Nunca lança. */
async function logRuntimeError(
  rpcName: string,
  payload: unknown,
  err: { message?: string; code?: string; status?: number } | null,
  severity: "error" | "fatal" = "error"
): Promise<void> {
  const ctx = await getContext();
  const sanitized = sanitizePayload(payload);
  const newData = {
    rpc: rpcName,
    severity,
    message: err?.message ?? "Erro desconhecido",
    code: err?.code ?? null,
    status: err?.status ?? null,
    payload: sanitized,
    captured_at: new Date().toISOString(),
  };

  // 1) Sentry (não bloqueia)
  try {
    Sentry.withScope((scope) => {
      scope.setTag("sentinela", "rpc");
      scope.setTag("rpc_name", rpcName);
      if (ctx.oficina_id) scope.setTag("oficina_id", ctx.oficina_id);
      if (severity === "fatal") scope.setLevel("fatal");
      scope.setContext("rpc_payload", { sanitized });
      Sentry.captureException(new Error(`[RPC ${rpcName}] ${err?.message ?? "erro"}`));
    });
  } catch {
    /* ignore */
  }

  // 2) audit_logs (não bloqueia)
  if (!ctx.user_id || !ctx.oficina_id) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("audit_logs") as any).insert({
      action: "runtime_error",
      table_name: "rpc",
      user_id: ctx.user_id,
      oficina_id: ctx.oficina_id,
      new_data: newData as unknown,
    });
  } catch (logErr) {
    // Falha de log NÃO pode quebrar fluxo. Apenas console.
    // eslint-disable-next-line no-console
    console.warn("[Sentinela] Falha ao gravar audit_log", logErr);
  }
}

/**
 * Wrapper Sentinela. Mantém assinatura de rpcWithRetry.
 * Se a chamada falhar, grava o erro em audit_logs/Sentry antes de retornar.
 */
export async function rpcSentinela<T = unknown>(
  fnName: string,
  params: Record<string, unknown>,
  options: { severity?: "error" | "fatal"; maxRetries?: number } = {}
): Promise<{ data: T | null; error: { message: string; code?: string; status?: number } | null }> {
  const { severity = "error", maxRetries = 1 } = options;
  const result = await rpcWithRetry<T>(fnName, params, maxRetries);
  if (result.error) {
    // fire-and-forget
    void logRuntimeError(fnName, params, result.error, severity);
  }
  return result;
}

/**
 * Loga um erro de frontend (boundary, hook, evento). Não envolve RPC.
 */
export async function logFrontendError(
  source: string,
  err: unknown,
  extra?: Record<string, unknown>
): Promise<void> {
  const e = err as { message?: string; code?: string; status?: number } | null;
  const message = e?.message ?? String(err);
  await logRuntimeError(`frontend:${source}`, extra ?? {}, { ...e, message }, "error");
}
