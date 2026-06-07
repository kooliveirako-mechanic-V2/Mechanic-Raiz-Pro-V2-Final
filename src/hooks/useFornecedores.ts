import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";

export interface Fornecedor {
  id: string;
  oficina_id: string;
  nome: string;
  cnpj_cpf: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
}

export function useFornecedores() {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ["fornecedores", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      
      const { data, error } = await supabase
        .from("fornecedores")
        .select("*")
        .eq("oficina_id", oficinaAtual.id)
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data as Fornecedor[];
    },
    enabled: !!oficinaAtual,
  });

  const createMutation = useMutation({
    mutationFn: async (fornecedor: { nome: string; cnpj_cpf?: string; telefone?: string; email?: string; endereco?: string; observacoes?: string }) => {
      if (!oficinaAtual) throw new Error("Oficina não selecionada");
      
      const { data, error } = await supabase
        .from("fornecedores")
        .insert({
          nome: fornecedor.nome,
          cnpj_cpf: fornecedor.cnpj_cpf,
          telefone: fornecedor.telefone,
          email: fornecedor.email,
          endereco: fornecedor.endereco,
          observacoes: fornecedor.observacoes,
          oficina_id: oficinaAtual.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Fornecedor cadastrado!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao cadastrar", { description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Fornecedor> & { id: string }) => {
      const { data, error } = await supabase
        .from("fornecedores")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Fornecedor atualizado!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar", { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fornecedores")
        .update({ ativo: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Fornecedor removido!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao remover", { description: error.message });
    },
  });

  return {
    fornecedores,
    isLoading,
    createFornecedor: createMutation.mutate,
    updateFornecedor: updateMutation.mutate,
    deleteFornecedor: deleteMutation.mutate,
  };
}
