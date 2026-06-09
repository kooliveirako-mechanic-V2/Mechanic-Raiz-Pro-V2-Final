import { Sparkles, ArrowRight, Zap, Shield, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureType, featureNames } from "@/hooks/usePlan";
import { useNavigate } from "react-router-dom";
import { useOficina } from "@/contexts/OficinaContext";

/**
 * Retorna o preço baseado no tipo da oficina
 * moto → R$47,90 | carro/auto_eletrica → R$67,90 | ambos → R$97,90
 */
function getPriceByTipo(tipo?: string): string {
  switch (tipo) {
    case "moto":
      return "R$47,90/mês";
    case "carro":
    case "auto_eletrica":
      return "R$67,90/mês";
    case "ambos":
    default:
      return "R$97,90/mês";
  }
}

interface UpgradePromptProps {
  feature?: FeatureType;
  title?: string;
  description?: string;
  onUpgrade?: () => void;
}

/**
 * Componente de prompt para upgrade de plano
 * Exibido quando usuário tenta acessar feature bloqueada
 */
export function UpgradePrompt({
  feature,
  title,
  description,
  onUpgrade,
}: UpgradePromptProps) {
  const { oficinaAtual } = useOficina();
  const navigate = useNavigate();
  const featureName = feature ? featureNames[feature] : null;
  
  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      navigate("/upgrade");
    }
  };
  
  const displayTitle = title || (featureName 
    ? `${featureName} é exclusivo do plano Oficina Completa`
    : "Faça upgrade para o Oficina Completa");
  
  const displayDescription = description || (featureName
    ? `Desbloqueie ${featureName} e todas as outras funcionalidades avançadas com o plano Oficina Completa.`
    : "Tenha acesso a todas as funcionalidades avançadas para sua oficina crescer.");

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
      {/* Ícone animado */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center animate-bounce">
          <Zap className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
      </div>

      {/* Título */}
      <h2 className="text-2xl font-bold text-foreground mb-2">
        {displayTitle}
      </h2>

      {/* Descrição */}
      <p className="text-muted-foreground mb-6">
        {displayDescription}
      </p>

      {/* Benefits rápidos */}
      <div className="flex flex-wrap gap-2 justify-center mb-6">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium text-muted-foreground">
          <BarChart3 className="w-3.5 h-3.5" />
          Relatórios
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium text-muted-foreground">
          <Shield className="w-3.5 h-3.5" />
          Orçamentos Pro
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium text-muted-foreground">
          <Zap className="w-3.5 h-3.5" />
          Estoque Completo
        </div>
      </div>

      {/* CTA */}
      <Button
        size="lg"
        className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25"
        onClick={handleUpgrade}
      >
        Conhecer Oficina Completa
        <ArrowRight className="w-4 h-4" />
      </Button>

      {/* Preço */}
      <p className="mt-4 text-sm text-muted-foreground">
        A partir de <span className="font-semibold text-foreground">{getPriceByTipo(oficinaAtual?.tipo)}</span>
      </p>
    </div>
  );
}

interface UpgradeBannerProps {
  feature?: FeatureType;
  compact?: boolean;
  onUpgrade?: () => void;
}

/**
 * Banner compacto para upgrade
 */
export function UpgradeBanner({
  feature,
  compact = false,
  onUpgrade,
}: UpgradeBannerProps) {
  const navigate = useNavigate();
  const featureName = feature ? featureNames[feature] : null;

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      navigate("/upgrade");
    }
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-4 p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium">
            {featureName ? `${featureName} no Oficina Completa` : "Upgrade disponível"}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
          onClick={handleUpgrade}
        >
          Ver planos
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground mb-1">
            {featureName ? `Desbloqueie ${featureName}` : "Faça upgrade para o Oficina Completa"}
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Tenha acesso a todas as funcionalidades avançadas para sua oficina crescer.
          </p>
          <Button
            size="sm"
            className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            onClick={handleUpgrade}
          >
            Conhecer Oficina Completa
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
