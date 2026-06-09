import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setSentryUser, clearSentryUser } from "@/lib/sentry";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nome: string, metadata?: Record<string, string>) => Promise<{ error: Error | null; session: Session | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = React.useRef(false);

  useEffect(() => {
    // Set up auth state listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        if (!initializedRef.current) return;
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
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      initializedRef.current = true;
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, nome: string, metadata?: Record<string, string>) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          nome,
          ...metadata,
        },
      },
    });
    return { error, session: data?.session ?? null };
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
