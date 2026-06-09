import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";

export interface FormaPagamento {
  id: string;
  oficina_id: string;
  nome: string;
  tipo: "dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "boleto" | "transferencia" | "cheque" | "outro";
  taxa_percentual: number;
  dias_recebimento: number;
  ativo: boolean;
  padrao: boolean;
  created_at: string;
}

export function useFormasPagamento() {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();

  const { data: formasPagamento = [], isLoading } = useQuery({
    queryKey: ["formas-pagamento", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      
      const { data, error } = await supabase
        .from("formas_pagamento")
        .select("*")
        .eq("oficina_id", oficinaAtual.id)
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data as FormaPagamento[];
    },
    enabled: !!oficinaAtual,
  });

  const createMutation = useMutation({
    mutationFn: async (forma: { nome: string; tipo: FormaPagamento["tipo"]; taxa_percentual?: number; dias_recebimento?: number; padrao?: boolean }) => {
      if (!oficinaAtual) throw new Error("Oficina não selecionada");
      
      const { data, error } = await supabase
        .from("formas_pagamento")
        .insert({
          nome: forma.nome,
          tipo: forma.tipo,
          taxa_percentual: forma.taxa_percentual ?? 0,
          dias_recebimento: forma.dias_recebimento ?? 0,
          padrao: forma.padrao ?? false,
          oficina_id: oficinaAtual.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["formas-pagamento"] });
      toast.success("Forma de pagamento criada!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar", { description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FormaPagamento> & { id: string }) => {
      const { data, error } = await supabase
        .from("formas_pagamento")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["formas-pagamento"] });
      toast.success("Forma de pagamento atualizada!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar", { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("formas_pagamento")
        .update({ ativo: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["formas-pagamento"] });
      toast.success("Forma de pagamento removida!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao remover", { description: error.message });
    },
  });

  return {
    formasPagamento,
    isLoading,
    createFormaPagamento: createMutation.mutate,
    updateFormaPagamento: updateMutation.mutate,
    deleteFormaPagamento: deleteMutation.mutate,
  };
}
