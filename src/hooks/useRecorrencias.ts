import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";

export interface Recorrencia {
  id: string;
  oficina_id: string;
  veiculo_id: string;
  tipo_servico: string;
  intervalo_dias: number | null;
  intervalo_km: number | null;
  ultima_execucao: string | null;
  proxima_execucao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  veiculo?: {
    marca: string;
    modelo: string;
    placa: string | null;
    km_atual: number | null;
    cliente?: {
      nome: string;
      telefone: string | null;
    };
  };
}

export interface RecorrenciaInput {
  veiculo_id: string;
  tipo_servico: string;
  intervalo_dias?: number | null;
  intervalo_km?: number | null;
  ultima_execucao?: string | null;
  proxima_execucao?: string | null;
  ativo?: boolean;
}

export function useRecorrencias() {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();

  const { data: recorrencias = [], isLoading, error } = useQuery({
    queryKey: ["recorrencias", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      
      const { data, error } = await supabase
        .from("recorrencias")
        .select(`
          *,
          veiculo:veiculos (
            marca,
            modelo,
            placa,
            km_atual,
            cliente:clientes (
              nome,
              telefone
            )
          )
        `)
        .eq("oficina_id", oficinaAtual.id)
        .order("proxima_execucao", { ascending: true });

      if (error) throw error;
      return data as Recorrencia[];
    },
    enabled: !!oficinaAtual,
  });

  const createRecorrencia = useMutation({
    mutationFn: async (input: RecorrenciaInput) => {
      if (!oficinaAtual) throw new Error("Nenhuma oficina selecionada");
      
      const { data, error } = await supabase
        .from("recorrencias")
        .insert({
          oficina_id: oficinaAtual.id,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recorrencias"] });
      toast.success("Lembrete de manutenção criado!");
    },
    onError: (error) => {
      console.error("Error creating recorrencia:", error);
      toast.error("Erro ao criar lembrete");
    },
  });

  const updateRecorrencia = useMutation({
    mutationFn: async ({ id, ...input }: RecorrenciaInput & { id: string }) => {
      const { data, error } = await supabase
        .from("recorrencias")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recorrencias"] });
      toast.success("Lembrete atualizado!");
    },
    onError: (error) => {
      console.error("Error updating recorrencia:", error);
      toast.error("Erro ao atualizar lembrete");
    },
  });

  const deleteRecorrencia = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("recorrencias")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recorrencias"] });
      toast.success("Lembrete removido!");
    },
    onError: (error) => {
      console.error("Error deleting recorrencia:", error);
      toast.error("Erro ao remover lembrete");
    },
  });

  // Calculate alerts
  const hoje = new Date();
  const alertas = recorrencias.filter((r) => {
    if (!r.ativo) return false;
    
    // Check by date
    if (r.proxima_execucao) {
      const proxima = new Date(r.proxima_execucao);
      const diffDays = Math.ceil((proxima.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) return true;
    }
    
    // Check by km
    if (r.intervalo_km && r.veiculo?.km_atual && r.ultima_execucao) {
      // This would need last km from OS - simplified here
      return false;
    }
    
    return false;
  });

  return {
    recorrencias,
    alertas,
    isLoading,
    error,
    createRecorrencia,
    updateRecorrencia,
    deleteRecorrencia,
  };
}
