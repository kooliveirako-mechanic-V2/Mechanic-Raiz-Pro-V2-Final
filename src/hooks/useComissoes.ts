import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";

export interface ComissaoFuncionario {
  id: string;
  oficina_id: string;
  user_id: string;
  percentual: number;
  ativo: boolean;
}

export function useComissoes() {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();

  const { data: comissoes = [], isLoading } = useQuery({
    queryKey: ["comissoes", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      const { data, error } = await supabase
        .from("comissoes_funcionarios" as any)
        .select("*")
        .eq("oficina_id", oficinaAtual.id)
        .eq("ativo", true);
      if (error) throw error;
      return (data || []) as unknown as ComissaoFuncionario[];
    },
    enabled: !!oficinaAtual,
  });

  const upsertComissao = useMutation({
    mutationFn: async ({ user_id, percentual }: { user_id: string; percentual: number }) => {
      if (!oficinaAtual) throw new Error("Oficina não selecionada");
      
      // Check if exists
      const { data: existing } = await supabase
        .from("comissoes_funcionarios" as any)
        .select("id")
        .eq("oficina_id", oficinaAtual.id)
        .eq("user_id", user_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("comissoes_funcionarios" as any)
          .update({ percentual, ativo: true, updated_at: new Date().toISOString() })
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("comissoes_funcionarios" as any)
          .insert({ oficina_id: oficinaAtual.id, user_id, percentual });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comissoes"] });
      toast.success("Comissão atualizada!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao salvar comissão", { description: err.message });
    },
  });

  // Get commission totals for current month
  const { data: comissoesDoMes = [] } = useQuery({
    queryKey: ["comissoes-mes", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      const inicioMes = new Date();
      inicioMes.setDate(1);
      const inicio = inicioMes.toISOString().split("T")[0];
      
      const { data, error } = await supabase
        .from("financeiro")
        .select("descricao, valor, data, status")
        .eq("oficina_id", oficinaAtual.id)
        .eq("tipo", "saida")
        .eq("origem", "Comissão")
        .gte("data", inicio);
      if (error) throw error;
      return data || [];
    },
    enabled: !!oficinaAtual,
    staleTime: 60_000,
  });

  return {
    comissoes,
    isLoading,
    upsertComissao,
    comissoesDoMes,
  };
}
