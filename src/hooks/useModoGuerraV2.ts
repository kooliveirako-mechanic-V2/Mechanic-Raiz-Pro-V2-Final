import { useQuery } from "@tanstack/react-query";
import { useOficina } from "@/contexts/OficinaContext";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { financeiroV2Service } from "@/services/financeiroV2Service";
import { FEATURE_FLAGS_V2 } from "@/config/featureFlagsV2";

/**
 * Hook para Modo Guerra V2 - PORTÃO 7.
 * Consome exclusivamente o motor financeiro V2.
 * Painel de alertas gerenciais (Somente Leitura).
 */
export function useModoGuerraV2() {
  const { oficinaAtual } = useOficina();

  const query = useQuery({
    queryKey: ["financeiro-v2-modoguerra", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual?.id) return null;
      
      const inicio = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const fim = format(endOfMonth(new Date()), "yyyy-MM-dd");
      
      return await financeiroV2Service.getMetrics(oficinaAtual.id, inicio, fim);
    },
    enabled: !!oficinaAtual?.id,
    staleTime: 30000,
  });

  // Injetar auditoria se modo limpo estiver ativo
  const metrics = query.data;
  const auditoriaLimpa = (metrics as any)?.modo === "preview_limpeza_logica" ? {
    isModoLimpo: true,
    registrosIgnorados: (metrics as any).auditoria?.registros_ignorados_por_manifesto || []
  } : { isModoLimpo: false, registrosIgnorados: [] };

  return {
    ...query,
    auditoriaLimpa
  };
}