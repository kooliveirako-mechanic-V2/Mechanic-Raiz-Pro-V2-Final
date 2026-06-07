import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";
import { humanizeError } from "@/lib/errorHandling";
import { guardAddItemOS } from "@/lib/runtimeGuards";

/**
 * Recalculates valor_servico and lucro on the OS record
 * based on the sum of all itens_os for that OS.
 * This is the ROOT-CAUSE fix: these totals must always reflect actual items.
 */
// recalcOSTotals is now handled automatically by the database trigger
// tg_recalcular_totais_os — no client-side recalc needed

export interface ItemOS {
  id: string;
  ordem_servico_id: string;
  estoque_id: string | null;
  nome_item: string;
  tipo: "servico" | "produto";
  quantidade: number;
  valor_unitario: number;
  valor_mao_obra: number;
  valor_total: number;
  custo_unitario: number;
  created_at: string;
  // Para itens do estoque
  estoque?: {
    id: string;
    nome: string;
    preco_venda: number;
    custo_unitario: number;
  } | null;
}

export interface ItemOSInput {
  ordem_servico_id: string;
  estoque_id?: string | null;
  nome_item: string;
  tipo?: "servico" | "produto";
  quantidade: number;
  valor_unitario: number;
  valor_mao_obra?: number;
  custo_unitario?: number;
}

export function useItensOS(ordemServicoId: string | undefined) {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();

  const { data: itens = [], isLoading, error } = useQuery({
    queryKey: ["itens_os", ordemServicoId],
    queryFn: async () => {
      if (!ordemServicoId) return [];

      const { data, error } = await supabase
        .from("itens_os")
        .select(`
          *,
          estoque:estoque_id(id, nome, preco_venda, custo_unitario)
        `)
        .eq("ordem_servico_id", ordemServicoId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as ItemOS[];
    },
    enabled: !!ordemServicoId,
  });

  const addItem = useMutation({
    mutationFn: async (input: ItemOSInput) => {
      // NÍVEL 5: Guard pré-mutação
      guardAddItemOS({
        ordem_servico_id: input.ordem_servico_id,
        nome_item: input.nome_item,
        quantidade: input.quantidade,
        valor_unitario: input.valor_unitario,
      });

      // CAUSA RAIZ: Verificar estoque ANTES de inserir (validação apenas)
      // A BAIXA real do estoque acontece no trigger baixar_estoque_os ao FINALIZAR a OS.
      // NÃO decrementar aqui para evitar dedução dupla.
      if (input.estoque_id && input.quantidade > 0) {
        const { data: est } = await supabase
          .from("estoque")
          .select("quantidade")
          .eq("id", input.estoque_id)
          .single();

        if (est && est.quantidade < input.quantidade) {
          throw new Error(
            `Estoque insuficiente: disponível ${est.quantidade}, solicitado ${input.quantidade}`
          );
        }
      }

      const maoObra = input.valor_mao_obra || 0;
      const tipoFinal: "servico" | "produto" =
        input.tipo ?? (input.estoque_id ? "produto" : "servico");

      const { data, error } = await supabase
        .from("itens_os")
        .insert({
          ordem_servico_id: input.ordem_servico_id,
          estoque_id: input.estoque_id || null,
          nome_item: input.nome_item,
          tipo: tipoFinal,
          quantidade: input.quantidade,
          valor_unitario: input.valor_unitario,
          valor_mao_obra: maoObra,
          custo_unitario: input.custo_unitario ?? 0,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // NÃO decrementar estoque aqui — o trigger baixar_estoque_os faz isso ao finalizar

      return data;
    },
    onSuccess: async () => {
      // Totals are auto-recalculated by database trigger tg_recalcular_totais_os
      queryClient.invalidateQueries({ queryKey: ["itens_os", ordemServicoId] });
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
      toast.success("Item adicionado à OS");
    },
    onError: (error) => {
      const errorInfo = humanizeError(error);
      toast.error(errorInfo.message, {
        description: errorInfo.description,
      });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ItemOSInput> & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      if (input.nome_item !== undefined) updateData.nome_item = input.nome_item;
      if (input.quantidade !== undefined) updateData.quantidade = input.quantidade;
      if (input.valor_unitario !== undefined) updateData.valor_unitario = input.valor_unitario;
      if ((input as any).valor_mao_obra !== undefined) updateData.valor_mao_obra = (input as any).valor_mao_obra;
      if (input.custo_unitario !== undefined) updateData.custo_unitario = input.custo_unitario;
      if ((input as any).tipo !== undefined) updateData.tipo = (input as any).tipo;

      const { data, error } = await supabase
        .from("itens_os")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // NÃO ajustar estoque aqui — o trigger baixar_estoque_os cuida da baixa ao finalizar

      return data;
    },
    onSuccess: async () => {
      // Totals are auto-recalculated by database trigger tg_recalcular_totais_os
      queryClient.invalidateQueries({ queryKey: ["itens_os", ordemServicoId] });
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
      toast.success("Item atualizado");
    },
    onError: (error) => {
      const errorInfo = humanizeError(error);
      toast.error(errorInfo.message, {
        description: errorInfo.description,
      });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      if (!oficinaAtual) throw new Error("Nenhuma oficina selecionada");

      // ARQUITETURA ATÔMICA: Usa RPC server-side para garantir que
      // restauração de estoque + exclusão + recálculo de totais
      // aconteçam em uma única transação
      const { data, error } = await supabase.rpc("deletar_item_os_atomic" as any, {
        p_item_id: id,
        p_oficina_id: oficinaAtual.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      // Totals are auto-recalculated by database trigger + RPC
      queryClient.invalidateQueries({ queryKey: ["itens_os", ordemServicoId] });
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
      toast.success("Item removido");
    },
    onError: (error) => {
      const errorInfo = humanizeError(error);
      toast.error(errorInfo.message, {
        description: errorInfo.description,
      });
    },
  });

  // Totalizadores
  const totalItens = itens.reduce((acc, item) => acc + (item.valor_total ?? ((item.quantidade * (item.valor_unitario || 0)) + (item.valor_mao_obra || 0))), 0);

  // Flag: any linked estoque item without custo_unitario means profit is incomplete
  const lucroIncompleto = itens.some(
    (item) => item.estoque_id && (!item.estoque || !(item.estoque as any).custo_unitario)
  );

  return {
    itens,
    isLoading,
    error,
    addItem,
    updateItem,
    deleteItem,
    totalItens,
    lucroIncompleto,
  };
}
