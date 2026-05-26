import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";

interface AuditLog {
  id: string;
  oficina_id: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export function useAuditLogs(limit = 50) {
  const { oficinaAtual } = useOficina();

  const { data: logs, isLoading, error } = useQuery({
    queryKey: ["audit-logs", oficinaAtual?.id, limit],
    queryFn: async () => {
      if (!oficinaAtual) return [];

      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("oficina_id", oficinaAtual.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: !!oficinaAtual,
  });

  return {
    logs: logs || [],
    isLoading,
    error,
  };
}
