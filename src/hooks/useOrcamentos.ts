import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rpcWithRetry } from "@/lib/rpcWithRetry";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";
import { withRetry, humanizeError } from "@/lib/errorHandling";

export type StatusOrcamento = "rascunho" | "enviado" | "aprovado" | "rejeitado" | "convertido";

export interface ItemOrcamento {
  id: string;
  orcamento_id: string;
  estoque_id: string | null;
  nome_item: string;
  tipo: "produto" | "servico";
  quantidade: number;
  valor_unitario: number;
  custo_unitario: number;
  valor_mao_obra: number;
  valor_total: number;
  created_at: string;
}

export interface Orcamento {
  id: string;
  oficina_id: string;
  cliente_id: string | null;
  veiculo_id: string | null;
  numero: number;
  titulo: string;
  descricao: string | null;
  status: StatusOrcamento;
  validade: string | null;
  valor_total: number;
  custo_total: number;
  desconto: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  cliente?: { id: string; nome: string; telefone: string | null } | null;
  veiculo?: { id: string; marca: string; modelo: string; placa: string | null } | null;
  itens?: ItemOrcamento[];
}

export interface OrcamentoInput {
  titulo: string;
  descricao?: string;
  cliente_id?: string;
  veiculo_id?: string;
  validade?: string;
  desconto?: number;
  observacoes?: string;
}

export interface ItemOrcamentoInput {
  orcamento_id: string;
  estoque_id?: string;
  nome_item: string;
  tipo: "produto" | "servico";
  quantidade: number;
  valor_unitario: number;
  custo_unitario: number;
  valor_mao_obra?: number;
}

export function useOrcamentos() {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();

  const { data: orcamentos = [], isLoading, error } = useQuery({
    queryKey: ["orcamentos", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];

      return withRetry(async () => {
        const { data, error } = await supabase
          .from("orcamentos")
          .select(`
            *,
            cliente:clientes(id, nome, telefone),
            veiculo:veiculos(id, marca, modelo, placa)
          `)
          .eq("oficina_id", oficinaAtual.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return data as Orcamento[];
      });
    },
    enabled: !!oficinaAtual,
  });

  const createOrcamento = useMutation({
    mutationFn: async (input: OrcamentoInput) => {
      if (!oficinaAtual) throw new Error("Nenhuma oficina selecionada");

      const { data, error } = await supabase
        .from("orcamentos")
        .insert({
          oficina_id: oficinaAtual.id,
          titulo: input.titulo,
          descricao: input.descricao || null,
          cliente_id: input.cliente_id || null,
          veiculo_id: input.veiculo_id || null,
          validade: input.validade || null,
          desconto: input.desconto || 0,
          observacoes: input.observacoes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos", oficinaAtual?.id] });
      toast.success("Orçamento criado com sucesso!");
    },
    onError: (error) => {
     console.error("[Orçamento] Erro ao criar:", error);
      const humanized = humanizeError(error);
      toast.error(humanized.message, { description: humanized.description });
    },
  });

  const updateOrcamento = useMutation({
    mutationFn: async ({ id, ...input }: OrcamentoInput & { id: string; status?: StatusOrcamento }) => {
      const updateData: Record<string, any> = {
        titulo: input.titulo,
        descricao: input.descricao || null,
        cliente_id: input.cliente_id || null,
        veiculo_id: input.veiculo_id || null,
        validade: input.validade || null,
        desconto: input.desconto || 0,
        observacoes: input.observacoes || null,
      };

     if ((input as any).status) {
       updateData.status = (input as any).status;
      }

      const { data, error } = await supabase
        .from("orcamentos")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos", oficinaAtual?.id] });
      toast.success("Orçamento atualizado!");
    },
    onError: (error) => {
      const humanized = humanizeError(error);
      toast.error(humanized.message, { description: humanized.description });
    },
  });

  const deleteOrcamento = useMutation({
    mutationFn: async (id: string) => {
      // HARDENING TRANSACIONAL: Usa RPC server-side para atomicidade
      // Delete itens + parcelas + pagamentos + orçamento em transação única
      const { data, error } = await rpcWithRetry("atomic_delete_orcamento", {
        p_orcamento_id: id,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || "Falha ao excluir orçamento");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["parcelas"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-resumo", oficinaAtual?.id] });
      toast.success("Orçamento excluído!");
    },
    onError: (error) => {
      const humanized = humanizeError(error);
      toast.error(humanized.message, { description: humanized.description });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusOrcamento }) => {
      const { error } = await supabase
        .from("orcamentos")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos", oficinaAtual?.id] });
      toast.success("Status atualizado!");
    },
    onError: (error) => {
      const humanized = humanizeError(error);
      toast.error(humanized.message, { description: humanized.description });
    },
  });

  // Recalculate totals — now delegated to server-side trigger
  // tg_recalcular_totais_orcamento fires automatically on itens_orcamento changes
  // This mutation is kept for manual recalc (e.g. after bulk operations)
  const recalcularTotais = useMutation({
    mutationFn: async (orcamentoId: string) => {
      const { error } = await rpcWithRetry("recalcular_totais_orcamento", {
        p_orcamento_id: orcamentoId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos", oficinaAtual?.id] });
    },
    onError: (error) => {
      const humanized = humanizeError(error);
      toast.error(humanized.message, { description: humanized.description });
    },
  });

  return {
    orcamentos,
    isLoading,
    error,
    createOrcamento,
    updateOrcamento,
    deleteOrcamento,
    updateStatus,
    recalcularTotais,
  };
}

export function useItensOrcamento(orcamentoId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: itens = [], isLoading, error } = useQuery({
    queryKey: ["itens_orcamento", orcamentoId],
    queryFn: async () => {
      if (!orcamentoId) return [];

      const { data, error } = await supabase
        .from("itens_orcamento")
        .select("*")
        .eq("orcamento_id", orcamentoId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as ItemOrcamento[];
    },
    enabled: !!orcamentoId,
  });

  const addItem = useMutation({
    mutationFn: async (input: ItemOrcamentoInput) => {
      const maoObra = input.valor_mao_obra || 0;

      const { data, error } = await supabase
        .from("itens_orcamento")
        .insert({
          orcamento_id: input.orcamento_id,
          estoque_id: input.estoque_id || null,
          nome_item: input.nome_item,
          tipo: input.tipo,
          quantidade: input.quantidade,
          valor_unitario: input.valor_unitario,
          custo_unitario: input.custo_unitario,
          valor_mao_obra: maoObra,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itens_orcamento", orcamentoId] });
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
    },
    onError: (error) => {
      const humanized = humanizeError(error);
      toast.error(humanized.message, { description: humanized.description });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ItemOrcamentoInput> & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      if (input.nome_item !== undefined) updateData.nome_item = input.nome_item;
      if (input.tipo !== undefined) updateData.tipo = input.tipo;
      if (input.quantidade !== undefined) updateData.quantidade = input.quantidade;
      if (input.valor_unitario !== undefined) updateData.valor_unitario = input.valor_unitario;
      if (input.custo_unitario !== undefined) updateData.custo_unitario = input.custo_unitario;
      if (input.valor_mao_obra !== undefined) updateData.valor_mao_obra = input.valor_mao_obra;

      const { error } = await supabase
        .from("itens_orcamento")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itens_orcamento", orcamentoId] });
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
    },
    onError: (error) => {
      const humanized = humanizeError(error);
      toast.error(humanized.message, { description: humanized.description });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("itens_orcamento")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itens_orcamento", orcamentoId] });
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
    },
    onError: (error) => {
      const humanized = humanizeError(error);
      toast.error(humanized.message, { description: humanized.description });
    },
  });

  const valorTotal = itens.reduce((acc, item) => acc + (item.valor_total ?? ((item.quantidade || 0) * (item.valor_unitario || 0))), 0);
  const custoTotal = itens.reduce((acc, item) => acc + ((item.custo_unitario || 0) * item.quantidade), 0);

  return {
    itens,
    isLoading,
    error,
    addItem,
    updateItem,
    removeItem,
    valorTotal,
    custoTotal,
  };
}
