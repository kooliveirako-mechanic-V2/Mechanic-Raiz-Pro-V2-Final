import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { humanizeError, withRetry, logBusinessEvent } from "@/lib/errorHandling";
import { checkAndSendAchievement, getTableCount } from "@/lib/achievements";
import { AtomicDeleteResult } from "@/lib/rpcTypes";

export interface ItemEstoque {
  id: string;
  oficina_id: string;
  nome: string;
  categoria: string;
  tipo_veiculo: "carro" | "moto" | "ambos";
  quantidade: number;
  custo_unitario: number;
  preco_venda: number;
  alerta_minimo: number;
  // Novos campos
  localizacao: string | null;
  fornecedor_nome: string | null;
  fornecedor_telefone: string | null;
  fornecedor_email: string | null;
  codigo: string | null;
  ncm: string | null;
  ultima_entrada: string | null;
  ultima_saida: string | null;
  created_at: string;
  updated_at: string;
  tipo_item: string | null;
}

export interface ItemEstoqueInput {
  nome: string;
  categoria: string;
  tipo_veiculo?: "carro" | "moto" | "ambos";
  quantidade?: number;
  custo_unitario?: number;
  preco_venda?: number;
  alerta_minimo?: number;
  // Novos campos
  localizacao?: string;
  fornecedor_nome?: string;
  fornecedor_telefone?: string;
  fornecedor_email?: string;
  codigo?: string;
  ncm?: string;
  tipo_item?: string;
}

export interface MovimentacaoEstoque {
  id: string;
  estoque_id: string;
  oficina_id: string;
  tipo: "entrada" | "saida" | "ajuste";
  quantidade: number;
  quantidade_anterior: number;
  quantidade_nova: number;
  motivo: string | null;
  referencia_tipo: string | null;
  referencia_id: string | null;
  custo_unitario: number | null;
  user_id: string | null;
  created_at: string;
}

export function useEstoque() {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();
  const { canViewCustos } = useUserRole();

  const { data: itens = [], isLoading, error } = useQuery({
    queryKey: ["estoque", oficinaAtual?.id, canViewCustos],
    queryFn: async () => {
      if (!oficinaAtual) return [];

      // CAUSA RAIZ: Busca paginada para evitar truncamento silencioso em >1000 itens
      const PAGE = 1000;
      const { count } = await supabase
        .from("estoque")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", oficinaAtual.id)
        .eq("arquivado", false);
      
      const total = count || 0;
      let allData: ItemEstoque[] = [];

      for (let from = 0; from < Math.max(total, 1); from += PAGE) {
        const to = from + PAGE - 1;
        const { data, error } = await supabase
          .from("estoque")
          .select("*")
          .eq("oficina_id", oficinaAtual.id)
          .eq("arquivado", false)
          .order("nome", { ascending: true })
          .range(from, to);

        if (error) throw error;
        allData.push(...((data || []) as ItemEstoque[]));
        if ((data || []).length < PAGE) break;
      }
      
      // Filtrar campos sensíveis para funcionários (não proprietários)
      if (!canViewCustos) {
        return allData.map(item => ({
          ...item,
          custo_unitario: 0,
          fornecedor_nome: null,
          fornecedor_telefone: null,
          fornecedor_email: null,
        }));
      }
      
      return allData;
    },
    enabled: !!oficinaAtual,
  });

  const createItem = useMutation({
    mutationFn: async (input: ItemEstoqueInput) => {
      if (!oficinaAtual) throw new Error("Nenhuma oficina selecionada");

      // BLINDAGEM: Retry automático para falhas de rede
      return await withRetry(
        async () => {
          const { data, error } = await supabase
            .from("estoque")
            .insert({
              oficina_id: oficinaAtual.id,
              nome: input.nome,
              categoria: input.categoria,
              tipo_veiculo: input.tipo_veiculo || "ambos",
              quantidade: input.quantidade ?? 0,
              custo_unitario: input.custo_unitario ?? 0,
              preco_venda: input.preco_venda ?? 0,
              alerta_minimo: input.alerta_minimo ?? 5,
              localizacao: input.localizacao || null,
              fornecedor_nome: input.fornecedor_nome || null,
              fornecedor_telefone: input.fornecedor_telefone || null,
              fornecedor_email: input.fornecedor_email || null,
              codigo: input.codigo || null,
              ncm: input.ncm || null,
              tipo_item: input.tipo_item || "peca",
            })
            .select()
            .single();

          if (error) throw error;
          return data;
        },
        {
          maxRetries: 2,
          delay: 1000,
        }
      );
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["estoque", oficinaAtual?.id] });
      // BLINDAGEM: Log de evento de negócio
      logBusinessEvent("estoque_item_criado", { nome: data.nome, categoria: data.categoria });
      toast.success("Item adicionado ao estoque!");
      
      // 🏆 GAMIFICAÇÃO: Verificar conquista de estoque
      if (oficinaAtual?.id) {
        const count = await getTableCount('estoque', oficinaAtual.id);
        checkAndSendAchievement(oficinaAtual.id, 'estoque', count);
      }
    },
    onError: (error) => {
      // BLINDAGEM: Mensagem humanizada
      const errorInfo = humanizeError(error);
      toast.error(errorInfo.message, {
        description: errorInfo.description,
      });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ItemEstoqueInput> & { id: string }) => {
      // M1 FIX: Partial update — only send fields that were provided
      return await withRetry(
        async () => {
          const updateData: Record<string, unknown> = {};
          
          if (input.nome !== undefined) updateData.nome = input.nome;
          if (input.categoria !== undefined) updateData.categoria = input.categoria;
          if (input.tipo_veiculo !== undefined) updateData.tipo_veiculo = input.tipo_veiculo || "ambos";
          if (input.quantidade !== undefined) updateData.quantidade = input.quantidade ?? 0;
          if (input.custo_unitario !== undefined) updateData.custo_unitario = input.custo_unitario ?? 0;
          if (input.preco_venda !== undefined) updateData.preco_venda = input.preco_venda ?? 0;
          if (input.alerta_minimo !== undefined) updateData.alerta_minimo = input.alerta_minimo ?? 5;
          if (input.localizacao !== undefined) updateData.localizacao = input.localizacao || null;
          if (input.fornecedor_nome !== undefined) updateData.fornecedor_nome = input.fornecedor_nome || null;
          if (input.fornecedor_telefone !== undefined) updateData.fornecedor_telefone = input.fornecedor_telefone || null;
          if (input.fornecedor_email !== undefined) updateData.fornecedor_email = input.fornecedor_email || null;
          if (input.codigo !== undefined) updateData.codigo = input.codigo || null;
          if (input.ncm !== undefined) updateData.ncm = input.ncm || null;
          if (input.tipo_item !== undefined) updateData.tipo_item = input.tipo_item || "peca";

          const { data, error } = await supabase
            .from("estoque")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();

          if (error) throw error;
          return data;
        },
        {
          maxRetries: 2,
          delay: 1000,
        }
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["estoque", oficinaAtual?.id] });
      // BLINDAGEM: Log de evento de negócio
      logBusinessEvent("estoque_item_atualizado", { id: data.id, nome: data.nome });
      toast.success("Item atualizado com sucesso!");
    },
    onError: (error) => {
      // BLINDAGEM: Mensagem humanizada
      const errorInfo = humanizeError(error);
      toast.error(errorInfo.message, {
        description: errorInfo.description,
      });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      if (!oficinaAtual) throw new Error("Nenhuma oficina selecionada");

      // ARQUITETURA ATÔMICA: Exclusão via RPC server-side
      // Verifica vínculos com OS/orçamentos ativos + deleta movimentações + item em transação única
      const { data, error } = await supabase.rpc("atomic_delete_estoque" as any, {
        p_estoque_id: id,
        p_oficina_id: oficinaAtual.id,
      });

      if (error) throw error;

      const result = data as AtomicDeleteResult;
      if (!result?.success) {
        throw new Error(result?.message || "Falha ao excluir item");
      }
      return result;
    },
    onSuccess: (result: AtomicDeleteResult & { soft_delete?: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["estoque", oficinaAtual?.id] });
      if (result?.soft_delete) {
        toast.success(`${result?.nome || "Item"} arquivado!`, {
          description: "Estava vinculado a OS/orçamentos antigos. Histórico preservado.",
        });
      } else {
        toast.success(`${result?.nome || "Item"} removido do estoque!`);
      }
    },
    onError: (error) => {
      const errorInfo = humanizeError(error);
      toast.error(errorInfo.message, {
        description: errorInfo.description,
      });
    },
  });

  // Helper to get low stock items
  const itensAlertaBaixo = itens.filter((item) => item.quantidade <= item.alerta_minimo);

  // Calculate total stock value — only physical items (exclude services)
  const pecas = itens.filter((item) => item.tipo_item !== "servico");
  const valorTotalEstoque = pecas.reduce((acc, item) => 
    acc + (item.quantidade * (item.custo_unitario || 0)), 0
  );
  
  const valorTotalVenda = pecas.reduce((acc, item) => 
    acc + (item.quantidade * (item.preco_venda || 0)), 0
  );

  return {
    itens,
    itensAlertaBaixo,
    valorTotalEstoque,
    valorTotalVenda,
    isLoading,
    error,
    createItem,
    updateItem,
    deleteItem,
  };
}

// Hook para buscar movimentações de um item específico
export function useMovimentacoesEstoque(estoqueId?: string) {
  const { oficinaAtual } = useOficina();

  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ["estoque-movimentacoes", estoqueId],
    queryFn: async () => {
      if (!estoqueId || !oficinaAtual) return [];
      
      const { data, error } = await supabase
        .from("estoque_movimentacoes")
        .select("*")
        .eq("estoque_id", estoqueId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as MovimentacaoEstoque[];
    },
    enabled: !!estoqueId && !!oficinaAtual,
  });

  return { movimentacoes, isLoading };
}