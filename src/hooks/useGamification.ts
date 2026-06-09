import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";

// ============================================
// LAYER 1: ACTIVATION (Onboarding Checklist)
// ============================================
export interface OnboardingStep {
  id: string;
  label: string;
  completed: boolean;
}

export interface ActivationState {
  steps: OnboardingStep[];
  percentComplete: number;
  allComplete: boolean;
}

// ============================================
// LAYER 2: POSITIVE INDICATORS (Engagement)
// ============================================
export interface PositiveIndicator {
  id: string;
  message: string;
  type: "operational" | "financial" | "growth";
}

// ============================================
// LAYER 3: GROWTH MILESTONES
// ============================================
export interface GrowthMilestone {
  id: string;
  label: string;
  reached: boolean;
  capacityHint?: string;
}

export function useGamification() {
  const { oficinaAtual } = useOficina();

  const { data, isLoading } = useQuery({
    queryKey: ["gamification", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return null;

      const hoje = format(new Date(), "yyyy-MM-dd");
      const seteDiasAtras = format(subDays(new Date(), 7), "yyyy-MM-dd");
      const inicioMes = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const fimMes = format(endOfMonth(new Date()), "yyyy-MM-dd");

      // Parallel queries for all data we need
      const [
        { count: totalOS },
        { count: osFinalizadas },
        { count: totalClientes },
        { count: totalVeiculos },
        { count: totalFuncionarios },
        { data: osAtrasadas },
        { data: osHoje },
        { count: osFinalizadasMes },
        { data: financRecorrente },
      ] = await Promise.all([
        supabase
          .from("ordens_servico")
          .select("id", { count: "exact", head: true })
          .eq("oficina_id", oficinaAtual.id),
        supabase
          .from("ordens_servico")
          .select("id", { count: "exact", head: true })
          .eq("oficina_id", oficinaAtual.id)
          .eq("status", "finalizado"),
        supabase
          .from("clientes")
          .select("id", { count: "exact", head: true })
          .eq("oficina_id", oficinaAtual.id),
        supabase
          .from("veiculos")
          .select("id", { count: "exact", head: true })
          .eq("oficina_id", oficinaAtual.id),
        supabase
          .from("user_roles")
          .select("id", { count: "exact", head: true })
          .eq("oficina_id", oficinaAtual.id)
          .eq("active", true),
        supabase
          .from("ordens_servico")
          .select("id")
          .eq("oficina_id", oficinaAtual.id)
          .in("status", ["pendente", "em_andamento"])
          .lt("data_servico", hoje)
          .gte("data_servico", seteDiasAtras),
        supabase
          .from("ordens_servico")
          .select("id, status")
          .eq("oficina_id", oficinaAtual.id)
          .eq("data_servico", hoje)
          .in("status", ["pendente", "em_andamento"]),
        supabase
          .from("ordens_servico")
          .select("id", { count: "exact", head: true })
          .eq("oficina_id", oficinaAtual.id)
          .eq("status", "finalizado")
          .gte("data_servico", inicioMes)
          .lte("data_servico", fimMes),
        supabase.rpc("get_financeiro_resumo", {
          p_oficina_id: oficinaAtual.id,
          p_meses_historico: 1,
        }),
      ]);

      const counts = {
        totalOS: totalOS || 0,
        osFinalizadas: osFinalizadas || 0,
        totalClientes: totalClientes || 0,
        totalVeiculos: totalVeiculos || 0,
        totalFuncionarios: totalFuncionarios || 0,
        osAtrasadas7d: osAtrasadas?.length || 0,
        osParadasHoje: osHoje?.length || 0,
        osFinalizadasMes: osFinalizadasMes || 0,
        temRecorrencia: financRecorrente ? ((financRecorrente as any)?.registros || []).some((r: any) => r.recorrente) : false,
      };

      // ---- LAYER 1: ACTIVATION ----
      const steps: OnboardingStep[] = [
        { id: "cadastrar_cliente", label: "Cadastrar seu primeiro cliente", completed: counts.totalClientes > 0 },
        { id: "cadastrar_veiculo", label: "Cadastrar o veículo dele", completed: counts.totalVeiculos > 0 },
        { id: "primeira_os", label: "Abrir sua primeira OS", completed: counts.totalOS > 0 },
        { id: "finalizar_os", label: "Finalizar e faturar!", completed: counts.osFinalizadas > 0 },
      ];
      const completedSteps = steps.filter((s) => s.completed).length;
      const percentComplete = Math.round((completedSteps / steps.length) * 100);

      const activation: ActivationState = {
        steps,
        percentComplete,
        allComplete: completedSteps === steps.length,
      };

      // ---- LAYER 2: POSITIVE INDICATORS ----
      const indicators: PositiveIndicator[] = [];

      if (counts.osParadasHoje === 0 && counts.totalOS > 0) {
        indicators.push({
          id: "sem_parada_hoje",
          message: "Nenhuma OS parada hoje",
          type: "operational",
        });
      }

      if (counts.osAtrasadas7d === 0 && counts.totalOS > 0) {
        indicators.push({
          id: "sem_atraso_7d",
          message: "Nenhuma OS atrasada nos últimos 7 dias",
          type: "operational",
        });
      }

      if (counts.osFinalizadasMes >= 10) {
        indicators.push({
          id: "finalizadas_mes",
          message: `${counts.osFinalizadasMes} OS finalizadas este mês`,
          type: "financial",
        });
      }

      if (counts.totalFuncionarios > 1) {
        indicators.push({
          id: "equipe_ativa",
          message: "Equipe ativa usando o sistema",
          type: "growth",
        });
      }

      // ---- LAYER 3: GROWTH MILESTONES ----
      const milestones: GrowthMilestone[] = [];

      if (counts.totalFuncionarios >= 1) {
        milestones.push({
          id: "primeiro_func",
          label: "Primeiro membro da equipe",
          reached: true,
        });
      }

      if (counts.totalFuncionarios >= 2) {
        milestones.push({
          id: "equipe_2",
          label: "Equipe com 2+ membros",
          reached: true,
          capacityHint: "Sua oficina suporta distribuição de tarefas",
        });
      }

      const osMilestones = [10, 25, 50, 100, 250, 500];
      const reachedOS = osMilestones.filter((m) => counts.osFinalizadas >= m);
      if (reachedOS.length > 0) {
        const highest = reachedOS[reachedOS.length - 1];
        const nextMilestone = osMilestones.find((m) => m > highest);
        milestones.push({
          id: `os_${highest}`,
          label: `${highest} OS concluídas`,
          reached: true,
          capacityHint: nextMilestone
            ? `Próximo marco: ${nextMilestone} OS`
            : "Oficina operando em alta escala",
        });
      }

      if (counts.temRecorrencia) {
        milestones.push({
          id: "faturamento_recorrente",
          label: "Faturamento recorrente registrado",
          reached: true,
          capacityHint: "Base financeira mais previsível",
        });
      }

      // Determine current growth level
      let growthLevel = "Iniciando";
      if (counts.osFinalizadas >= 100) growthLevel = "Oficina consolidada";
      else if (counts.osFinalizadas >= 50) growthLevel = "Em expansão";
      else if (counts.osFinalizadas >= 10) growthLevel = "Em crescimento";
      else if (counts.osFinalizadas >= 1) growthLevel = "Primeiros passos";

      return {
        activation,
        indicators,
        milestones,
        growthLevel,
        counts,
      };
    },
    enabled: !!oficinaAtual,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  return {
    activation: data?.activation || { steps: [], percentComplete: 0, allComplete: true },
    indicators: data?.indicators || [],
    milestones: data?.milestones || [],
    growthLevel: data?.growthLevel || "",
    counts: data?.counts,
    isLoading,
  };
}
