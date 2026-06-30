import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rpcSentinela } from "@/lib/sentinela";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";

export type DiaSemana = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom";

export interface HorarioDia {
  aberto: boolean;
  abre?: string;
  fecha?: string;
  pausa_inicio?: string;
  pausa_fim?: string;
}

export type HorariosSemana = Record<DiaSemana, HorarioDia>;

export interface AgendamentoOnlineConfig {
  oficina_id: string;
  agendamento_online_ativo: boolean;
  agendamento_online_slug: string | null;
  agendamento_online_horarios: HorariosSemana;
  agendamento_online_capacidade_simultanea: number;
  agendamento_online_duracao_slot_minutos: number;
  agendamento_online_servicos_permitidos: string[];
  agendamento_online_dias_antecedencia_max: number;
  agendamento_online_mostrar_precos: boolean;
  agendamento_online_mensagem_confirmacao: string;
  agendamento_online_mensagem_aprovacao: string;
  agendamento_online_mensagem_recusa: string;
  agendamento_online_mensagem_sugestao: string;
}

export type SolicitacaoStatus = "pendente" | "aprovado" | "recusado" | "sugerido" | "cancelado";

export interface SolicitacaoAgendamento {
  id: string;
  oficina_id: string;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email: string | null;
  veiculo_placa: string | null;
  veiculo_modelo: string | null;
  servico_id: string | null;
  servico_nome: string;
  servico_valor_estimado: number | null;
  data_agendamento_solicitada: string;
  hora_agendamento_solicitada: string;
  observacoes_cliente: string | null;
  status: SolicitacaoStatus;
  data_aprovacao: string | null;
  data_recusa: string | null;
  data_sugestao: string | null;
  nova_data_sugerida: string | null;
  nova_hora_sugerida: string | null;
  motivo_recusa: string | null;
  ordem_servico_id: string | null;
  created_at: string;
}

export function useAgendamentoOnlineConfig() {
  const { oficinaAtual } = useOficina();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["agendamento_online_config", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return null;
      const { data, error } = await supabase
        .from("oficina_configuracoes")
        .select("oficina_id, agendamento_online_ativo, agendamento_online_slug, agendamento_online_horarios, agendamento_online_capacidade_simultanea, agendamento_online_duracao_slot_minutos, agendamento_online_servicos_permitidos, agendamento_online_dias_antecedencia_max, agendamento_online_mostrar_precos, agendamento_online_mensagem_confirmacao, agendamento_online_mensagem_aprovacao, agendamento_online_mensagem_recusa, agendamento_online_mensagem_sugestao")
        .eq("oficina_id", oficinaAtual.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as AgendamentoOnlineConfig | null;
    },
    enabled: !!oficinaAtual,
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<AgendamentoOnlineConfig>) => {
      if (!oficinaAtual) throw new Error("Sem oficina");
      const { data, error } = await supabase
        .from("oficina_configuracoes")
        .upsert({ oficina_id: oficinaAtual.id, ...patch } as any, { onConflict: "oficina_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agendamento_online_config", oficinaAtual?.id] });
      toast.success("Configurações de agendamento salvas!");
    },
    onError: (e: any) => toast.error("Erro ao salvar", { description: e.message }),
  });

  return { config: query.data, isLoading: query.isLoading, update };
}

export function useSolicitacoesAgendamento(status?: SolicitacaoStatus | "todos") {
  const { oficinaAtual } = useOficina();

  return useQuery({
    queryKey: ["solicitacoes_agendamento", oficinaAtual?.id, status ?? "todos"],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      let q = supabase
        .from("solicitacoes_agendamento" as any)
        .select("*")
        .eq("oficina_id", oficinaAtual.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (status && status !== "todos") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as SolicitacaoAgendamento[];
    },
    enabled: !!oficinaAtual,
    refetchInterval: 30000,
  });
}

export function useSolicitacoesPendentesCount() {
  const { oficinaAtual } = useOficina();
  return useQuery({
    queryKey: ["solicitacoes_pendentes_count", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return 0;
      const { count, error } = await supabase
        .from("solicitacoes_agendamento" as any)
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", oficinaAtual.id)
        .eq("status", "pendente");
      if (error) return 0;
      return count || 0;
    },
    enabled: !!oficinaAtual,
    refetchInterval: 60000,
    staleTime: 30000,
  });
}

export function useSolicitacaoActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["solicitacoes_agendamento"] });
    qc.invalidateQueries({ queryKey: ["solicitacoes_pendentes_count"] });
  };

  const aprovar = useMutation({
    mutationFn: async (vars: { solicitacao_id: string; cliente_id?: string; veiculo_id?: string }) => {
      const { data, error } = await rpcSentinela("aprovar_solicitacao_agendamento", {
        p_solicitacao_id: vars.solicitacao_id,
        p_cliente_id: vars.cliente_id || null,
        p_veiculo_id: vars.veiculo_id || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast.success("Agendamento aprovado e OS criada!"); },
    onError: (e: any) => toast.error("Erro ao aprovar", { description: e.message }),
  });

  const recusar = useMutation({
    mutationFn: async (vars: { solicitacao_id: string; motivo?: string }) => {
      const { data, error } = await rpcSentinela("recusar_solicitacao_agendamento", {
        p_solicitacao_id: vars.solicitacao_id,
        p_motivo: vars.motivo || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast.success("Solicitação recusada"); },
    onError: (e: any) => toast.error("Erro ao recusar", { description: e.message }),
  });

  const sugerir = useMutation({
    mutationFn: async (vars: { solicitacao_id: string; nova_data: string; nova_hora: string }) => {
      const { data, error } = await rpcSentinela("sugerir_novo_horario_agendamento", {
        p_solicitacao_id: vars.solicitacao_id,
        p_nova_data: vars.nova_data,
        p_nova_hora: vars.nova_hora,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast.success("Novo horário sugerido"); },
    onError: (e: any) => toast.error("Erro ao sugerir", { description: e.message }),
  });

  const cancelar = useMutation({
    mutationFn: async (solicitacao_id: string) => {
      const { data, error } = await rpcSentinela("cancelar_solicitacao_agendamento", {
        p_solicitacao_id: solicitacao_id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast.success("Solicitação cancelada"); },
    onError: (e: any) => toast.error("Erro ao cancelar", { description: e.message }),
  });

  return { aprovar, recusar, sugerir, cancelar };
}
