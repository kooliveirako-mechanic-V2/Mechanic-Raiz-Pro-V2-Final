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
  refetch: () => Promise<void>;
  createOficina: (data: { nome: string; telefone?: string; endereco?: string; tipo?: string }) => Promise<{ error: Error | null; oficina_id?: string }>;
}

const OficinaContext = createContext<OficinaContextType | undefined>(undefined);

export function OficinaProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [oficinaAtual, setOficinaAtualState] = useState<Oficina | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

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
      localStorage.removeItem('oficinaAtual');
      setLoading(false);
      setInitialized(true);
      return;
    }

    // Set loading to true before fetching
    setLoading(true);

    try {
      // Fetch oficinas where user is owner - sorted by created_at (oldest first as they are usually the main ones)
      const { data: ownedData, error: ownedError } = await supabase
        .from("oficinas")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (ownedError) throw ownedError;

      // Fetch oficinas where user is a team member
      const { data: teamRoles } = await supabase
        .from("user_roles")
        .select("oficina_id")
        .eq("user_id", user.id)
        .eq("active", true);

      let teamData: typeof ownedData = [];
      if (teamRoles && teamRoles.length > 0) {
        const teamIds = teamRoles.map(r => r.oficina_id);
        const ownedIds = new Set((ownedData || []).map(o => o.id));
        const missingIds = teamIds.filter(id => !ownedIds.has(id));
        
        if (missingIds.length > 0) {
          const { data: td } = await supabase
            .from("oficinas")
            .select("*")
            .in("id", missingIds);
          teamData = td || [];
        }
      }

      const data = [...(ownedData || []), ...teamData];

      setOficinas(data || []);
      
      // 1. Try to restore from Profile (most reliable)
      let initialOficina: Oficina | null = null;
      
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('last_oficina_id')
          .eq('user_id', user.id)
          .maybeSingle();
          
        if (profile?.last_oficina_id) {
          initialOficina = data.find(o => o.id === profile.last_oficina_id) || null;
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
        // Since we can't easily check all counts here without multiple queries, 
        // we'll just pick the first one but we've improved the order in fetchOficinas if possible.
        initialOficina = data[0];
      }

      if (initialOficina) {
        setOficinaAtualState(initialOficina);
      }
    } catch (error) {
      console.error("Error fetching oficinas:", error);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  };

  const createOficina = async (data: { nome: string; telefone?: string; endereco?: string; tipo?: string }): Promise<{ error: Error | null; oficina_id?: string }> => {
    if (!user) return { error: new Error("Usuário não autenticado") };

    try {
      const { data: newOficina, error } = await supabase
        .from("oficinas")
        .insert({
          user_id: user.id,
          nome: data.nome,
          telefone: data.telefone || null,
          endereco: data.endereco || null,
          tipo: data.tipo || "ambos",
        })
        .select()
        .single();

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
