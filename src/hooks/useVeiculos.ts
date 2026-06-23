import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rpcWithRetry } from "@/lib/rpcWithRetry";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";
import { checkAndSendAchievement, getTableCount } from "@/lib/achievements";
import { withRetry, humanizeError } from "@/lib/errorHandling";
import { guardCreateVeiculo } from "@/lib/runtimeGuards";

export interface Veiculo {
  id: string;
  cliente_id: string;
  oficina_id: string;
  tipo: "moto" | "carro";
  marca: string;
  modelo: string;
  ano: number | null;
  placa: string | null;
  km_atual: number;
  chassi: string | null;
  cor: string | null;
  observacoes: string | null;
  foto_url: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  cliente?: {
    id: string;
    nome: string;
    telefone: string | null;
  };
}

export interface VeiculoInput {
  cliente_id: string;
  tipo: "moto" | "carro";
  marca: string;
  modelo: string;
  ano?: number;
  placa?: string;
  km_atual?: number;
  chassi?: string;
  cor?: string;
  observacoes?: string;
}


export function useVeiculos() {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();

  const { data: veiculos = [], isLoading, error } = useQuery({
    queryKey: ["veiculos", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      
      return withRetry(async () => {
        // CAUSA RAIZ: Busca paginada para evitar truncamento silencioso em >1000 veículos
        const PAGE = 1000;
        let allData: Veiculo[] = [];

        for (let from = 0; ; from += PAGE) {
          const to = from + PAGE - 1;
          const { data, error } = await supabase
            .from("veiculos")
            .select(`
              *,
              cliente:clientes(id, nome, telefone)
            `)
            .eq("oficina_id", oficinaAtual.id)
            .order("created_at", { ascending: false })
            .range(from, to);

          if (error) throw error;
          allData.push(...((data || []) as Veiculo[]));
          if ((data || []).length < PAGE) break;
        }

        return allData;
      });
    },
    enabled: !!oficinaAtual,
  });

  const createVeiculo = useMutation({
    mutationFn: async (input: VeiculoInput) => {
      if (!oficinaAtual) throw new Error("Nenhuma oficina selecionada");

      // Guard pré-mutação
      guardCreateVeiculo({
        oficina_id: oficinaAtual.id,
        cliente_id: input.cliente_id,
        marca: input.marca,
        modelo: input.modelo,
        tipo: input.tipo,
      });

      const { data, error } = await supabase
        .from("veiculos")
        .insert({
          oficina_id: oficinaAtual.id,
          cliente_id: input.cliente_id,
          tipo: input.tipo,
          marca: input.marca,
          modelo: input.modelo,
          ano: input.ano || null,
          placa: input.placa || null,
          km_atual: input.km_atual || 0,
          chassi: input.chassi || null,
          observacoes: input.observacoes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["veiculos", oficinaAtual?.id] });
      toast.success("Veículo cadastrado com sucesso!");
      
      // 🏆 GAMIFICAÇÃO: Verificar conquista de veículos
      if (oficinaAtual?.id) {
        const count = await getTableCount('veiculos', oficinaAtual.id);
        checkAndSendAchievement(oficinaAtual.id, 'veiculos', count);
      }
    },
    onError: (error) => {
      const humanized = humanizeError(error);
      toast.error(humanized.message, {
        description: humanized.description,
      });
    },
  });

  const updateVeiculo = useMutation({
    mutationFn: async ({ id, ...input }: VeiculoInput & { id: string }) => {
      const { data, error } = await supabase
        .from("veiculos")
        .update({
          cliente_id: input.cliente_id,
          tipo: input.tipo,
          marca: input.marca,
          modelo: input.modelo,
          ano: input.ano || null,
          placa: input.placa || null,
          km_atual: input.km_atual || 0,
          chassi: input.chassi || null,
          observacoes: input.observacoes || null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["veiculos", oficinaAtual?.id] });
      toast.success("Veículo atualizado com sucesso!");
    },
    onError: (error) => {
      const humanized = humanizeError(error);
      toast.error(humanized.message, {
        description: humanized.description,
      });
    },
  });

  const deleteVeiculo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await rpcWithRetry("atomic_delete_veiculo", {
        p_veiculo_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["veiculos", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["recorrencias"] });
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      toast.success("Veículo removido com sucesso!");
    },
    onError: (error) => {
      const humanized = humanizeError(error);
      toast.error(humanized.message, {
        description: humanized.description,
      });
    },
  });

  return {
    veiculos,
    isLoading,
    error,
    createVeiculo,
    updateVeiculo,
    deleteVeiculo,
  };
}
