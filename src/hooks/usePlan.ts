import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";

export type PlanType = "moto_pro" | "oficina_pro";
export type SubscriptionStatus = "active" | "canceled" | "past_due" | "trial" | "expired";

export type FeatureType =
  | "clientes"
  | "veiculos_moto"
  | "veiculos_carro"
  | "ordens_servico"
  | "agenda"
  | "financeiro_basico"
  | "financeiro_completo"
  | "historico"
  | "orcamentos"
  | "estoque"
  | "relatorios"
  | "dashboard_completo";

interface Subscription {
  id: string;
  oficina_id: string;
  plan_type: PlanType;
  status: SubscriptionStatus;
  started_at: string;
  expires_at: string | null;
  canceled_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
}

interface PlanFeature {
  feature: FeatureType;
  enabled: boolean;
}

// Mapeamento de features para nomes amigáveis
export const featureNames: Record<FeatureType, string> = {
  clientes: "Clientes",
  veiculos_moto: "Veículos (Moto)",
  veiculos_carro: "Veículos (Carro)",
  ordens_servico: "Ordens de Serviço",
  agenda: "Agenda",
  financeiro_basico: "Financeiro Básico",
  financeiro_completo: "Financeiro Completo",
  historico: "Histórico",
  orcamentos: "Orçamentos Profissionais",
  estoque: "Estoque",
  relatorios: "Relatórios e Gráficos",
  dashboard_completo: "Dashboard Completo",
};

// Por agora, todos os planos pagos têm acesso a todas as features
// Restrições de quantidade podem ser adicionadas depois
export const proOnlyFeatures: FeatureType[] = [];
// Features que podem ter restrições futuras de quantidade:
// - veiculos_carro, financeiro_completo, orcamentos, estoque, relatorios, dashboard_completo

export function usePlan() {
  const { oficinaAtual } = useOficina();

  // Buscar assinatura da oficina (qualquer status, não apenas active)
  const { data: subscription, isLoading: subscriptionLoading, refetch: refetchSubscription } = useQuery({
    queryKey: ["subscription", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return null;

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("oficina_id", oficinaAtual.id)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar assinatura:", error);
        return null;
      }

      return data as Subscription | null;
    },
    enabled: !!oficinaAtual,
  });

  // Determinar status real da subscription
  const getEffectiveStatus = (): SubscriptionStatus | null => {
    if (!subscription) return null;
    
    const now = new Date();
    
    // Se tem trial_ends_at, significa que é/foi trial
    if (subscription.trial_ends_at) {
      const trialEndsAt = new Date(subscription.trial_ends_at);
      if (trialEndsAt < now) {
        // Trial expirou - verificar se tem pagamento (status active sem trial)
        if (subscription.status === "active" && subscription.expires_at) {
          const expiresAt = new Date(subscription.expires_at);
          if (expiresAt >= now) {
            return "active"; // Pagou após trial
          }
        }
        return "expired";
      }
      return "trial";
    }
    
    // Status é "trial" mas sem data de expiração - tratar como trial de 14 dias desde criação
    if (subscription.status === "trial") {
      const createdAt = new Date(subscription.created_at);
      const trialEnd = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
      if (trialEnd < now) {
        return "expired";
      }
      return "trial";
    }
    
    // Se é active (pago), verificar se expirou
    if (subscription.status === "active" && subscription.expires_at) {
      const expiresAt = new Date(subscription.expires_at);
      if (expiresAt < now) {
        return "expired";
      }
      return "active";
    }
    
    // Fallback para o status original
    return subscription.status as SubscriptionStatus;
  };

  const effectiveStatus = getEffectiveStatus();

  // REGRA CRÍTICA: Sem subscription ou expirado = SEM PLANO ATIVO
  const hasActivePlan = effectiveStatus === "active" || effectiveStatus === "trial";
  const isTrialActive = effectiveStatus === "trial";
  const isTrialExpired = effectiveStatus === "expired" && subscription?.status === "trial";
  const isPlanExpired = effectiveStatus === "expired";

  // Calcular dias restantes do trial
  const getTrialDaysRemaining = (): number => {
    if (!subscription) return 0;
    
    const now = new Date();
    let trialEndDate: Date | null = null;
    
    // Primeiro, usar trial_ends_at se existir
    if (subscription.trial_ends_at) {
      trialEndDate = new Date(subscription.trial_ends_at);
    } 
    // Fallback: calcular 14 dias a partir da criação se status é trial
    else if (subscription.status === "trial") {
      const createdAt = new Date(subscription.created_at);
      trialEndDate = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    }
    
    if (!trialEndDate) return 0;
    
    const diffTime = trialEndDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const trialDaysRemaining = getTrialDaysRemaining();

  // Calcular dias desde a criação da conta para decidir se mostra planos
  // Planos só aparecem após 3 dias de uso OU se não está em trial (expirado/pago)
  const getShouldShowPlans = (): boolean => {
    // Se não tem subscription, não mostrar
    if (!subscription) return false;
    
    // Se não está em trial (expirado ou pago), sempre mostrar
    if (!isTrialActive) return true;
    
    // Se está em trial, mostrar apenas após 3 dias de uso
    const createdAt = new Date(subscription.created_at);
    const now = new Date();
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysSinceCreation >= 3;
  };

  const shouldShowPlans = getShouldShowPlans();

  // Plano atual - SÓ retorna plano se tiver subscription ATIVA
  const currentPlan: PlanType | null = hasActivePlan && subscription?.plan_type 
    ? subscription.plan_type 
    : null;
  
  const isOficinaPro = currentPlan === "oficina_pro";
  const isMotoPro = currentPlan === "moto_pro";

  // Buscar features do plano (se tiver plano ativo)
  const { data: features, isLoading: featuresLoading } = useQuery({
    queryKey: ["plan-features", currentPlan || "moto_pro"],
    queryFn: async () => {
      // Durante trial, usar features do moto_pro
      const planType = currentPlan || (isTrialActive ? "moto_pro" : "moto_pro");

      const { data, error } = await supabase
        .from("plan_features")
        .select("feature, enabled")
        .eq("plan_type", planType);

      if (error) {
        console.error("Erro ao buscar features:", error);
        return [];
      }

      return data as PlanFeature[];
    },
    enabled: !!oficinaAtual,
  });

  // Verificar se uma feature está habilitada
  // REGRA: Durante trial, TUDO liberado. Após trial, depende do plano.
  const hasFeature = (feature: FeatureType): boolean => {
    // Se não tem plano ativo e não está em trial, bloqueia tudo
    if (!hasActivePlan) {
      return false;
    }

    // TRIAL = TUDO LIBERADO (14 dias grátis com acesso total)
    if (isTrialActive) {
      return true;
    }

    // Plano pago = libera tudo também (por enquanto)
    // Futuro: pode-se restringir baseado no plano específico
    return true;
  };

  // Verificar se uma feature requer upgrade
  const requiresUpgrade = (feature: FeatureType): boolean => {
    return !hasFeature(feature);
  };

  // Helper para features específicas
  const canAccessCarro = hasFeature("veiculos_carro");
  const canAccessOrcamentos = hasFeature("orcamentos");
  const canAccessEstoque = hasFeature("estoque");
  const canAccessRelatorios = hasFeature("relatorios");
  const canAccessFinanceiroCompleto = hasFeature("financeiro_completo");
  const canAccessDashboardCompleto = hasFeature("dashboard_completo");

  // Nome do plano para exibição
  const getPlanDisplayName = (): string => {
    if (isTrialExpired || isPlanExpired) return "Expirado";
    if (isTrialActive) return "Teste Grátis";
    if (isOficinaPro) return "Oficina Completa";
    if (isMotoPro) return "Moto Pro";
    return "Sem Plano";
  };

  const planDisplayName = getPlanDisplayName();

  return {
    // Estado
    subscription,
    features,
    isLoading: subscriptionLoading || featuresLoading,
    refetchSubscription,
    
    // Status
    hasActivePlan,
    isTrialActive,
    isTrialExpired,
    isPlanExpired,
    trialDaysRemaining,
    effectiveStatus,
    shouldShowPlans,
    
    // Plano
    currentPlan,
    isOficinaPro,
    isMotoPro,
    planDisplayName,
    
    // Features
    hasFeature,
    requiresUpgrade,
    
    // Helpers específicos
    canAccessCarro,
    canAccessOrcamentos,
    canAccessEstoque,
    canAccessRelatorios,
    canAccessFinanceiroCompleto,
    canAccessDashboardCompleto,
  };
}
