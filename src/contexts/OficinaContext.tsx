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

  // Wrapper to persist oficinaAtual to localStorage
  const setOficinaAtual = (oficina: Oficina | null) => {
    setOficinaAtualState(oficina);
    if (oficina) {
      localStorage.setItem('oficinaAtual', JSON.stringify(oficina));
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
      // Fetch oficinas where user is owner
      const { data: ownedData, error: ownedError } = await supabase
        .from("oficinas")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

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
      
      // Try to restore oficina from localStorage first
      const savedOficina = localStorage.getItem('oficinaAtual');
      if (savedOficina && data && data.length > 0) {
        try {
          const parsed = JSON.parse(savedOficina);
          // Verify the saved oficina still exists and belongs to this user
          const found = data.find((o) => o.id === parsed.id);
          if (found) {
            setOficinaAtualState(found);
          } else {
            // Saved oficina not found, use first one
            setOficinaAtual(data[0]);
          }
        } catch {
          setOficinaAtual(data[0]);
        }
      } else if (data && data.length > 0) {
        // No saved oficina, use first one
        setOficinaAtual(data[0]);
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
