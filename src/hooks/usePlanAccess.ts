import { usePlan, FeatureType } from "@/hooks/usePlan";
import { useNavigate } from "react-router-dom";
import { useCallback } from "react";
import { toast } from "sonner";

/**
 * Hook para verificar e controlar acesso a features baseado no plano
 * 
 * @example
 * ```tsx
 * const { checkAccess, requireFeature } = usePlanAccess();
 * 
 * // Verificar antes de uma ação
 * const handleAction = () => {
 *   if (checkAccess("estoque")) {
 *     // executar ação
 *   }
 * };
 * 
 * // Redirecionar para upgrade se não tiver acesso
 * const handleClick = () => {
 *   requireFeature("orcamentos", () => {
 *     // ação executada apenas se tem acesso
 *   });
 * };
 * ```
 */
export function usePlanAccess() {
  const { 
    hasFeature, 
    requiresUpgrade, 
    planDisplayName, 
    isLoading,
    hasActivePlan,
    isTrialActive,
    isTrialExpired,
    isPlanExpired,
    trialDaysRemaining
  } = usePlan();
  const navigate = useNavigate();

  /**
   * Verifica se tem acesso a uma feature
   * Retorna true se tem acesso, false caso contrário
   */
  const checkAccess = useCallback(
    (feature: FeatureType): boolean => {
      if (isLoading) return true; // Durante loading, assume que tem acesso
      
      // Se não tem plano ativo, bloqueia
      if (!hasActivePlan) return false;
      
      return hasFeature(feature);
    },
    [hasFeature, isLoading, hasActivePlan]
  );

  /**
   * Verifica se uma feature requer upgrade
   * Retorna true se precisa de upgrade, false se já tem acesso
   */
  const needsUpgrade = useCallback(
    (feature: FeatureType): boolean => {
      if (isLoading) return false;
      return requiresUpgrade(feature);
    },
    [requiresUpgrade, isLoading]
  );

  /**
   * Verifica se precisa ativar um plano (trial expirado ou sem plano)
   */
  const needsActivation = useCallback((): boolean => {
    return !hasActivePlan || isTrialExpired || isPlanExpired;
  }, [hasActivePlan, isTrialExpired, isPlanExpired]);

  /**
   * Redireciona para a página de upgrade
   */
  const goToUpgrade = useCallback(() => {
    navigate("/upgrade");
  }, [navigate]);

  /**
   * Executa uma ação se tiver acesso, caso contrário redireciona para upgrade
   * @param feature - Feature necessária
   * @param action - Ação a executar se tiver acesso
   * @param options - Opções adicionais
   */
  const requireFeature = useCallback(
    (
      feature: FeatureType,
      action: () => void,
      options?: {
        showToast?: boolean;
        toastMessage?: string;
        redirect?: boolean;
      }
    ) => {
      const { showToast = true, toastMessage, redirect = true } = options || {};

      // Primeiro verifica se precisa ativar plano
      if (needsActivation()) {
        if (showToast) {
          toast.error(
            "Ative um plano para continuar",
            {
              description: "Seu período de teste expirou. Escolha um plano para continuar usando.",
              action: {
                label: "Ver planos",
                onClick: goToUpgrade,
              },
            }
          );
        }
        if (redirect) {
          goToUpgrade();
        }
        return;
      }

      if (checkAccess(feature)) {
        action();
        return;
      }

      if (showToast) {
        toast.error(
          toastMessage || "Recurso disponível no plano Oficina Pro",
          {
            description: "Faça upgrade para acessar este recurso",
            action: {
              label: "Ver planos",
              onClick: goToUpgrade,
            },
          }
        );
      }

      if (redirect) {
        goToUpgrade();
      }
    },
    [checkAccess, goToUpgrade, needsActivation]
  );

  /**
   * Wrapper para evento de clique que verifica acesso
   * Útil para passar diretamente como onClick
   */
  const withAccessCheck = useCallback(
    (feature: FeatureType, handler: () => void) => {
      return () => requireFeature(feature, handler);
    },
    [requireFeature]
  );

  /**
   * Retorna classe CSS baseada no acesso
   * Útil para estilizar elementos bloqueados
   */
  const getAccessClass = useCallback(
    (feature: FeatureType) => {
      if (needsUpgrade(feature)) {
        return "opacity-50 cursor-not-allowed";
      }
      return "";
    },
    [needsUpgrade]
  );

  return {
    // State
    isLoading,
    planDisplayName,
    hasActivePlan,
    isTrialActive,
    isTrialExpired,
    isPlanExpired,
    trialDaysRemaining,
    
    // Checkers
    checkAccess,
    needsUpgrade,
    needsActivation,
    hasFeature,
    
    // Actions
    goToUpgrade,
    requireFeature,
    withAccessCheck,
    
    // Helpers
    getAccessClass,
  };
}
