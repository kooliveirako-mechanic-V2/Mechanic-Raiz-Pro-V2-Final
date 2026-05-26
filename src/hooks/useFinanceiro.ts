import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";
import { humanizeError, withRetry, logBusinessEvent } from "@/lib/errorHandling";

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

interface FinanceiroResumo {
  registros: Financeiro[];
  mes_atual: { entradas: number; saidas: number };
  mes_anterior: { entradas: number; saidas: number };
  mensal: Array<{ mes: string; entradas: number; saidas: number }>;
}

/**
 * Hook consolidado que usa a RPC get_financeiro_resumo para buscar
 * TODOS os dados financeiros em uma única chamada, eliminando N+1.
 * 
 * Dados retornados:
 * - registros: últimos 2 meses de lançamentos
 * - mes_atual/mes_anterior: totais computados no servidor
 * - mensal: breakdown dos últimos 6 meses para gráficos
 */
export function useFinanceiro() {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();

  const { data: resumo, isLoading, error } = useQuery({
    queryKey: ["financeiro-resumo", oficinaAtual?.id],
    queryFn: async (): Promise<FinanceiroResumo> => {
      if (!oficinaAtual) {
        return { registros: [], mes_atual: { entradas: 0, saidas: 0 }, mes_anterior: { entradas: 0, saidas: 0 }, mensal: [] };
      }

      const { data, error } = await supabase.rpc("get_financeiro_resumo", {
        p_oficina_id: oficinaAtual.id,
        p_meses_historico: 6,
      });

      if (error) throw error;
      return data as unknown as FinanceiroResumo;
    },
    enabled: !!oficinaAtual,
    staleTime: 30_000, // 30s — evita refetches desnecessários
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
      queryClient.invalidateQueries({ queryKey: ["financeiro-resumo", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Lançamento excluído com sucesso!");
      logBusinessEvent("financeiro_excluido", { id });
    },
    onError: (error: Error) => {
      const errorInfo = humanizeError(error);
      toast.error(errorInfo.message, { description: errorInfo.description });
    },
  });

  const registros = resumo?.registros ?? [];
  const totalEntradas = resumo?.mes_atual?.entradas ?? 0;
  const totalSaidas = resumo?.mes_atual?.saidas ?? 0;
  const lucroTotal = totalEntradas - totalSaidas;

  const entradasMesAnterior = resumo?.mes_anterior?.entradas ?? 0;
  const percentualMudanca = entradasMesAnterior > 0
    ? Math.round(((totalEntradas - entradasMesAnterior) / entradasMesAnterior) * 100)
    : totalEntradas > 0 ? 100 : 0;

  const entradas = registros.filter((r) => r.tipo === "entrada");
  const saidas = registros.filter((r) => r.tipo === "saida");

  return {
    registros,
    entradas,
    saidas,
    totalEntradas,
    totalSaidas,
    lucroTotal,
    percentualMudanca,
    // Dados para gráficos (compartilhados com dashboard)
    mensalBreakdown: resumo?.mensal ?? [],
    isLoading,
    error,
    deleteRegistro: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
