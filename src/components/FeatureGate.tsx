import { ReactNode } from "react";
import { usePlan, FeatureType } from "@/hooks/usePlan";
import { LockedFeature } from "@/components/LockedFeature";
import { UpgradePrompt } from "@/components/UpgradePrompt";

interface FeatureGateProps {
  feature: FeatureType;
  children: ReactNode;
  /** 
   * Modo de exibição quando bloqueado:
   * - "preview": Mostra conteúdo em cinza com overlay (default)
   * - "prompt": Mostra tela de upgrade
   * - "hidden": Não renderiza nada
   * - "badge": Mostra badge simples
   */
  fallback?: "preview" | "prompt" | "hidden" | "badge";
  /** Mensagem customizada */
  message?: string;
  /** Callback quando usuário clica em upgrade */
  onUpgrade?: () => void;
  /** Classes CSS adicionais */
  className?: string;
}

/**
 * Componente que controla acesso a features baseado no plano
 * 
 * @example
 * ```tsx
 * <FeatureGate feature="orcamentos">
 *   <OrcamentosPage />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
  feature,
  children,
  fallback = "preview",
  message,
  onUpgrade,
  className,
}: FeatureGateProps) {
  const { hasFeature, isLoading } = usePlan();

  // Durante loading, mostra o conteúdo para evitar flash
  if (isLoading) {
    return <>{children}</>;
  }

  // Se tem acesso, renderiza normalmente
  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  // Renderiza fallback apropriado
  switch (fallback) {
    case "hidden":
      return null;

    case "prompt":
      return (
        <div className={className}>
          <UpgradePrompt feature={feature} onUpgrade={onUpgrade} />
        </div>
      );

    case "badge":
      return (
        <LockedFeature
          feature={feature}
          showPreview={false}
          message={message}
          className={className}
        >
          {children}
        </LockedFeature>
      );

    case "preview":
    default:
      return (
        <LockedFeature
          feature={feature}
          showPreview={true}
          message={message}
          className={className}
        >
          {children}
        </LockedFeature>
      );
  }
}

interface FeatureCheckProps {
  feature: FeatureType;
  children: (hasAccess: boolean) => ReactNode;
}

/**
 * Componente render prop para verificar acesso a feature
 * Útil quando você precisa de lógica condicional mais complexa
 * 
 * @example
 * ```tsx
 * <FeatureCheck feature="estoque">
 *   {(hasAccess) => (
 *     <Button disabled={!hasAccess}>
 *       {hasAccess ? "Adicionar ao Estoque" : "🔒 Estoque (Pro)"}
 *     </Button>
 *   )}
 * </FeatureCheck>
 * ```
 */
export function FeatureCheck({ feature, children }: FeatureCheckProps) {
  const { hasFeature, isLoading } = usePlan();

  // Durante loading, assume que tem acesso
  const hasAccess = isLoading ? true : hasFeature(feature);

  return <>{children(hasAccess)}</>;
}
