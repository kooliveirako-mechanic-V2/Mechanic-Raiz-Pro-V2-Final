import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";
import { humanizeError, withRetry, logBusinessEvent } from "@/lib/errorHandling";
import { getUnifiedMetrics } from "@/services/financeiroService";
import { format, startOfMonth, endOfMonth } from "date-fns";

export type TipoFinanceiro = "entrada" | "saida";

export interface Financeiro {
  id: string;
  oficina_id: string;
  tipo: TipoFinanceiro;
  origem: string;
  ordem_servico_id: string | null;
  valor: number;
  data: string;
  descricao: string | null;
  created_at: string;
  status?: string | null;
  categoria_id?: string | null;
  forma_pagamento_id?: string | null;
  fornecedor_id?: string | null;
  centro_custo_id?: string | null;
  classificacao?: string | null;
  numero_documento?: string | null;
  data_competencia?: string | null;
  data_pagamento?: string | null;
  recorrente?: boolean | null;
  recorrencia_tipo?: string | null;
  observacoes_contador?: string | null;
  comprovante_url?: string | null;
}

export function useFinanceiro() {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();

  // 1. Listagem bruta (continua vindo da tabela, mas com RLS)
  const { data: registros = [], isLoading: listLoading, error: listError } = useQuery({
    queryKey: ["financeiro-list", oficinaAtual?.id],
    queryFn: async (): Promise<Financeiro[]> => {
      if (!oficinaAtual) return [];
      const { data, error } = await supabase
        .from("financeiro")
        .select("*")
        .eq("oficina_id", oficinaAtual.id)
        .order("data", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as Financeiro[];
    },
    enabled: !!oficinaAtual,
  });

  // 2. TOTAIS OFICIAIS (Vem da RPC de Métricas Unificadas)
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["financeiro-unificado-atual", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return null;
      const inicio = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const fim = format(endOfMonth(new Date()), "yyyy-MM-dd");
      return await getUnifiedMetrics({
        oficinaId: oficinaAtual.id,
        inicio,
        fim,
      });
    },
    enabled: !!oficinaAtual,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await withRetry(
        async () => {
          const { error } = await supabase
            .from("financeiro")
            .delete()
            .eq("id", id);
          if (error) throw error;
        },
        { maxRetries: 2, delay: 1000 }
      );
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["financeiro-list", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-unificado-atual"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Lançamento excluído com sucesso!");
      logBusinessEvent("financeiro_excluido", { id });
    },
    onError: (error: Error) => {
      const errorInfo = humanizeError(error);
      toast.error(errorInfo.message, { description: errorInfo.description });
    },
  });

  const totalEntradas = metrics?.caixa.entradas_oficina_periodo ?? 0;
  const totalSaidas = metrics?.caixa.saidas_oficina_periodo ?? 0;
  const lucroTotal = metrics?.caixa.lucro_caixa_oficina_periodo ?? 0;

  return {
    registros,
    totalEntradas,
    totalSaidas,
    lucroTotal,
    isLoading: listLoading || metricsLoading,
    error: listError,
    deleteRegistro: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}