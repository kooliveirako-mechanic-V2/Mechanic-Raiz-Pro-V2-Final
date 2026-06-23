import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rpcWithRetry } from "@/lib/rpcWithRetry";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";
import { checkAndSendAchievement, getTableCount } from "@/lib/achievements";
import { withRetry, humanizeError } from "@/lib/errorHandling";
import { trackCreatedFirstClient } from "@/lib/pixelEvents";
import { guardCreateCliente } from "@/lib/runtimeGuards";

export interface Cliente {
  id: string;
  oficina_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  cpf_cnpj: string | null;
  endereco: string | null;
  portal_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClienteInput {
  nome: string;
  telefone?: string;
  email?: string;
  observacoes?: string;
  cpf_cnpj?: string;
  endereco?: string;
}

const PAGE_SIZE = 20;

export function useClientes() {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();

  // Total count
  const { data: totalCount = 0 } = useQuery({
    queryKey: ["clientes_count", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return 0;
      const { count, error } = await supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", oficinaAtual.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!oficinaAtual,
  });

  const {
    data: paginatedData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["clientes", oficinaAtual?.id],
    queryFn: async ({ pageParam = 0 }) => {
      if (!oficinaAtual) return [];
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      return withRetry(async () => {
        const { data, error } = await supabase
          .from("clientes")
          .select("*")
          .eq("oficina_id", oficinaAtual.id)
          .order("nome", { ascending: true })
          .range(from, to);

        if (error) throw error;
        return data as Cliente[];
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length;
    },
    enabled: !!oficinaAtual,
  });

  const clientes: Cliente[] = (paginatedData?.pages || []).flat();

  const createCliente = useMutation({
    mutationFn: async (input: ClienteInput) => {
      if (!oficinaAtual) throw new Error("Nenhuma oficina selecionada");

      // Guard pré-mutação
      guardCreateCliente({ oficina_id: oficinaAtual.id, nome: input.nome });

      const { data, error } = await supabase
        .from("clientes")
        .insert({
          oficina_id: oficinaAtual.id,
          nome: input.nome,
          telefone: input.telefone || null,
          email: input.email || null,
          observacoes: input.observacoes || null,
          cpf_cnpj: input.cpf_cnpj || null,
          endereco: input.endereco || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["clientes", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["clientes_count", oficinaAtual?.id] });
      toast.success("Cliente cadastrado com sucesso!");
      
      if (oficinaAtual?.id) {
        const count = await getTableCount('clientes', oficinaAtual.id);
        checkAndSendAchievement(oficinaAtual.id, 'clientes', count);
        if (count === 1) trackCreatedFirstClient();
      }
    },
    onError: (error) => {
      const humanized = humanizeError(error);
      toast.error(humanized.message, {
        description: humanized.description,
      });
    },
  });

  const updateCliente = useMutation({
    mutationFn: async ({ id, ...input }: ClienteInput & { id: string }) => {
      const { data, error } = await supabase
        .from("clientes")
        .update({
          nome: input.nome,
          telefone: input.telefone || null,
          email: input.email || null,
          observacoes: input.observacoes || null,
          cpf_cnpj: input.cpf_cnpj !== undefined ? (input.cpf_cnpj || null) : undefined,
          endereco: input.endereco !== undefined ? (input.endereco || null) : undefined,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes", oficinaAtual?.id] });
      toast.success("Cliente atualizado com sucesso!");
    },
    onError: (error) => {
      const humanized = humanizeError(error);
      toast.error(humanized.message, {
        description: humanized.description,
      });
    },
  });

  const deleteCliente = useMutation({
    mutationFn: async (id: string) => {
      // HARDENING TRANSACIONAL: Usa RPC server-side para atomicidade
      // Verifica OS ativas, limpa recorrências, veículos, orçamentos
      // e cliente em transação única — sem risco de estado parcial
      const { data, error } = await rpcWithRetry("atomic_delete_cliente", {
        p_cliente_id: id,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || "Falha ao excluir cliente");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["clientes_count", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["veiculos"] });
      queryClient.invalidateQueries({ queryKey: ["recorrencias"] });
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      toast.success("Cliente removido com sucesso!");
    },
    onError: (error) => {
      const humanized = humanizeError(error);
      toast.error(humanized.message, {
        description: humanized.description,
      });
    },
  });

  return {
    clientes,
    isLoading,
    error,
    totalCount,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    createCliente,
    updateCliente,
    deleteCliente,
  };
}
