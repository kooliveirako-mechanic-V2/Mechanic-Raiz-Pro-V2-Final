import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";
import { humanizeError } from "@/lib/errorHandling";

export interface TipoServicoOficina {
  id: string;
  oficina_id: string;
  nome: string;
  created_at: string;
}

export function useTiposServicoOficina() {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();
  const queryKey = ["tipos_servico_oficina", oficinaAtual?.id];

  const { data: tipos = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!oficinaAtual) return [];
      const { data, error } = await supabase
        .from("tipos_servico_oficina" as any)
        .select("*")
        .eq("oficina_id", oficinaAtual.id)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as TipoServicoOficina[];
    },
    enabled: !!oficinaAtual,
  });

  const create = useMutation({
    mutationFn: async (nome: string) => {
      if (!oficinaAtual) throw new Error("Sem oficina");
      const trimmed = nome.trim();
      if (!trimmed) throw new Error("Nome vazio");
      const { error } = await supabase
        .from("tipos_servico_oficina" as any)
        .insert({ oficina_id: oficinaAtual.id, nome: trimmed });
      if (error && !String(error.message).includes("duplicate")) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (e) => {
      const er = humanizeError(e);
      toast.error(er.message, { description: er.description });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tipos_servico_oficina" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Tipo de serviço removido");
    },
    onError: (e) => {
      const er = humanizeError(e);
      toast.error(er.message, { description: er.description });
    },
  });

  return { tipos, isLoading, create, remove };
}
