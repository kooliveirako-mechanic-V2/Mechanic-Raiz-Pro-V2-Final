import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

interface Oficina {
  id: string;
  user_id: string;
  nome: string;
  logo_url: string | null;
  telefone: string | null;
  endereco: string | null;
  tipo: string;
  created_at: string;
  updated_at: string;
}

interface OficinaContextType {
  oficinas: Oficina[];
  oficinaAtual: Oficina | null;
  setOficinaAtual: (oficina: Oficina | null) => void;
  loading: boolean;
  initialized: boolean;
  loadError: string | null;
  refetch: () => Promise<void>;
  createOficina: (data: { nome: string; telefone?: string; endereco?: string; tipo?: string }) => Promise<{ error: Error | null; oficina_id?: string }>;
}

const OficinaContext = createContext<OficinaContextType | undefined>(undefined);

// Timeout wrapper para evitar spinner infinito em conexões 3G/4G ruins.
// Se a query travar > 15s, rejeita e libera a UI ao invés de ficar em loading eterno.
const QUERY_TIMEOUT_MS = 15000;
function withTimeout<T>(promise: PromiseLike<T>, label: string, ms = QUERY_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      console.warn(`[OficinaContext] Query timeout (${ms}ms): ${label}`);
      reject(new Error(`query_timeout:${label}`));
    }, ms);
    Promise.resolve(promise).then(
      (v) => { clearTimeout(t); resolve(v as T); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

export function OficinaProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [oficinaAtual, setOficinaAtualState] = useState<Oficina | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Wrapper to persist oficinaAtual to localStorage and Profile
  const setOficinaAtual = async (oficina: Oficina | null) => {
    setOficinaAtualState(oficina);
    if (oficina) {
      localStorage.setItem('oficinaAtual', JSON.stringify(oficina));
      
      // Persist to profile for cross-device consistency
      if (user?.id) {
        supabase
          .from('profiles')
          .update({ last_oficina_id: oficina.id })
          .eq('user_id', user.id)
          .then(({ error }) => {
            if (error) console.error('[OficinaContext] Error updating last_oficina_id:', error);
          });
      }
    } else {
      localStorage.removeItem('oficinaAtual');
    }
  };

  const fetchOficinas = async () => {
    // If no user (logged out), clear everything
    if (!user) {
      setOficinas([]);
      setOficinaAtualState(null);
      setLoadError(null);
      localStorage.removeItem('oficinaAtual');
      setLoading(false);
      setInitialized(true);
      return;
    }

    // Set loading to true before fetching
    setLoading(true);
    setLoadError(null);

    try {
      // Fetch oficinas where user is owner - sorted by created_at (oldest first as they are usually the main ones)
      const { data: ownedData, error: ownedError } = await withTimeout(
        supabase
          .from("oficinas")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        "oficinas_owned"
      );

      if (ownedError) throw ownedError;

      // Fetch oficinas where user is a team member (não-crítico: se falhar, segue só com owned)
      let teamRoles: { oficina_id: string }[] | null = null;
      try {
        const res = await withTimeout(
          supabase
            .from("user_roles")
            .select("oficina_id")
            .eq("user_id", user.id)
            .eq("active", true),
          "user_roles"
        );
        teamRoles = res.data;
      } catch (e) {
        console.warn("[OficinaContext] user_roles fetch failed, prosseguindo só com owned:", e);
      }

      let teamData: typeof ownedData = [];
      if (teamRoles && teamRoles.length > 0) {
        const teamIds = teamRoles.map(r => r.oficina_id);
        const ownedIds = new Set((ownedData || []).map(o => o.id));
        const missingIds = teamIds.filter(id => !ownedIds.has(id));
        
        if (missingIds.length > 0) {
          try {
            const { data: td } = await withTimeout(
              supabase.from("oficinas").select("*").in("id", missingIds),
              "oficinas_team"
            );
            teamData = td || [];
          } catch (e) {
            console.warn("[OficinaContext] team oficinas fetch failed:", e);
          }
        }
      }

      const data = [...(ownedData || []), ...teamData];

      setOficinas(data || []);
      setLoadError(null);
      
      // 1. Try to restore from Profile (most reliable) — não-crítico: se travar, cai pro localStorage
      let initialOficina: Oficina | null = null;
      
      if (user?.id) {
        try {
          const { data: profile } = await withTimeout(
            supabase
              .from('profiles')
              .select('last_oficina_id')
              .eq('user_id', user.id)
              .maybeSingle(),
            "profile_last_oficina"
          );
          if (profile?.last_oficina_id) {
            initialOficina = data.find(o => o.id === profile.last_oficina_id) || null;
          }
        } catch (e) {
          console.warn("[OficinaContext] profile fetch failed, usando fallback:", e);
        }
      }

      // 2. Fallback to localStorage
      if (!initialOficina) {
        const savedOficina = localStorage.getItem('oficinaAtual');
        if (savedOficina) {
          try {
            const parsed = JSON.parse(savedOficina);
            initialOficina = data.find((o) => o.id === parsed.id) || null;
          } catch (e) {
            console.error('[OficinaContext] Error parsing localStorage:', e);
          }
        }
      }

      // 3. Fallback to the one with the most data (heuristic to avoid ghost workshops)
      if (!initialOficina && data.length > 0) {
        initialOficina = data[0];
      }

      if (initialOficina) {
        setOficinaAtualState(initialOficina);
      }
    } catch (error) {
      console.error("Error fetching oficinas:", error);
      // CRÍTICO: mesmo em erro/timeout, NÃO deixar UI travada.
      // Tenta restaurar do localStorage como último recurso para não bloquear o app.
      const savedOficina = localStorage.getItem('oficinaAtual');
      let restoredFromCache = false;
      if (savedOficina) {
        try {
          const parsed = JSON.parse(savedOficina);
          setOficinas([parsed]);
          setOficinaAtualState(parsed);
          restoredFromCache = true;
        } catch {}
      }
      if (!restoredFromCache) {
        setLoadError("Não conseguimos confirmar os dados da oficina agora. Verifique sua internet e tente novamente.");
      }
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  };

  const createOficina = async (data: { nome: string; telefone?: string; endereco?: string; tipo?: string }): Promise<{ error: Error | null; oficina_id?: string }> => {
    if (!user) return { error: new Error("Usuário não autenticado") };

    try {
      const { data: newOficina, error } = await withTimeout(
        supabase
          .from("oficinas")
          .insert({
            user_id: user.id,
            nome: data.nome,
            telefone: data.telefone || null,
            endereco: data.endereco || null,
            tipo: data.tipo || "ambos",
          })
          .select()
          .single(),
        "create_oficina"
      );

      if (error) throw error;

      // Trial subscription is created automatically by DB trigger (create_trial_subscription)
      // No need to create it here - the trigger fires on oficinas INSERT

      setOficinas((prev) => [newOficina, ...prev]);
      if (!oficinaAtual) {
        setOficinaAtual(newOficina);
      }

      return { error: null, oficina_id: newOficina.id };
    } catch (error) {
      return { error: error as Error };
    }
  };

  useEffect(() => {
    // If auth is loading, we stay in loading state
    if (authLoading) {
      setLoading(true);
      setInitialized(false);
      return;
    }

    // Check if we are in a public route that doesn't need Oficina context initialization
    const publicPaths = ['/os/', '/orcamento/', '/portal/', '/agendar/', '/auth', '/reset-password', '/cadastro-concluido', '/instalar', '/termos', '/privacidade', '/ajuda', '/limpar'];
    const isPublicRoute = publicPaths.some(path => window.location.pathname.startsWith(path)) || window.location.pathname === '/';

    // If no user and it's a public route, we can skip fetching but must mark as initialized
    if (!user && isPublicRoute) {
      setOficinas([]);
      setOficinaAtualState(null);
      setLoadError(null);
      setLoading(false);
      setInitialized(true);
      return;
    }

    // Otherwise (user logged in OR not a public route), fetch normally
    fetchOficinas();
  }, [user, authLoading]);

  return (
    <OficinaContext.Provider
      value={{
        oficinas,
        oficinaAtual,
        setOficinaAtual,
        loading,
        initialized,
        loadError,
        refetch: fetchOficinas,
        createOficina,
      }}
    >
      {children}
    </OficinaContext.Provider>
  );
}

export function useOficina() {
  const context = useContext(OficinaContext);
  if (context === undefined) {
    throw new Error("useOficina must be used within an OficinaProvider");
  }
  return context;
}
