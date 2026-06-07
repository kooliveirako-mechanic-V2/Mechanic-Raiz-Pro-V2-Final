import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { format } from "date-fns";

/**
 * PERF FIX: Lightweight badge counter for BottomNav.
 * Previously called useDashboard() which triggered 9+ financeiro queries on EVERY page.
 * Now uses a single lightweight query that only fetches badge counts.
 */
export function useMobileAlertBadges() {
  const { oficinaAtual } = useOficina();

  const { data } = useQuery({
    queryKey: ["mobile-alert-badges", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return { inicioCount: 0, financeiroCount: 0, estoqueCount: 0 };

      const hoje = format(new Date(), "yyyy-MM-dd");

      // Single parallel fetch for all badge data
      const [notificacoes, parcelas, estoque] = await Promise.all([
        // Unread notifications count
        supabase
          .from("notificacoes")
          .select("id", { count: "exact", head: true })
          .eq("oficina_id", oficinaAtual.id)
          .eq("lida", false),

        // Overdue parcels count
        supabase
          .from("parcelas_pagamento")
          .select("id", { count: "exact", head: true })
          .eq("oficina_id", oficinaAtual.id)
          .eq("status", "atrasado"),

        // Low stock items
        supabase
          .from("estoque")
          .select("id, quantidade, alerta_minimo")
          .eq("oficina_id", oficinaAtual.id)
          .eq("arquivado", false),
      ]);

      const estoqueBaixo = estoque.data?.filter(
        (item) => item.quantidade <= (item.alerta_minimo || 5)
      ).length || 0;

      return {
        inicioCount: notificacoes.count || 0,
        financeiroCount: parcelas.count || 0,
        estoqueCount: estoqueBaixo,
      };
    },
    enabled: !!oficinaAtual,
    staleTime: 30000, // Cache 30s
    refetchInterval: 60000, // Refresh every 1 min
  });

  return {
    inicioCount: data?.inicioCount || 0,
    financeiroCount: data?.financeiroCount || 0,
    estoqueCount: data?.estoqueCount || 0,
    totalAlerts: (data?.inicioCount || 0) + (data?.financeiroCount || 0) + (data?.estoqueCount || 0),
  };
}
