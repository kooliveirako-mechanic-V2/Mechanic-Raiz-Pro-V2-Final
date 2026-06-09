import { useNavigate } from "react-router-dom";
import { Wrench, Users, Car, Package, DollarSign, Calendar, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

const quickLinks = [
  {
    icon: Wrench,
    label: "Serviços",
    path: "/servicos",
    emoji: "🔧",
  },
  {
    icon: Users,
    label: "Clientes",
    path: "/clientes",
    emoji: "👥",
  },
  {
    icon: Car,
    label: "Veículos",
    path: "/veiculos",
    emoji: "🚗",
  },
  {
    icon: Package,
    label: "Estoque",
    path: "/estoque",
    emoji: "📦",
  },
  {
    icon: DollarSign,
    label: "Financeiro",
    path: "/financeiro",
    emoji: "💰",
  },
  {
    icon: Calendar,
    label: "Agenda",
    path: "/agenda",
    emoji: "📅",
  },
  {
    icon: ClipboardList,
    label: "Orçamentos",
    path: "/orcamentos",
    emoji: "📋",
  },
];

export function MobileQuickAccess() {
  const navigate = useNavigate();

  return (
    <div>
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
        Acesso Rápido
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {quickLinks.map((link) => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className={cn(
              "flex items-center gap-3 px-4 py-4 rounded-xl border border-border/50 bg-card",
              "active:scale-[0.97] transition-all duration-150",
              "shadow-sm"
            )}
          >
            <span className="text-2xl" role="img">{link.emoji}</span>
            <span className="text-sm font-semibold text-foreground">{link.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
