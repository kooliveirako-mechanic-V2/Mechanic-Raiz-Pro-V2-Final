import { Wrench, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useDashboard } from "@/hooks/useDashboard";
import { useAuth } from "@/contexts/AuthContext";
import { PullToRefreshIndicator } from "./PullToRefreshIndicator";
import { PageLoader } from "@/components/ui/loading-states";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useOficina } from "@/contexts/OficinaContext";
import { MobileQuickSearch } from "./MobileQuickSearch";
import { MobileQuickAccess } from "./MobileQuickAccess";
import { EmptyDashboardMotivational } from "./EmptyDashboardMotivational";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useGuidedTour } from "@/hooks/useGuidedTour";
import { OnboardingChecklist } from "@/components/gamification/OnboardingChecklist";
import { MobileOperationalSummary } from "./MobileOperationalSummary";
import { MobileActiveOSList } from "./MobileActiveOSList";
import { ActivationCTA } from "./ActivationCTA";
import { useGamification } from "@/hooks/useGamification";

export function MobileDashboard() {
  const { user } = useAuth();
  const { stats, isLoading } = useDashboard();
  const { oficinaAtual } = useOficina();
  const { containerRef, isRefreshing, pullDistance } = usePullToRefresh();
  const { startTour, shouldShowTour } = useGuidedTour();
  const { activation, counts } = useGamification();

  const [profileName, setProfileName] = useState<string | null>(null);
  const [prejuizosDismissed, setPrejuizosDismissed] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem("prejuizos-card-dismissed-mobile") === "1"
  );

  useEffect(() => {
    if (!isLoading && oficinaAtual && shouldShowTour()) {
      startTour();
    }
  }, [isLoading, oficinaAtual]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user?.id) {
      supabase
        .from("profiles")
        .select("nome")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.nome) setProfileName(data.nome);
        });
    }
  }, [user?.id]);

  const metaName = user?.user_metadata?.nome;
  const isGenericName = !metaName || /teste/i.test(metaName);
  const userName = profileName || (!isGenericName ? metaName : null) || user?.email?.split("@")[0] || "Usuário";
  const firstName = userName.split(" ")[0];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: "Bom dia", emoji: "☀️" };
    if (hour < 18) return { text: "Boa tarde", emoji: "🌤️" };
    return { text: "Boa noite", emoji: "🌙" };
  };

  const greeting = getGreeting();

  if (isLoading) {
    return <PageLoader message="Carregando..." />;
  }

  const isNewUser = stats.totalClientes === 0;
  const hasClients = (counts?.totalClientes ?? 0) > 0;
  const hasOS = (counts?.totalOS ?? 0) > 0;
  const hasFinalized = (counts?.osFinalizadas ?? 0) > 0;

  const isCamadaB = hasClients && !hasOS;
  const isCamadaC = hasOS && !hasFinalized;

  return (
    <div ref={containerRef} className="space-y-4 pt-2 w-full max-w-full overflow-x-hidden">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-1.5">
            {greeting.text}, {firstName}!
            <span className="text-xl" role="img">{greeting.emoji}</span>
          </h1>
          <p className="text-xs text-muted-foreground capitalize">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        {stats.servicosHoje > 0 && (
          <div className="flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-full">
            <Wrench className="w-3 h-3 text-primary" />
            <span className="text-[11px] font-bold text-primary">{stats.servicosHoje} hoje</span>
          </div>
        )}
      </div>

      {/* ── BUSCA ── */}
      <div data-tour="busca-global">
        <MobileQuickSearch />
      </div>

      {/* ── CHECKLIST (só para novos/parciais) ── */}
      <OnboardingChecklist />

      {/* ── EMPTY STATE ── */}
      {isNewUser && <EmptyDashboardMotivational />}

      {/* ── ATIVAÇÃO ── */}
      {isCamadaB && <ActivationCTA stage="first_os" />}
      {isCamadaC && <ActivationCTA stage="finalize_os" osCount={counts?.totalOS ?? 0} />}

      {/* ── SITUAÇÃO AGORA (compacta) ── */}
      {hasFinalized && <MobileOperationalSummary />}

      {/* ── PREJUÍZOS DO MÊS (só se > 0) ── */}
      {stats.prejuizosMes > 0 && !prejuizosDismissed && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 flex items-center gap-3">
          <div className="rounded-lg bg-destructive/20 p-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-medium text-destructive/80 uppercase tracking-wide">
              ⚠️ Prejuízos do mês
            </p>
            <p className="text-lg font-bold text-destructive">
              {formatCurrency(stats.prejuizosMes)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem("prejuizos-card-dismissed-mobile", "1");
              setPrejuizosDismissed(true);
            }}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-destructive/70 active:bg-destructive/10"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </div>
      )}

      {/* ── ACESSO RÁPIDO (grid 2 colunas, grande, como layout antigo) ── */}
      <MobileQuickAccess />

      {/* ── OS EM ANDAMENTO ── */}
      {hasOS && <MobileActiveOSList />}
    </div>
  );
}
