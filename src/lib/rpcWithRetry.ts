// Helper versionado para chamadas RPC críticas: detecta erro de JWT/401
// e tenta renovar a sessão automaticamente antes de devolver erro ao usuário.
// Mantido em arquivo próprio para garantir que o build remoto inclua o módulo.
//
// Uso:
//   const { data, error } = await rpcWithRetry("criar_os_completa", params);
//
// Em caso de 401 não recuperável, redireciona para /auth.

import { supabase } from "@/integrations/supabase/client";
import { isAuthError } from "@/lib/authGuard";

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
      console.warn(`[RPC] Auth error em ${fnName} — tentando renovar sessão (tentativa ${attempt + 1})`);
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error(`[RPC] Falha ao renovar sessão:`, refreshError.message);
        if (typeof window !== "undefined") {
          window.location.href = "/auth";
        }
        return { data: null, error: lastError };
      }
      // tenta de novo
      continue;
    }

    return { data: null, error: lastError };
  }

  return { data: null, error: lastError };
}
