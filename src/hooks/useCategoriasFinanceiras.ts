import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";

export interface CategoriaFinanceira {
  id: string;
  oficina_id: string;
  nome: string;
  tipo: "entrada" | "saida" | "ambos";
  cor: string;
  icone: string;
  ativo: boolean;
  padrao: boolean;
  created_at: string;
}

export function useCategoriasFinanceiras() {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ["categorias-financeiras", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("*")
        .eq("oficina_id", oficinaAtual.id)
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data as CategoriaFinanceira[];
    },
    enabled: !!oficinaAtual,
  });

  const createMutation = useMutation({
    mutationFn: async (categoria: Omit<Partial<CategoriaFinanceira>, "oficina_id" | "id" | "created_at"> & { nome: string; tipo: "entrada" | "saida" | "ambos" }) => {
      if (!oficinaAtual) throw new Error("Oficina não selecionada");
      
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .insert({
          nome: categoria.nome,
          tipo: categoria.tipo,
          cor: categoria.cor,
          icone: categoria.icone,
          ativo: categoria.ativo ?? true,
          padrao: categoria.padrao ?? false,
          oficina_id: oficinaAtual.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias-financeiras"] });
      toast.success("Categoria criada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar categoria", { description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CategoriaFinanceira> & { id: string }) => {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias-financeiras"] });
      toast.success("Categoria atualizada!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar", { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("categorias_financeiras")
        .update({ ativo: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias-financeiras"] });
      toast.success("Categoria removida!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao remover", { description: error.message });
    },
  });

  const categoriasEntrada = categorias.filter(c => c.tipo === "entrada" || c.tipo === "ambos");
  const categoriasSaida = categorias.filter(c => c.tipo === "saida" || c.tipo === "ambos");

  return {
    categorias,
    categoriasEntrada,
    categoriasSaida,
    isLoading,
    createCategoria: createMutation.mutate,
    updateCategoria: updateMutation.mutate,
    deleteCategoria: deleteMutation.mutate,
  };
}
