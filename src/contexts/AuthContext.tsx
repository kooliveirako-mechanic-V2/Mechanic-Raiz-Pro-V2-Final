import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setSentryUser, clearSentryUser } from "@/lib/sentry";
import { getBaseUrl } from "@/utils/url";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nome: string, metadata?: Record<string, string>) => Promise<{ error: Error | null; session: Session | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: PromiseLike<T>, label: string, ms = AUTH_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      console.warn(`[Auth] Timeout após ${ms}ms: ${label}`);
      reject(new Error("Tempo esgotado ao conectar. Verifique sua internet e tente novamente."));
    }, ms);

    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value as T);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function getCachedSessionFromStorage(): Session | null {
  if (typeof window === "undefined") return null;

  try {
    for (const key of Object.keys(window.localStorage)) {
      if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;

      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const candidate = parsed?.currentSession || parsed?.session || parsed;
      if (!candidate?.access_token || !candidate?.user?.id) continue;

      const expiresAt = Number(candidate.expires_at || 0);
      if (expiresAt && expiresAt * 1000 < Date.now()) continue;

      return candidate as Session;
    }
  } catch (error) {
    console.warn("[Auth] Falha ao ler sessão em cache:", error);
  }

  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = React.useRef(false);

  useEffect(() => {
    let mounted = true;
    let startupReleased = false;

    const releaseStartupLoading = (reason: string) => {
      if (!mounted || startupReleased) return;
      startupReleased = true;
      const cachedSession = getCachedSessionFromStorage();
      if (cachedSession) {
        setSession(cachedSession);
        setUser(cachedSession.user ?? null);
      }
      initializedRef.current = true;
      setLoading(false);
      console.warn(`[Auth] Inicialização liberada: ${reason}`);
    };

    // Set up auth state listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        if (!initializedRef.current) return;
        if (!mounted) return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        if (currentSession?.user) {
          setSentryUser(
            { id: currentSession.user.id, email: currentSession.user.email },
            currentSession.user.user_metadata?.oficina_id
          );
        } else {
          clearSentryUser();
        }
      }
    );

    // Check for existing session - this is the source of truth on startup
    const startupTimer = window.setTimeout(() => {
      releaseStartupLoading("timeout_getSession");
    }, AUTH_TIMEOUT_MS);

    supabase.auth.getSession().then(
      ({ data: { session: existingSession } }) => {
        if (!mounted) return;
        window.clearTimeout(startupTimer);
        startupReleased = true;
        setSession(existingSession);
        setUser(existingSession?.user ?? null);
        initializedRef.current = true;
        setLoading(false);
      },
      (error) => {
        if (!mounted) return;
        window.clearTimeout(startupTimer);
        console.error("[Auth] Erro ao recuperar sessão inicial:", error);
        releaseStartupLoading("erro_getSession");
      }
    );

    return () => {
      mounted = false;
      window.clearTimeout(startupTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
        "signInWithPassword"
      );
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, nome: string, metadata?: Record<string, string>) => {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getBaseUrl(),
            data: {
              nome,
              ...metadata,
            },
          },
        }),
        "signUp"
      );
      return { error, session: data?.session ?? null };
    } catch (error) {
      return { error: error as Error, session: null };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("[Auth] signOut warn:", e);
    }
    try {
      // Limpar tudo do navegador para evitar autofill/cache de sessão antiga
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("sb-") || k.includes("supabase") || k.includes("mrp_") || k === "oficinaAtual") {
          localStorage.removeItem(k);
        }
      });
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith("sb-") || k.includes("supabase") || k.includes("mrp_")) {
          sessionStorage.removeItem(k);
        }
      });
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) {
      console.warn("[Auth] cleanup warn:", e);
    }
    clearSentryUser();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
