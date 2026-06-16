// Global auth guard: handles JWT refresh + forced sign-out redirect.
// Mounted once via initAuthGuard() at app boot.
//
// NÃO toca em src/integrations/supabase/client.ts (auto-gerado).
// O cliente já é criado com autoRefreshToken: true e persistSession: true.

import { supabase } from "@/integrations/supabase/client";

let initialized = false;

export function initAuthGuard() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  supabase.auth.onAuthStateChange((event) => {
    if (event === "TOKEN_REFRESHED") {
      console.log("[Auth] Token renovado automaticamente");
    }
    if (event === "SIGNED_OUT") {
      console.log("[Auth] Sessão encerrada");
      const path = window.location.pathname;
      // Não redireciona se já está em rota pública
      const publicRoutes = ["/auth", "/", "/os/", "/orcamento/", "/agendar/", "/portal/", "/reset-password", "/limpar"];
      if (!publicRoutes.some((p) => path.startsWith(p))) {
        window.location.href = "/auth";
      }
    }
  });
}

// Heurística para identificar erros de auth/JWT vindos do PostgREST/Supabase.
export function isAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; status?: number; message?: string };
  if (e.status === 401) return true;
  if (e.code === "PGRST301" || e.code === "401") return true;
  const msg = (e.message || "").toLowerCase();
  return (
    msg.includes("jwt") ||
    msg.includes("invalid token") ||
    msg.includes("token expired") ||
    msg.includes("not authenticated") ||
    msg.includes("unauthorized")
  );
}
