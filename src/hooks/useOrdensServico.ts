import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";
import { humanizeError, withRetry } from "@/lib/errorHandling";
import { guardCreateOS } from "@/lib/runtimeGuards";
import { checkAndSendAchievement, getTableCount } from "@/lib/achievements";
import { trackCreatedFirstOS, trackOSFinalized } from "@/lib/pixelEvents";
import { trackFunnelEvent } from "@/lib/funnelTracking";
import { CriarOSCompletaResult, AtomicDeleteResult } from "@/lib/rpcTypes";
import { rpcWithRetry } from "@/lib/rpcWithRetry";
import { rpcSentinela } from "@/lib/sentinela";
import { isAuthError } from "@/lib/authGuard";

// Helper: Sync vehicle mileage when OS records km_no_servico
async function syncVehicleKm(veiculoId: string, kmNoServico: number | undefined | null) {
  if (!kmNoServico || kmNoServico <= 0) return;
  try {
    const { data: veiculo } = await supabase
      .from("veiculos")
      .select("km_atual")
      .eq("id", veiculoId)
      .single();
    if (veiculo && (veiculo.km_atual || 0) < kmNoServico) {
      const { error } = await supabase
        .from("veiculos")
        .update({ km_atual: kmNoServico })
        .eq("id", veiculoId);
      if (error) {
        console.error("[OS] Falha ao sincronizar KM do veículo:", error.message);
        toast.error("KM do veículo não foi atualizado", { description: error.message });
      }
    }
  } catch (err) {
    console.error("[OS] Erro ao sincronizar KM do veículo:", err);
    toast.error("Erro ao atualizar KM do veículo", { description: String(err) });
  }
}

// Helper: Update recorrencias when OS is finalized
async function syncRecorrencias(veiculoId: string, tipoServico: string, oficina_id: string) {
  try {
    const { data: recorrencias } = await supabase
      .from("recorrencias")
      .select("id, intervalo_dias")
      .eq("veiculo_id", veiculoId)
      .eq("tipo_servico", tipoServico)
      .eq("oficina_id", oficina_id)
      .eq("ativo", true);

    if (recorrencias && recorrencias.length > 0) {
      const hoje = new Date().toISOString().split("T")[0];
      for (const rec of recorrencias) {
        const proxima = rec.intervalo_dias
          ? new Date(Date.now() + rec.intervalo_dias * 86400000).toISOString().split("T")[0]
          : null;
        const { error } = await supabase
          .from("recorrencias")
          .update({ ultima_execucao: hoje, proxima_execucao: proxima })
          .eq("id", rec.id);
        if (error) {
          console.error("[OS] Falha ao sincronizar recorrência:", error.message);
        }
      }
    }
  } catch (err) {
    console.error("[OS] Erro ao sincronizar recorrências:", err);
    toast.error("Lembretes de manutenção não foram atualizados", { description: String(err) });
  }
}

export type StatusOS = "aberto" | "pendente" | "em_diagnostico" | "em_andamento" | "aguardando_peca" | "finalizado" | "cancelado";

export interface OrdemServico {
  id: string;
  numero: number | null;
  oficina_id: string;
  cliente_id: string;
  veiculo_id: string;
  responsavel_id: string | null;
  data_servico: string;
  hora_agendamento: string | null;
  tipo_servico: string;
  descricao: string | null;
  km_no_servico: number | null;
  status: StatusOS;
  valor_servico: number;
  valor_mao_obra: number;
  custo_servico: number;
  lucro: number;
  tem_garantia: boolean;
  dias_garantia: number;
  forma_pagamento: string | null;
  observacoes: string | null;
  desconto?: number | null;
  desconto_motivo?: string | null;
  desconto_aplicado_por?: string | null;
  desconto_aplicado_em?: string | null;
  valor_sinal?: number | null;
  created_at: string;
  updated_at: string;
  // Campos técnicos de Auto Elétrica
  codigo_obd?: string | null;
  codigos_obd_lista?: string[] | null;
  checklist_voltagem_bateria?: string | null;
  checklist_carga_bateria?: string | null;
  tempo_diagnostico_minutos?: number | null;
  modulos_testados?: string[] | null;
  checklist_alternador_ok?: boolean | null;
  checklist_motor_partida_ok?: boolean | null;
  checklist_fusiveis_ok?: boolean | null;
  // Joined data
  cliente?: {
    id: string;
    nome: string;
    telefone: string | null;
  };
  veiculo?: {
    id: string;
    tipo: string;
    marca: string;
    modelo: string;
    placa: string | null;
  };
  // Responsável name from RPC or join
  responsavel_nome?: string;
}

export interface OrdemServicoInput {
  cliente_id: string;
  veiculo_id: string;
  responsavel_id?: string;
  data_servico?: string;
  hora_agendamento?: string;
  tipo_servico: string;
  descricao?: string;
  km_no_servico?: number;
  status?: StatusOS;
  valor_servico?: number;
  valor_mao_obra?: number;
  custo_servico?: number;
  tem_garantia?: boolean;
  dias_garantia?: number;
  forma_pagamento?: string;
  observacoes?: string;
  desconto?: number;
  desconto_motivo?: string | null;
  // Checklist DVI
  checklist_combustivel?: string;
  checklist_riscos?: boolean;
  checklist_estepe?: boolean;
  checklist_som?: boolean;
  checklist_luzes?: boolean;
  fotos_entrada?: string[];
  // Conclusão
  fotos_saida?: string[];
  observacoes_conclusao?: string;
  data_conclusao?: string;
  // Campos Auto Elétrica
  checklist_voltagem_bateria?: string;
  checklist_carga_bateria?: string;
  checklist_alternador_ok?: boolean;
  checklist_motor_partida_ok?: boolean;
  checklist_fusiveis_ok?: boolean;
  codigo_obd?: string;
  codigos_obd_lista?: string[];
  hipotese_diagnostico?: string;
  modulos_testados?: string[];
  tempo_diagnostico_minutos?: number;
  // Assinatura digital
  assinatura_cliente_url?: string;
}

const PAGE_SIZE = 20;

export function useOrdensServico() {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();

  // Total count for "Exibindo X de Y"
  const { data: totalCount = 0 } = useQuery({
    queryKey: ["ordens_servico_count", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return 0;
      const { count, error } = await supabase
        .from("ordens_servico")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", oficinaAtual.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!oficinaAtual,
  });

  // Funcionarios map (cached separately)
  const { data: funcionariosMap = new Map() } = useQuery({
    queryKey: ["oficina_funcionarios", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return new Map();
      const { data: funcionarios } = await supabase
        .rpc("get_oficina_funcionarios", { _oficina_id: oficinaAtual.id });
      return new Map(
        (funcionarios || []).map((f: { user_id: string; nome: string }) => [f.user_id, f.nome])
      );
    },
    enabled: !!oficinaAtual,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  const {
    data: paginatedData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["ordens_servico", oficinaAtual?.id],
    queryFn: async ({ pageParam = 0 }) => {
      if (!oficinaAtual) return [];
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: ordensData, error: ordensError } = await supabase
        .from("ordens_servico")
        .select(`
          *,
          cliente:clientes(id, nome, telefone),
          veiculo:veiculos(id, tipo, marca, modelo, placa)
        `)
        .eq("oficina_id", oficinaAtual.id)
        .order("data_servico", { ascending: false })
        .range(from, to);

      if (ordensError) throw ordensError;
      return ordensData || [];
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length;
    },
    enabled: !!oficinaAtual,
  });

  // Flatten pages and attach responsavel names
  const ordens: OrdemServico[] = (paginatedData?.pages || []).flat().map((ordem) => ({
    ...ordem,
    responsavel_nome: ordem.responsavel_id
      ? funcionariosMap.get(ordem.responsavel_id) || "Funcionário"
      : null,
  })) as OrdemServico[];

  const createOrdem = useMutation({
    mutationFn: async (input: OrdemServicoInput) => {
      if (!oficinaAtual) throw new Error("Nenhuma oficina selecionada");

      // NÍVEL 5: Guard pré-mutação — impede dados inválidos no banco
      guardCreateOS({
        oficina_id: oficinaAtual.id,
        cliente_id: input.cliente_id,
        veiculo_id: input.veiculo_id,
        tipo_servico: input.tipo_servico,
      });

      // ARQUITETURA ATÔMICA: Usa RPC criar_os_completa ao invés de INSERT direto
      // Isso garante que cabeçalho + itens + totais + financeiro são criados
      // em uma única transação — sem risco de dados parciais
      const { data, error } = await rpcSentinela("criar_os_completa", {
        p_oficina_id: oficinaAtual.id,
        p_cliente_id: input.cliente_id,
        p_veiculo_id: input.veiculo_id,
        p_tipo_servico: input.tipo_servico,
        p_descricao: input.descricao || null,
        p_km_no_servico: input.km_no_servico || null,
        p_responsavel_id: input.responsavel_id || null,
        p_data_servico: input.data_servico || new Date().toISOString().split("T")[0],
        p_hora_agendamento: input.hora_agendamento || null,
        p_status: input.status || "pendente",
        p_valor_mao_de_obra: input.valor_mao_obra ?? 0,
        p_custo_servico: input.custo_servico ?? 0,
        p_tem_garantia: input.tem_garantia || false,
        p_dias_garantia: input.dias_garantia || 0,
        p_forma_pagamento: input.forma_pagamento || null,
        p_forma_pagamento_id: null,
        p_observacoes: input.observacoes || null,
        p_itens: JSON.stringify([]),
        // Checklist fields
        p_checklist_combustivel: input.checklist_combustivel || null,
        p_checklist_riscos: input.checklist_riscos || false,
        p_checklist_estepe: input.checklist_estepe || false,
        p_checklist_som: input.checklist_som || false,
        p_checklist_luzes: input.checklist_luzes || false,
        p_fotos_entrada: input.fotos_entrada || [],
        p_assinatura_cliente_url: input.assinatura_cliente_url || null,
        // Auto Elétrica fields
        p_checklist_voltagem_bateria: input.checklist_voltagem_bateria || null,
        p_checklist_carga_bateria: input.checklist_carga_bateria || null,
        p_checklist_alternador_ok: input.checklist_alternador_ok || false,
        p_checklist_motor_partida_ok: input.checklist_motor_partida_ok || false,
        p_checklist_fusiveis_ok: input.checklist_fusiveis_ok || false,
        p_codigo_obd: input.codigo_obd || null,
        p_codigos_obd_lista: input.codigos_obd_lista || [],
        p_hipotese_diagnostico: input.hipotese_diagnostico || null,
        p_modulos_testados: input.modulos_testados || [],
        p_tempo_diagnostico_minutos: input.tempo_diagnostico_minutos || 0,
      });

      if (error) {
        console.error("[OS] Erro RPC criar_os_completa:", error.message, error.code);
        if (isAuthError(error)) {
          throw new Error("Sessão expirada. Tente salvar novamente em instantes.");
        }
        // Mensagem real para o usuário, não mais genérica
        throw new Error(error.message || "Erro ao criar OS");
      }

      return data;
    },
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ordens_servico", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["ordens_servico_count", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Ordem de serviço criada com sucesso!");
      
      // BLINDAGEM: Sync KM do veículo
      if (variables.km_no_servico && variables.veiculo_id) {
        await syncVehicleKm(variables.veiculo_id, variables.km_no_servico);
        queryClient.invalidateQueries({ queryKey: ["veiculos"] });
      }

      // BLINDAGEM: Sync recorrências se OS criada como finalizada
      if (variables.status === "finalizado" && oficinaAtual?.id) {
        await syncRecorrencias(variables.veiculo_id, variables.tipo_servico, oficinaAtual.id);
        queryClient.invalidateQueries({ queryKey: ["recorrencias"] });
      }
      
      // 🏆 GAMIFICAÇÃO: Verificar conquista de OS
      if (oficinaAtual?.id) {
        const osId = typeof data === 'object' && data !== null ? (data as CriarOSCompletaResult).os_id : undefined;
        const count = await getTableCount('ordens_servico', oficinaAtual.id);
        checkAndSendAchievement(oficinaAtual.id, 'ordens_servico', count);
        // 📊 REMARKETING: First OS event (count === 1 means this is the first OS ever for this oficina)
        if (count === 1) {
          trackCreatedFirstOS();
          trackFunnelEvent({ event: "first_os_created", oficina_id: oficinaAtual.id, source: "create_os", entity_id: osId });
        }
        // Track every OS creation
        trackFunnelEvent({ event: "os_created", oficina_id: oficinaAtual.id, entity_id: osId, metadata: { count } });
      }
      // 📊 REMARKETING: OS finalized on creation (use variables.status, not data.status)
      if (variables.status === "finalizado" && oficinaAtual?.id) {
        trackOSFinalized();
        const osId = typeof data === 'object' && data !== null ? (data as CriarOSCompletaResult).os_id : undefined;
        // Count only finalized OS to correctly detect the FIRST finalized OS
        const { count: finCount } = await supabase
          .from('ordens_servico')
          .select('id', { count: 'exact', head: true })
          .eq('oficina_id', oficinaAtual.id)
          .eq('status', 'finalizado');
        trackFunnelEvent({
          event: (finCount ?? 0) === 1 ? "first_os_finalized" : "os_finalized",
          oficina_id: oficinaAtual.id,
          source: "create_os_finalized",
          entity_id: osId,
        });
      }
    },
    onError: (error) => {
      const errorInfo = humanizeError(error);
      toast.error(errorInfo.message, {
        description: errorInfo.description,
      });
    },
  });

  const updateOrdem = useMutation({
    mutationFn: async ({ id, ...input }: Partial<OrdemServicoInput> & { id: string }) => {
      return await withRetry(
        async () => {
          const updateData: Record<string, unknown> = {};

          if (input.cliente_id !== undefined) updateData.cliente_id = input.cliente_id;
          if (input.veiculo_id !== undefined) updateData.veiculo_id = input.veiculo_id;
          if (input.responsavel_id !== undefined) updateData.responsavel_id = input.responsavel_id || null;
          if (input.data_servico !== undefined) updateData.data_servico = input.data_servico;
          if (input.hora_agendamento !== undefined) updateData.hora_agendamento = input.hora_agendamento || null;
          if (input.tipo_servico !== undefined) updateData.tipo_servico = input.tipo_servico;
          if (input.descricao !== undefined) updateData.descricao = input.descricao || null;
          if (input.km_no_servico !== undefined) updateData.km_no_servico = input.km_no_servico || null;
          if (input.status !== undefined) updateData.status = input.status;
          // CAUSA RAIZ: o campo digitado no formulário é Mão de Obra.
          // valor_servico é Master Total derivado no banco (mão de obra + itens),
          // portanto nunca deve ser convertido de volta para valor_mao_obra.
          if (input.valor_mao_obra !== undefined) updateData.valor_mao_obra = input.valor_mao_obra ?? 0;
          if (input.custo_servico !== undefined) updateData.custo_servico = input.custo_servico ?? 0;
          if (input.tem_garantia !== undefined) updateData.tem_garantia = input.tem_garantia;
          if (input.dias_garantia !== undefined) updateData.dias_garantia = input.dias_garantia || 0;
          if (input.forma_pagamento !== undefined) updateData.forma_pagamento = input.forma_pagamento || null;
          if (input.observacoes !== undefined) updateData.observacoes = input.observacoes || null;
          if (input.checklist_combustivel !== undefined) updateData.checklist_combustivel = input.checklist_combustivel || null;
          if (input.checklist_riscos !== undefined) updateData.checklist_riscos = input.checklist_riscos;
          if (input.checklist_estepe !== undefined) updateData.checklist_estepe = input.checklist_estepe;
          if (input.checklist_som !== undefined) updateData.checklist_som = input.checklist_som;
          if (input.checklist_luzes !== undefined) updateData.checklist_luzes = input.checklist_luzes;
          if (input.fotos_entrada !== undefined) updateData.fotos_entrada = input.fotos_entrada || [];
          if (input.fotos_saida !== undefined) updateData.fotos_saida = input.fotos_saida || [];
          if (input.observacoes_conclusao !== undefined) updateData.observacoes_conclusao = input.observacoes_conclusao || null;
          if (input.data_conclusao !== undefined) updateData.data_conclusao = input.data_conclusao || null;
          if (input.checklist_voltagem_bateria !== undefined) updateData.checklist_voltagem_bateria = input.checklist_voltagem_bateria || null;
          if (input.checklist_carga_bateria !== undefined) updateData.checklist_carga_bateria = input.checklist_carga_bateria || null;
          if (input.checklist_alternador_ok !== undefined) updateData.checklist_alternador_ok = input.checklist_alternador_ok;
          if (input.checklist_motor_partida_ok !== undefined) updateData.checklist_motor_partida_ok = input.checklist_motor_partida_ok;
          if (input.checklist_fusiveis_ok !== undefined) updateData.checklist_fusiveis_ok = input.checklist_fusiveis_ok;
          if (input.codigo_obd !== undefined) updateData.codigo_obd = input.codigo_obd || null;
          if (input.codigos_obd_lista !== undefined) updateData.codigos_obd_lista = input.codigos_obd_lista || [];
          if (input.hipotese_diagnostico !== undefined) updateData.hipotese_diagnostico = input.hipotese_diagnostico || null;
          if (input.modulos_testados !== undefined) updateData.modulos_testados = input.modulos_testados || [];
          if (input.tempo_diagnostico_minutos !== undefined) updateData.tempo_diagnostico_minutos = input.tempo_diagnostico_minutos || 0;
          if (input.assinatura_cliente_url !== undefined) updateData.assinatura_cliente_url = input.assinatura_cliente_url || null;

          const { data, error } = await supabase
            .from("ordens_servico")
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
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ordens_servico", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["ordens_servico_count", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (variables.status === "finalizado") {
        toast.success("OS finalizada com sucesso!", {
          description: "Receita registrada · Estoque atualizado · Recorrências sincronizadas",
          duration: 5000,
        });
      } else {
        toast.success("Ordem de serviço atualizada!");
      }

      if (variables.km_no_servico && variables.veiculo_id) {
        await syncVehicleKm(variables.veiculo_id, variables.km_no_servico);
        queryClient.invalidateQueries({ queryKey: ["veiculos"] });
      }

      if (variables.status === "finalizado" && data?.veiculo_id && data?.tipo_servico && data?.oficina_id) {
        await syncRecorrencias(data.veiculo_id, data.tipo_servico, data.oficina_id);
        queryClient.invalidateQueries({ queryKey: ["recorrencias"] });
        queryClient.invalidateQueries({ queryKey: ["financeiro-resumo", oficinaAtual?.id] });
        queryClient.invalidateQueries({ queryKey: ["parcelas"] });
        queryClient.invalidateQueries({ queryKey: ["estoque"] });
        trackOSFinalized();
        // Count only finalized OS to detect the FIRST finalized OS ever
        const { count: finCount } = await supabase
          .from('ordens_servico')
          .select('id', { count: 'exact', head: true })
          .eq('oficina_id', data.oficina_id)
          .eq('status', 'finalizado');
        trackFunnelEvent({
          event: (finCount ?? 0) === 1 ? "first_os_finalized" : "os_finalized",
          oficina_id: data.oficina_id,
          source: "update_os",
          entity_id: data.id,
        });
      }
    },
    onError: (error) => {
      const errorInfo = humanizeError(error);
      toast.error(errorInfo.message, {
        description: errorInfo.description,
      });
    },
  });

  const deleteOrdem = useMutation({
    mutationFn: async (id: string) => {
      // HARDENING TRANSACIONAL: Usa RPC server-side para garantir atomicidade
      // Todas as operações (restore estoque, delete itens, financeiro, parcelas, OS)
      // acontecem em uma única transação — sem risco de estado parcial
      const { data, error } = await rpcWithRetry("atomic_delete_os", {
        p_os_id: id,
      });

      if (error) throw error;

      const result = data as AtomicDeleteResult;
      if (!result.success) {
        throw new Error(result.error || "Falha ao excluir OS");
      }
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["ordens_servico", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["ordens_servico_count", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-resumo", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["parcelas"] });
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
      toast.success("Ordem de serviço removida", {
        description: "Estoque restaurado · Financeiro limpo · Parcelas removidas",
        duration: 5000,
      });
    },
    onError: (error) => {
      const errorInfo = humanizeError(error);
      toast.error(errorInfo.message, {
        description: errorInfo.description,
      });
    },
  });

  return {
    ordens,
    isLoading,
    error,
    totalCount,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    createOrdem,
    updateOrdem,
    deleteOrdem,
  };
}
