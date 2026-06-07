import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { format } from "date-fns";

export interface SidebarData {
  servicosAtrasados: number;
  estoqueBaixo: number;
  notificacoesNaoLidas: number;
  solicitacoesPendentes: number;
}

export function useSidebarData() {
  const { oficinaAtual } = useOficina();

  const { data, isLoading } = useQuery({
    queryKey: ["sidebar-data", oficinaAtual?.id],
    queryFn: async (): Promise<SidebarData> => {
      if (!oficinaAtual) {
        return {
          servicosAtrasados: 0,
          estoqueBaixo: 0,
          notificacoesNaoLidas: 0,
          solicitacoesPendentes: 0,
        };
      }

      const hoje = format(new Date(), "yyyy-MM-dd");

      const { count: servicosAtrasados } = await supabase
        .from("ordens_servico")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", oficinaAtual.id)
        .in("status", ["pendente", "em_andamento"])
        .lt("data_servico", hoje);

      const { data: estoqueData } = await supabase
        .from("estoque")
        .select("id, quantidade, alerta_minimo")
        .eq("oficina_id", oficinaAtual.id)
        .eq("arquivado", false);

      const estoqueBaixo = estoqueData?.filter(
        (item) => item.quantidade <= (item.alerta_minimo || 5)
      ).length || 0;

      const { count: notificacoesNaoLidas } = await supabase
        .from("notificacoes")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", oficinaAtual.id)
        .eq("lida", false);

      const { count: solicitacoesPendentes } = await supabase
        .from("solicitacoes_agendamento" as any)
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", oficinaAtual.id)
        .eq("status", "pendente");

      return {
        servicosAtrasados: servicosAtrasados || 0,
        estoqueBaixo,
        notificacoesNaoLidas: notificacoesNaoLidas || 0,
        solicitacoesPendentes: solicitacoesPendentes || 0,
      };
    },
    enabled: !!oficinaAtual,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  return {
    data: data || {
      servicosAtrasados: 0,
      estoqueBaixo: 0,
      notificacoesNaoLidas: 0,
      solicitacoesPendentes: 0,
    },
    isLoading,
  };
}
