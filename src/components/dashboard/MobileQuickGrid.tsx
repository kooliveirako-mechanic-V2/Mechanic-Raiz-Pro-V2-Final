import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wrench,
  Users,
  Car,
  Package,
  Calendar,
  DollarSign,
  FileText,
  Zap,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useOficinaLabels } from "@/hooks/useOficinaLabels";

const allShortcuts = [
  { icon: Wrench, label: "Serviços", path: "/servicos", color: "text-primary", bg: "bg-primary/10" },
  { icon: Users, label: "Clientes", path: "/clientes", color: "text-success", bg: "bg-success/10" },
  { icon: Car, label: "Veículos", path: "/veiculos", color: "text-info", bg: "bg-info/10" },
  { icon: Package, label: "Estoque", path: "/estoque", color: "text-warning", bg: "bg-warning/10" },
  { icon: Calendar, label: "Agenda", path: "/agenda", color: "text-accent", bg: "bg-accent/10" },
  { icon: FileText, label: "Orçamentos", path: "/orcamentos", color: "text-highlight", bg: "bg-highlight/10" },
];

const financialShortcut = {
  icon: DollarSign,
  label: "Financeiro",
  path: "/financeiro",
  color: "text-success",
  bg: "bg-success/10",
};

export function MobileQuickGrid() {
  const navigate = useNavigate();
  const { canViewFinanceiro } = useUserRole();
  const { isAutoEletrica } = useOficinaLabels();
  const [expanded, setExpanded] = useState(false);

  let shortcuts = [...allShortcuts];
  if (canViewFinanceiro) {
    shortcuts.splice(3, 0, financialShortcut);
  }

  if (isAutoEletrica) {
    shortcuts = shortcuts.map((s) =>
      s.label === "Serviços"
        ? { ...s, icon: Zap, label: "Diagnósticos", color: "text-warning", bg: "bg-warning/10" }
        : s
    );
  }

  const visibleShortcuts = expanded ? shortcuts : shortcuts.slice(0, 6);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Navegação Rápida
        </h2>
        {shortcuts.length > 6 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-primary font-medium flex items-center gap-0.5"
          >
            {expanded ? "Menos" : "Mais"}
            <ChevronRight
              className={cn(
                "w-3.5 h-3.5 transition-transform",
                expanded && "rotate-90"
              )}
            />
          </button>
        )}
      </div>

      {/* Grid 3 columns - larger cards with better spacing */}
      <div className="grid grid-cols-3 gap-3">
        {visibleShortcuts.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-2 py-4 px-2 rounded-2xl bg-card border border-border/60 active:scale-[0.96] transition-transform shadow-sm"
            >
              <div
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center",
                  item.bg
                )}
              >
                <Icon className={cn("w-5 h-5", item.color)} />
              </div>
              <span className="text-[11px] font-medium text-foreground leading-tight text-center">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
