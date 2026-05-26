import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";

export interface Funcionario {
  user_id: string;
  nome: string;
  role: "proprietario" | "administrador" | "funcionario";
}

export function useFuncionarios() {
  const { oficinaAtual } = useOficina();

  const { data: funcionarios = [], isLoading, error } = useQuery({
    queryKey: ["funcionarios", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      
      const { data, error } = await supabase
        .rpc("get_oficina_funcionarios", { _oficina_id: oficinaAtual.id });

      if (error) throw error;
      return (data || []) as Funcionario[];
    },
    enabled: !!oficinaAtual,
  });

  return {
    funcionarios,
    isLoading,
    error,
  };
}
