import { useNavigate } from "react-router-dom";
import { Wrench, AlertTriangle, Package, Bell, Clock } from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { useSidebarData } from "@/hooks/useSidebarData";
import { cn } from "@/lib/utils";

interface SummaryItem {
  icon: React.ElementType;
  label: string;
  value: number;
  path: string;
  color: string;
  bgColor: string;
  urgent?: boolean;
}

export function MobileOperationalSummary() {
  const navigate = useNavigate();
  const { stats } = useDashboard();
  const { data: sidebarData } = useSidebarData();

  const items: SummaryItem[] = [
    {
      icon: Wrench,
      label: "OS Hoje",
      value: stats.servicosHoje,
      path: "/servicos",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: AlertTriangle,
      label: "Atrasadas",
      value: stats.servicosAtrasados,
      path: "/servicos",
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      urgent: stats.servicosAtrasados > 0,
    },
    {
      icon: Package,
      label: "Estoque baixo",
      value: sidebarData.estoqueBaixo,
      path: "/estoque",
      color: "text-warning",
      bgColor: "bg-warning/10",
      urgent: sidebarData.estoqueBaixo > 0,
    },
    {
      icon: Bell,
      label: "Avisos",
      value: sidebarData.notificacoesNaoLidas,
      path: "/notificacoes",
      color: "text-muted-foreground",
      bgColor: "bg-muted",
    },
  ];

  const hasAnyActivity = stats.servicosHoje > 0 || stats.servicosAtrasados > 0 || sidebarData.estoqueBaixo > 0 || sidebarData.notificacoesNaoLidas > 0;
  if (!hasAnyActivity && stats.totalClientes === 0) return null;

  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
        Situação agora
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex flex-col items-center gap-0.5 p-2.5 rounded-lg border border-border/40 bg-card",
              "active:scale-[0.97] transition-transform",
              item.urgent && "border-destructive/30 bg-destructive/5"
            )}
          >
            <div className={cn("w-7 h-7 rounded-md flex items-center justify-center", item.bgColor)}>
              <item.icon className={cn("w-3.5 h-3.5", item.color)} />
            </div>
            <span className={cn(
              "text-base font-bold leading-none",
              item.urgent ? "text-destructive" : "text-foreground"
            )}>
              {item.value}
            </span>
            <span className="text-[9px] text-muted-foreground leading-tight text-center">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
