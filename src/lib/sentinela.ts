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
import { CRITICAL_RPCS } from "@/lib/criticalRpcs";

/**
 * Lista oficial das RPCs críticas monitoradas (referência usada pelo score).
 * Fonte única: `src/lib/criticalRpcs.ts`. Mantido como re-export para
 * compatibilidade com imports antigos (`RPCS_CRITICAS`).
 */
export const RPCS_CRITICAS = CRITICAL_RPCS;
export type RpcCritica = string;

/**
 * Substrings amplas — redação total. Cobrem variações como
 * `invite_token`, `reset_token`, `webhook_secret`, `authorization`,
 * `bearer_jwt`, `senha_atual`, `cartao_numero`, `cpf_cliente`.
 *
 * NÃO inclui "key" genérico (evita falso positivo em queryKey/cacheKey).
 */
const SENSITIVE_BROAD = [
  "token",
  "secret",
  "password",
  "senha",
  "cpf",
  "cnpj",
  "cartao",
  "card",
  "authorization",
  "bearer",
  "jwt",
];

/**
 * Padrões específicos para chaves de API (evita pegar queryKey, cacheKey, etc).
 * Match por includes em lk.
 */
const SENSITIVE_KEY_PATTERNS = [
  "api_key",
  "apikey",
  "private_key",
  "secret_key",
  "access_key",
  "public_key",
  "stripe_key",
  "mp_key",
  "resend_key",
];

/** Substrings que disparam mascaramento de PII (não redação total). */
const PII_EMAIL = ["email"];
const PII_PHONE = ["telefone", "phone", "celular"];
const PII_PLACA = ["placa"];
const PII_NOME_CLIENTE = ["cliente_nome", "nome_cliente", "p_cliente_nome"];

function isSensitiveKey(lk: string): boolean {
  if (SENSITIVE_BROAD.some((s) => lk.includes(s))) return true;
  if (SENSITIVE_KEY_PATTERNS.some((s) => lk.includes(s))) return true;
  return false;
}

function maskEmail(v: string): string {
  const [u, d] = v.split("@");
  if (!d) return "[REDACTED]";
  const prefix = u.slice(0, 2);
  return `${prefix}***@${d}`;
}
function maskPhone(v: string): string {
  const digits = v.replace(/\D/g, "");
  if (digits.length <= 4) return "***";
  return `***${digits.slice(-4)}`;
}
function maskPlaca(v: string): string {
  if (v.length <= 4) return "***";
  return `${v.slice(0, 3)}***${v.slice(-1)}`;
}
function maskNome(v: string): string {
  const parts = v.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "***";
  const first = parts[0];
  const lastInitial = parts.length > 1 ? ` ${parts[parts.length - 1][0]}.` : "";
  return `${first}${lastInitial}`;
}

function maskPII(lk: string, value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (PII_EMAIL.some((s) => lk.includes(s))) return maskEmail(value);
  if (PII_PHONE.some((s) => lk.includes(s))) return maskPhone(value);
  if (PII_PLACA.some((s) => lk.includes(s))) return maskPlaca(value);
  if (PII_NOME_CLIENTE.some((s) => lk.includes(s))) return maskNome(value);
  return value;
}

function isPIIKey(lk: string): boolean {
  return (
    PII_EMAIL.some((s) => lk.includes(s)) ||
    PII_PHONE.some((s) => lk.includes(s)) ||
    PII_PLACA.some((s) => lk.includes(s)) ||
    PII_NOME_CLIENTE.some((s) => lk.includes(s))
  );
}

/**
 * Sanitiza payload. ORDEM IMPORTA:
 *  1) PII (email/phone/placa/nome cliente) → mascarado, preserva debug
 *  2) Sensível total (token/secret/cpf/cnpj/cartão/api_key) → [REDACTED]
 *  3) Truncamento de strings longas
 */
export function sanitizePayload(payload: unknown): unknown {
  if (payload == null || typeof payload !== "object") return payload;
  try {
    const clone: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      const lk = k.toLowerCase();
      if (isPIIKey(lk)) {
        clone[k] = maskPII(lk, v);
      } else if (isSensitiveKey(lk)) {
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

/**
 * Wrapper Sentinela para RPCs em contexto **público/anônimo** (portal, agendamento,
 * convite). Diferenças vs `rpcSentinela`:
 *  - NÃO usa rpcWithRetry: evita retry em escrita pública (pode duplicar) e
 *    evita redirect para /auth no caso de JWT inválido.
 *  - NÃO grava em audit_logs: RLS bloqueia anon e travaria o fluxo do cliente.
 *  - Apenas captura erro em Sentry + console.warn. NUNCA lança.
 *  - Assinatura idêntica a supabase.rpc para drop-in replacement.
 */
export async function rpcSentinelaPublic<T = unknown>(
  fnName: string,
  params: Record<string, unknown>
): Promise<{ data: T | null; error: { message: string; code?: string; status?: number } | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc(fnName as any, params as any);
  if (error) {
    const sanitized = sanitizePayload(params);
    try {
      Sentry.withScope((scope) => {
        scope.setTag("sentinela", "rpc_public");
        scope.setTag("rpc_name", fnName);
        scope.setContext("rpc_payload", { sanitized });
        Sentry.captureException(new Error(`[RPC public ${fnName}] ${error.message ?? "erro"}`));
      });
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line no-console
    console.warn(`[Sentinela:public] ${fnName} falhou:`, error.message, sanitized);
  }
  return {
    data: (data as T) ?? null,
    error: error
      ? {
          message: error.message,
          code: (error as { code?: string }).code,
          status: (error as { status?: number }).status,
        }
      : null,
  };
}

