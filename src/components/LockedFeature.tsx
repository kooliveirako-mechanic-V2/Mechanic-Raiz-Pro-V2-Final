import { ReactNode } from "react";
import { Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { FeatureType, featureNames } from "@/hooks/usePlan";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LockedFeatureProps {
  feature: FeatureType;
  children: ReactNode;
  className?: string;
  /** Se true, mostra o conteúdo em cinza com overlay. Se false, substitui completamente */
  showPreview?: boolean;
  /** Mensagem customizada para o tooltip */
  message?: string;
}

/**
 * Componente que exibe uma feature bloqueada com visual de upgrade
 * Usado para mostrar features exclusivas do plano Oficina Pro
 */
export function LockedFeature({
  feature,
  children,
  className,
  showPreview = true,
  message,
}: LockedFeatureProps) {
  const featureName = featureNames[feature];
  const tooltipMessage = message || `${featureName} disponível no plano Oficina Pro`;

  if (showPreview) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("relative cursor-not-allowed", className)}>
            {/* Conteúdo original em cinza */}
            <div className="opacity-40 grayscale pointer-events-none select-none">
              {children}
            </div>
            
            {/* Overlay com ícone de cadeado */}
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px] rounded-lg">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/90 rounded-full border border-border/50 shadow-sm">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  Oficina Pro
                </span>
              </div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>{tooltipMessage}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Versão compacta - apenas badge
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-dashed border-border cursor-not-allowed",
            className
          )}
        >
          <Lock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{featureName}</span>
          <span className="ml-auto text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2 py-0.5 rounded-full font-medium">
            PRO
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>{tooltipMessage}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface LockedButtonProps {
  feature: FeatureType;
  children: ReactNode;
  className?: string;
  message?: string;
}

/**
 * Botão bloqueado com visual de upgrade
 */
export function LockedButton({
  feature,
  children,
  className,
  message,
}: LockedButtonProps) {
  const featureName = featureNames[feature];
  const tooltipMessage = message || `${featureName} disponível no plano Oficina Pro`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          disabled
          className={cn(
            "relative inline-flex items-center justify-center gap-2 px-4 py-2",
            "bg-muted/50 text-muted-foreground rounded-lg border border-dashed border-border",
            "cursor-not-allowed opacity-70",
            className
          )}
        >
          <Lock className="w-4 h-4" />
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>{tooltipMessage}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface LockedNavItemProps {
  feature: FeatureType;
  icon: ReactNode;
  label: string;
  className?: string;
}

/**
 * Item de navegação bloqueado (para sidebar/menu)
 */
export function LockedNavItem({
  feature,
  icon,
  label,
  className,
}: LockedNavItemProps) {
  const featureName = featureNames[feature];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg",
            "text-muted-foreground/50 cursor-not-allowed",
            "hover:bg-muted/30 transition-colors",
            className
          )}
        >
          <div className="opacity-50">{icon}</div>
          <span className="flex-1 text-sm opacity-50">{label}</span>
          <Lock className="w-3.5 h-3.5" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>{featureName} disponível no plano Oficina Pro</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
