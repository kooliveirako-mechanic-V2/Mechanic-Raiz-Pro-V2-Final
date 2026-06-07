import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";

export interface CentroCusto {
  id: string;
  oficina_id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
}

export function useCentrosCusto() {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();

  const { data: centrosCusto = [], isLoading } = useQuery({
    queryKey: ["centros-custo", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      
      const { data, error } = await supabase
        .from("centros_custo")
        .select("*")
        .eq("oficina_id", oficinaAtual.id)
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data as CentroCusto[];
    },
    enabled: !!oficinaAtual,
  });

  const createMutation = useMutation({
    mutationFn: async (centro: { nome: string; descricao?: string }) => {
      if (!oficinaAtual) throw new Error("Oficina não selecionada");
      
      const { data, error } = await supabase
        .from("centros_custo")
        .insert({
          nome: centro.nome,
          descricao: centro.descricao,
          oficina_id: oficinaAtual.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["centros-custo"] });
      toast.success("Centro de custo criado!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar", { description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CentroCusto> & { id: string }) => {
      const { data, error } = await supabase
        .from("centros_custo")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["centros-custo"] });
      toast.success("Centro de custo atualizado!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar", { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("centros_custo")
        .update({ ativo: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["centros-custo"] });
      toast.success("Centro de custo removido!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao remover", { description: error.message });
    },
  });

  return {
    centrosCusto,
    isLoading,
    createCentroCusto: createMutation.mutate,
    updateCentroCusto: updateMutation.mutate,
    deleteCentroCusto: deleteMutation.mutate,
  };
}
