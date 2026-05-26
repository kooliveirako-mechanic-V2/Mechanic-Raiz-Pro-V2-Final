import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Clock, AlertTriangle, Zap, X, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlan } from "@/hooks/usePlan";
import { useGamification } from "@/hooks/useGamification";
import { useOficina } from "@/contexts/OficinaContext";
import { trackFunnelEvent } from "@/lib/funnelTracking";

interface TrialBannerProps {
  compact?: boolean;
}

const DISMISS_KEY = "trial-banner-dismissed-date";

export function TrialBanner({ compact = false }: TrialBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const { 
    isTrialActive, 
    isTrialExpired, 
    isPlanExpired, 
    trialDaysRemaining,
    hasActivePlan 
  } = usePlan();
  const { counts } = useGamification();
  const { oficinaAtual } = useOficina();

  useEffect(() => {
    const dismissedDate = localStorage.getItem(DISMISS_KEY);
    const today = new Date().toDateString();
    if (dismissedDate === today) {
      setIsDismissed(true);
    } else {
      setIsDismissed(false);
    }
  }, []);

  // Track trial banner visibility
  useEffect(() => {
    if (oficinaAtual?.id && (isTrialActive || isTrialExpired || isPlanExpired)) {
      if (isTrialExpired || isPlanExpired) {
        trackFunnelEvent({ event: "trial_expired", oficina_id: oficinaAtual.id, source: "trial_banner" });
      } else if (isTrialActive && trialDaysRemaining !== null && trialDaysRemaining <= 3) {
        trackFunnelEvent({ event: "trial_expiring_banner_seen", oficina_id: oficinaAtual.id, metadata: { days_remaining: trialDaysRemaining } });
      }
    }
  }, [oficinaAtual?.id, isTrialActive, isTrialExpired, isPlanExpired, trialDaysRemaining]);

  const handleDismiss = () => {
    const today = new Date().toDateString();
    localStorage.setItem(DISMISS_KEY, today);
    setIsDismissed(true);
  };

  if (hasActivePlan && !isTrialActive) {
    return null;
  }

  // Trial/Plano EXPIRADO - Banner VERMELHO GRANDE - NUNCA fecha
  if (isTrialExpired || isPlanExpired) {
    if (compact) {
      return (
        <Link 
          to="/upgrade"
          className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors animate-pulse"
        >
          <AlertTriangle className="w-4 h-4" />
          <span>EXPIRADO</span>
        </Link>
      );
    }

    return (
      <div className="bg-red-600 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-[0_4px_20px_-4px_rgba(220,38,38,0.5)]">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm sm:text-lg leading-tight">
              SEU TESTE EXPIROU!
            </p>
            <p className="text-white/90 text-xs sm:text-sm leading-tight">
              {counts && counts.osFinalizadas > 0 
                ? `Você já finalizou ${counts.osFinalizadas} OS e atendeu ${counts.totalClientes} clientes. Não perca esse progresso!`
                : "Ative um plano para continuar usando o sistema"}
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="w-full sm:w-auto mt-2.5 sm:mt-3 bg-green-500 hover:bg-green-600 text-white font-bold text-sm sm:text-base h-9 sm:h-11 px-4 sm:px-6 shadow-lg shadow-green-500/30">
          <Link to="/upgrade">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            ATIVAR PLANO — NÃO PERDER DADOS
          </Link>
        </Button>
      </div>
    );
  }

  // Trial ativo
  if (isTrialActive) {
    const urgency = trialDaysRemaining <= 3;
    const showUsageSummary = trialDaysRemaining <= 3 && counts;
    
    if (compact) {
      return (
        <Link 
          to="/upgrade"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
            urgency 
              ? "bg-amber-100 text-amber-700 hover:bg-amber-200" 
              : "bg-blue-100 text-blue-700 hover:bg-blue-200"
          }`}
        >
          <Clock className="w-3 h-3" />
          <span>{trialDaysRemaining}d</span>
        </Link>
      );
    }

    if (isDismissed) {
      return null;
    }

    return (
      <div className={`rounded-xl p-3 relative ${
        urgency 
          ? "bg-amber-500/10 border border-amber-500/30" 
          : "bg-blue-500/10 border border-blue-500/30"
      }`}>
        <button 
          onClick={handleDismiss}
          className={`absolute top-2 right-2 p-1 rounded-full transition-colors ${
            urgency 
              ? "hover:bg-amber-500/20 text-amber-500" 
              : "hover:bg-blue-500/20 text-blue-500"
          }`}
          aria-label="Fechar aviso"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 pr-6">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
            urgency ? "bg-amber-500/20" : "bg-blue-500/20"
          }`}>
            <Clock className={`w-4 h-4 ${urgency ? "text-amber-500" : "text-blue-500"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm ${urgency ? "text-amber-500" : "text-blue-500"}`}>
              {trialDaysRemaining} {trialDaysRemaining === 1 ? "dia" : "dias"} de teste
            </p>
            <p className="text-xs text-muted-foreground">
              {urgency ? "Está acabando!" : "Explore tudo grátis"}
            </p>
          </div>
          <Button 
            asChild 
            size="sm"
            className={`h-8 px-3 text-xs ${urgency 
              ? "bg-amber-600 hover:bg-amber-700" 
              : "bg-[hsl(199,100%,36%)] hover:bg-[hsl(199,100%,28%)]"
            }`}
          >
            <Link to="/upgrade">
              <Zap className="w-3 h-3 mr-1" />
              Ativar
            </Link>
          </Button>
        </div>

        {/* Usage summary when trial is ending */}
        {showUsageSummary && counts.osFinalizadas > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-amber-500/20">
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-semibold text-amber-700">Seu progresso até agora:</span>
            </div>
            <div className="flex gap-3 text-xs text-amber-700/80">
              <span>{counts.osFinalizadas} OS finalizadas</span>
              <span>•</span>
              <span>{counts.totalClientes} clientes</span>
              <span>•</span>
              <span>{counts.totalVeiculos} veículos</span>
            </div>
            <p className="text-[11px] text-amber-600/70 mt-1">
              Ative um plano para não perder esses dados
            </p>
          </div>
        )}
      </div>
    );
  }

  return null;
}