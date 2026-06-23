import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rpcWithRetry } from "@/lib/rpcWithRetry";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";
import { humanizeError, logBusinessEvent } from "@/lib/errorHandling";
import { CriarVendaBalcaoResult, castRpcResult } from "@/lib/rpcTypes";

export interface VendaBalcaoItemInput {
  estoque_id?: string | null;
  nome_item: string;
  quantidade: number;
  valor_unitario: number;
  custo_unitario?: number;
}

export interface CriarVendaBalcaoInput {
  itens: VendaBalcaoItemInput[];
  forma_pagamento: string;
  forma_pagamento_id?: string | null;
  cliente_id?: string | null;
  observacao?: string | null;
}

export interface VendaBalcao {
  id: string;
  oficina_id: string;
  numero: number;
  cliente_id: string | null;
  forma_pagamento: string | null;
  forma_pagamento_id: string | null;
  valor_total: number;
  observacao: string | null;
  status: "concluida" | "cancelada";
  financeiro_id: string | null;
  created_at: string;
}

export interface ItemVendaBalcao {
  id: string;
  venda_id: string;
  estoque_id: string | null;
  nome_item: string;
  quantidade: number;
  valor_unitario: number;
  custo_unitario: number;
  valor_total: number;
}

export function useVendasBalcao() {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();

  const vendasQuery = useQuery({
    queryKey: ["vendas-balcao", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      const { data, error } = await supabase
        .from("vendas_balcao" as any)
        .select("*, itens:itens_venda_balcao(*), cliente:clientes(nome)")
        .eq("oficina_id", oficinaAtual.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!oficinaAtual,
  });

  const criarVenda = useMutation({
    mutationFn: async (input: CriarVendaBalcaoInput): Promise<CriarVendaBalcaoResult> => {
      if (!oficinaAtual) throw new Error("Nenhuma oficina selecionada");

      const itensPayload = input.itens.map((it) => ({
        estoque_id: it.estoque_id || null,
        nome_item: it.nome_item,
        quantidade: it.quantidade,
        valor_unitario: it.valor_unitario,
        custo_unitario: it.custo_unitario ?? 0,
      }));

      const { data, error } = await rpcWithRetry("criar_venda_balcao", {
        p_oficina_id: oficinaAtual.id,
        p_itens: itensPayload,
        p_forma_pagamento: input.forma_pagamento || "Dinheiro",
        p_forma_pagamento_id: input.forma_pagamento_id || null,
        p_cliente_id: input.cliente_id || null,
        p_observacao: input.observacao || null,
      });

      if (error) throw error;
      const result = castRpcResult<CriarVendaBalcaoResult>(data);
      if (!result?.success) {
        throw new Error("Falha ao registrar venda");
      }
      return result;
    },
    onSuccess: (result) => {
      logBusinessEvent("venda_balcao_criada", {
        numero: result.numero,
        valor: result.valor_total,
        itens: result.itens,
      });
      queryClient.invalidateQueries({ queryKey: ["vendas-balcao", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["estoque", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
    },
    onError: (error) => {
      const info = humanizeError(error);
      toast.error(info.message, { description: info.description });
    },
  });

  return {
    vendas: vendasQuery.data || [],
    isLoading: vendasQuery.isLoading,
    criarVenda,
  };
}
