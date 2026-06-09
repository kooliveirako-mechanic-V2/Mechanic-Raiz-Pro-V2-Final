import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";

export interface OficinaConfiguracoes {
  id: string;
  oficina_id: string;
  whatsapp_notificacoes: boolean;
  estoque_alertas: boolean;
  recorrencia_lembretes: boolean;
  resumo_diario: boolean;
  horario_abertura: string | null;
  horario_fechamento: string | null;
  dias_funcionamento: string[];
  cor_primaria: string | null;
  moeda: string;
  // Campos fiscais
  razao_social: string | null;
  cnpj: string | null;
  inscricao_municipal: string | null;
  municipio: string | null;
  regime_tributario: string | null;
  cfop_servicos: string | null;
  cfop_vendas: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConfiguracoesInput {
  whatsapp_notificacoes?: boolean;
  estoque_alertas?: boolean;
  recorrencia_lembretes?: boolean;
  resumo_diario?: boolean;
  horario_abertura?: string;
  horario_fechamento?: string;
  dias_funcionamento?: string[];
  cor_primaria?: string | null;
  // Campos fiscais
  razao_social?: string;
  cnpj?: string;
  inscricao_municipal?: string;
  municipio?: string;
  regime_tributario?: string;
  cfop_servicos?: string;
  cfop_vendas?: string;
}

export function useOficinaConfiguracoes() {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();

  const { data: configuracoes, isLoading, error } = useQuery({
    queryKey: ["oficina_configuracoes", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return null;
      
      const { data, error } = await supabase
        .from("oficina_configuracoes")
        .select("*")
        .eq("oficina_id", oficinaAtual.id)
        .maybeSingle();

      if (error) throw error;
      
      // Se não existir, retorna defaults
      if (!data) {
        return {
          id: "",
          oficina_id: oficinaAtual.id,
          whatsapp_notificacoes: true,
          estoque_alertas: true,
          recorrencia_lembretes: true,
          resumo_diario: false,
          horario_abertura: "08:00",
          horario_fechamento: "18:00",
          dias_funcionamento: ["seg", "ter", "qua", "qui", "sex", "sab"],
          cor_primaria: null,
          moeda: "BRL",
        } as OficinaConfiguracoes;
      }
      
      return data as OficinaConfiguracoes;
    },
    enabled: !!oficinaAtual,
  });

  const updateConfiguracoes = useMutation({
    mutationFn: async (input: ConfiguracoesInput) => {
      if (!oficinaAtual) throw new Error("Nenhuma oficina selecionada");

      // Upsert - insere se não existir, atualiza se existir
      const { data, error } = await supabase
        .from("oficina_configuracoes")
        .upsert({
          oficina_id: oficinaAtual.id,
          ...input,
        }, {
          onConflict: "oficina_id",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oficina_configuracoes", oficinaAtual?.id] });
      toast.success("Configurações salvas!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar configurações", {
        description: error.message,
      });
    },
  });

  return {
    configuracoes,
    isLoading,
    error,
    updateConfiguracoes,
  };
}
