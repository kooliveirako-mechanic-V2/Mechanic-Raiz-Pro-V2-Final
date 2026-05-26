import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";

export interface Notificacao {
  id: string;
  oficina_id: string;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  lida: boolean;
  data: string;
  referencia_id: string | null;
  referencia_tipo: string | null;
  created_at: string;
}

export function useNotificacoes() {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();

  const { data: notificacoes = [], isLoading, error } = useQuery({
    queryKey: ["notificacoes", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      
      const { data, error } = await supabase
        .from("notificacoes")
        .select("*")
        .eq("oficina_id", oficinaAtual.id)
        .neq("tipo", "funnel_event")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      return data as Notificacao[];
    },
    enabled: !!oficinaAtual,
  });

  const marcarComoLida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
    },
  });

  const marcarTodasComoLidas = useMutation({
    mutationFn: async () => {
      if (!oficinaAtual) return;
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida: true })
        .eq("oficina_id", oficinaAtual.id)
        .eq("lida", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
      toast.success("Todas as notificações marcadas como lidas");
    },
  });

  const deletarNotificacao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notificacoes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
      toast.success("Notificação removida");
    },
  });

  const naoLidas = notificacoes.filter((n) => !n.lida);
  const countNaoLidas = naoLidas.length;

  return {
    notificacoes,
    naoLidas,
    countNaoLidas,
    isLoading,
    error,
    marcarComoLida,
    marcarTodasComoLidas,
    deletarNotificacao,
  };
}
