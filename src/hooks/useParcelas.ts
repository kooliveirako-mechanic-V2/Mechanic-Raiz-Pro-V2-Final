import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";
import { humanizeError, withRetry } from "@/lib/errorHandling";
import { addDays } from "date-fns";

export type StatusParcela = "pendente" | "pago" | "atrasado" | "cancelado";

export interface Parcela {
  id: string;
  oficina_id: string;
  ordem_servico_id: string | null;
  orcamento_id: string | null;
  numero_parcela: number;
  total_parcelas: number;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: StatusParcela;
  forma_pagamento_id: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParcelaInput {
  ordem_servico_id?: string | null;
  orcamento_id?: string | null;
  numero_parcela: number;
  total_parcelas: number;
  valor: number;
  data_vencimento: string;
  forma_pagamento_id?: string | null;
  observacoes?: string | null;
}

export interface GerarParcelasInput {
  ordem_servico_id?: string;
  orcamento_id?: string;
  valor_total: number;
  numero_parcelas: number;
  data_primeira_parcela: string;
  intervalo_dias?: number; // default 30
  forma_pagamento_id?: string;
}

export function useParcelas(ordemServicoId?: string, orcamentoId?: string) {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();

  const queryKey = ["parcelas", oficinaAtual?.id, ordemServicoId, orcamentoId];

  const { data: parcelas = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!oficinaAtual) return [];

      let query = supabase
        .from("parcelas_pagamento")
        .select("*")
        .eq("oficina_id", oficinaAtual.id)
        .order("numero_parcela", { ascending: true });

      if (ordemServicoId) {
        query = query.eq("ordem_servico_id", ordemServicoId);
      }
      if (orcamentoId) {
        query = query.eq("orcamento_id", orcamentoId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // CAUSA RAIZ: Derivar status "atrasado" em tempo real
      // Parcelas com status "pendente" cuja data_vencimento já passou
      const hoje = new Date().toISOString().split("T")[0];
      return (data || []).map((p) => ({
        ...p,
        status: p.status === "pendente" && p.data_vencimento < hoje ? "atrasado" : p.status,
      })) as Parcela[];
    },
    enabled: !!oficinaAtual && (!!ordemServicoId || !!orcamentoId),
  });

  // Gerar parcelas — agora via RPC atômica com idempotência
  const gerarParcelas = useMutation({
    mutationFn: async (input: GerarParcelasInput) => {
      if (!oficinaAtual) throw new Error("Nenhuma oficina selecionada");

      const { data, error } = await supabase.rpc("gerar_parcelas_atomic" as any, {
        p_oficina_id: oficinaAtual.id,
        p_ordem_servico_id: input.ordem_servico_id || null,
        p_orcamento_id: input.orcamento_id || null,
        p_valor_total: input.valor_total,
        p_numero_parcelas: input.numero_parcelas,
        p_data_primeira_parcela: input.data_primeira_parcela,
        p_intervalo_dias: input.intervalo_dias || 30,
        p_forma_pagamento_id: input.forma_pagamento_id || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(`${data.parcelas_geradas} parcela(s) gerada(s) com sucesso!`);
    },
    onError: (error) => {
      const errorInfo = humanizeError(error);
      toast.error(errorInfo.message, { description: errorInfo.description });
    },
  });

  // Marcar parcela como paga
  const marcarComoPago = useMutation({
    mutationFn: async ({
      id,
      data_pagamento,
    }: {
      id: string;
      data_pagamento?: string;
    }) => {
      return await withRetry(
        async () => {
          const { data, error } = await supabase
            .from("parcelas_pagamento")
            .update({
              status: "pago",
              data_pagamento: data_pagamento || new Date().toISOString().split("T")[0],
            })
            .eq("id", id)
            .select()
            .single();

          if (error) throw error;
          return data;
        },
        { maxRetries: 2, delay: 1000 }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["financeiro-resumo", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      const errorInfo = humanizeError(error);
      toast.error(errorInfo.message, { description: errorInfo.description });
    },
  });

  // Cancelar parcela
  const cancelarParcela = useMutation({
    mutationFn: async (id: string) => {
      return await withRetry(
        async () => {
          const { data, error } = await supabase
            .from("parcelas_pagamento")
            .update({ status: "cancelado" })
            .eq("id", id)
            .select()
            .single();

          if (error) throw error;
          return data;
        },
        { maxRetries: 2, delay: 1000 }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Parcela cancelada");
    },
    onError: (error) => {
      const errorInfo = humanizeError(error);
      toast.error(errorInfo.message, { description: errorInfo.description });
    },
  });

  // Deletar todas as parcelas
  const deletarParcelas = useMutation({
    mutationFn: async () => {
      if (!ordemServicoId && !orcamentoId) {
        throw new Error("Nenhuma referência para deletar");
      }

      let query = supabase.from("parcelas_pagamento").delete();

      if (ordemServicoId) {
        query = query.eq("ordem_servico_id", ordemServicoId);
      }
      if (orcamentoId) {
        query = query.eq("orcamento_id", orcamentoId);
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Parcelas removidas");
    },
    onError: (error) => {
      const errorInfo = humanizeError(error);
      toast.error(errorInfo.message, { description: errorInfo.description });
    },
  });

  // Cálculos
  const totalParcelas = parcelas.reduce((sum, p) => sum + Number(p.valor), 0);
  const totalPago = parcelas
    .filter((p) => p.status === "pago")
    .reduce((sum, p) => sum + Number(p.valor), 0);
  const totalPendente = parcelas
    .filter((p) => p.status === "pendente" || p.status === "atrasado")
    .reduce((sum, p) => sum + Number(p.valor), 0);
  const parcelasAtrasadas = parcelas.filter((p) => p.status === "atrasado");
  const parcelasPendentes = parcelas.filter((p) => p.status === "pendente");
  const parcelasPagas = parcelas.filter((p) => p.status === "pago");

  return {
    parcelas,
    isLoading,
    error,
    gerarParcelas,
    marcarComoPago,
    cancelarParcela,
    deletarParcelas,
    // Calculados
    totalParcelas,
    totalPago,
    totalPendente,
    parcelasAtrasadas,
    parcelasPendentes,
    parcelasPagas,
  };
}

// Hook para buscar todas as parcelas pendentes/atrasadas (para dashboard)
export function useParcelasPendentes() {
  const { oficinaAtual } = useOficina();

  const { data: parcelas = [], isLoading } = useQuery({
    queryKey: ["parcelas-pendentes", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];

      const { data, error } = await supabase
        .from("parcelas_pagamento")
        .select(`
          *,
          ordem_servico:ordem_servico_id (
            id,
            tipo_servico,
            cliente:clientes (nome)
          ),
          orcamento:orcamento_id (
            id,
            titulo,
            cliente:clientes (nome)
          )
        `)
        .eq("oficina_id", oficinaAtual.id)
        .in("status", ["pendente", "atrasado"])
        .order("data_vencimento", { ascending: true });

      if (error) throw error;

      // CAUSA RAIZ: Derivar status "atrasado" para pendentes vencidas
      const hoje = new Date().toISOString().split("T")[0];
      return (data || []).map((p) => ({
        ...p,
        status: p.status === "pendente" && p.data_vencimento < hoje ? "atrasado" : p.status,
      }));
    },
    enabled: !!oficinaAtual,
  });

  const atrasadas = parcelas.filter((p) => p.status === "atrasado");
  const vencendoHoje = parcelas.filter(
    (p) =>
      p.status === "pendente" &&
      p.data_vencimento === new Date().toISOString().split("T")[0]
  );

  return {
    parcelas,
    atrasadas,
    vencendoHoje,
    isLoading,
    totalPendente: parcelas.reduce((sum, p) => sum + Number(p.valor), 0),
  };
}
