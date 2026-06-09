import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { MobileDashboard } from "@/components/dashboard/MobileDashboard";
import { StatCard } from "@/components/dashboard/StatCard";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { TodayAgendaPanel } from "@/components/dashboard/TodayAgendaPanel";
import { DashboardQuickSearch } from "@/components/dashboard/DashboardQuickSearch";
import { CriticalAlertsBanner } from "@/components/dashboard/CriticalAlertsBanner";
import { EmptyDashboardMotivational } from "@/components/dashboard/EmptyDashboardMotivational";
import { ActivationCTA } from "@/components/dashboard/ActivationCTA";
import { OSEmAndamentoPanel } from "@/components/dashboard/OSEmAndamentoPanel";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { MonthlyComparison } from "@/components/dashboard/MonthlyComparison";
import { Wrench, DollarSign, Users, TrendingUp, AlertTriangle } from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useGamification } from "@/hooks/useGamification";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { PageLoader } from "@/components/ui/loading-states";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRouteRestore } from "@/hooks/useRouteRestore";
import { ActivationWizard } from "@/components/onboarding/ActivationWizard";
import { InactivityWhatsAppRescue } from "@/components/onboarding/InactivityWhatsAppRescue";
import { useOficina } from "@/contexts/OficinaContext";
import { trackFunnelEvent } from "@/lib/funnelTracking";

export default function Index() {
  const { user } = useAuth();
  const { metrics, chartData, monthlyComparison, isLoading, auditoriaLimpa } = useDashboard();
  const { canViewFaturamento, canViewLucro } = useUserRole();
  const isMobile = useIsMobile();
  const { counts } = useGamification();
  const { oficinaAtual } = useOficina();
  const [searchParams, setSearchParams] = useSearchParams();

  const [prejuizosDismissed, setPrejuizosDismissed] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem("prejuizos-card-dismissed") === "1"
  );

  useRouteRestore();

  useEffect(() => {
    const source = searchParams.get("utm_source");
    if (source === "email" && oficinaAtual?.id) {
      trackFunnelEvent({ event: "returned_after_email", oficina_id: oficinaAtual.id, source: searchParams.get("utm_campaign") || "email" });
      searchParams.delete("utm_source");
      searchParams.delete("utm_campaign");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, oficinaAtual?.id]);

  if (isMobile) {
    return (
      <MainLayout>
        <MobileDashboard />
        <ActivationWizard />
        <InactivityWhatsAppRescue />
      </MainLayout>
    );
  }

  if (isLoading) {
    return (
      <MainLayout>
        <PageLoader message="Carregando dashboard..." />
      </MainLayout>
    );
  }

  const userName = user?.user_metadata?.nome || user?.email?.split("@")[0] || "Usuário";
  const firstName = userName.split(" ")[0];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const hasFinalized = (counts?.osFinalizadas ?? 0) > 0;
  const isNewUser = (counts?.totalClientes ?? 0) === 0;
  const isCamadaB = (counts?.totalClientes ?? 0) > 0 && (counts?.totalOS ?? 0) === 0;
  const isCamadaC = (counts?.totalOS ?? 0) > 0 && !hasFinalized;
  const isActivated = hasFinalized;

  return (
    <MainLayout>
      <ActivationWizard />
      <InactivityWhatsAppRescue />

      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4"
        >
          <div className="shrink-0">
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-xs text-muted-foreground capitalize">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
          <div className="flex-1 max-w-sm">
            <DashboardQuickSearch />
          </div>
        </motion.div>

        <CriticalAlertsBanner />

        {isNewUser && <EmptyDashboardMotivational />}
        {isCamadaB && <ActivationCTA stage="first_os" />}
        {isCamadaC && <ActivationCTA stage="finalize_os" osCount={counts?.totalOS ?? 0} />}

        {isActivated && metrics && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="Serviços Hoje"
              value={metrics.servicosHoje}
              subtitle={`${metrics.servicosFinalizadosHoje} finalizados`}
              icon={Wrench}
              variant="primary"
              delay={0}
            />
            {canViewFaturamento && (
              <StatCard
                title="Faturamento Mês"
                value={formatCurrency(metrics.faturamentoMes)}
                icon={DollarSign}
                variant="success"
                delay={0.03}
                isModoLimpo={auditoriaLimpa?.isModoLimpo}
              />
            )}
            {canViewLucro && (
              <StatCard
                title="Lucro Operacional"
                value={formatCurrency(metrics.lucroOperacional)}
                icon={TrendingUp}
                variant="accent"
                delay={0.06}
                isModoLimpo={auditoriaLimpa?.isModoLimpo}
              />
            )}
            <StatCard
              title="Clientes"
              value={metrics.totalClientes} // Alterado de clientesMes para totalClientes
              subtitle={`${metrics.clientesMes} novos este mês`}
              icon={Users}
              variant="warning"
              delay={0.09}
            />
          </div>
        )}

        {isActivated && canViewLucro && metrics && (metrics.cmvTotal + metrics.perdasOperacionais) > 0 && !prejuizosDismissed && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 flex items-center gap-3 shadow-sm"
          >
            <div className="rounded-lg bg-destructive/20 p-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-destructive/80 uppercase tracking-wide">
                ⚠️ Prejuízos/CMV do mês
              </p>
              <p className="text-xl font-bold text-destructive">
                {formatCurrency(metrics.cmvTotal + metrics.perdasOperacionais)}
              </p>
            </div>
            <p className="text-[11px] text-destructive/70 hidden sm:block">
              Custo de Peças + Perdas (Retrabalho, garantia, etc)
            </p>
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem("prejuizos-card-dismissed", "1");
                setPrejuizosDismissed(true);
              }}
              aria-label="Fechar"
              className="ml-2 rounded-md p-1 text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </motion.div>
        )}

        {isActivated && <DashboardQuickActions />}

        {isActivated && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <OSEmAndamentoPanel />
            <TodayAgendaPanel />
          </div>
        )}

        {isActivated && canViewFaturamento && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <RevenueChart data={chartData} />
            </div>
            {monthlyComparison && (
              <MonthlyComparison
                currentMonth={monthlyComparison.currentMonth}
                previousMonth={monthlyComparison.previousMonth}
              />
            )}
          </div>
        )}

        {isActivated && (
          <div id="alerts-panel">
            <AlertsPanel />
          </div>
        )}
      </div>
    </MainLayout>
  );
}
