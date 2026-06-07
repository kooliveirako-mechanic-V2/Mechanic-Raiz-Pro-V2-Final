import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Car,
  Wrench,
  Calendar,
  Package,
  FileText,
  DollarSign,
  Settings,
  Sparkles,
  Home,
  Cog,
  Receipt,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import logoMechanicRaizPro from "@/assets/logo-mechanic-raiz-pro.png";
import { Badge } from "@/components/ui/badge";
import { useSidebarData } from "@/hooks/useSidebarData";
import { usePlan } from "@/hooks/usePlan";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

interface MenuItem {
  icon: any;
  label: string;
  path: string;
  badgeKey?: "servicosAtrasados" | "estoqueBaixo" | "solicitacoesPendentes" | null;
  requiresFinanceiro?: boolean;
  isPlans?: boolean;
  iconColor?: string;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

// Menu "Mão na Graxa" - agrupado por contexto do mecânico
const menuGroups: MenuGroup[] = [
  {
    label: "Ações do Dia",
    items: [
      { icon: Users, label: "Clientes", path: "/clientes", iconColor: "text-emerald-400" },
      { icon: Car, label: "Veículos", path: "/veiculos", iconColor: "text-cyan-400" },
      { icon: Wrench, label: "Serviços", path: "/servicos", badgeKey: "servicosAtrasados", iconColor: "text-orange-400" },
      { icon: Calendar, label: "Agenda", path: "/agenda", iconColor: "text-violet-400" },
      { icon: Sparkles, label: "Solicitações", path: "/solicitacoes", badgeKey: "solicitacoesPendentes", iconColor: "text-fuchsia-400" },
    ]
  },
  {
    label: "Financeiro",
    items: [
      { icon: FileText, label: "Orçamentos", path: "/orcamentos", iconColor: "text-pink-400" },
      { icon: Package, label: "Estoque", path: "/estoque", badgeKey: "estoqueBaixo", iconColor: "text-amber-400" },
      { icon: Receipt, label: "Recebimentos", path: "/financeiro", requiresFinanceiro: true, iconColor: "text-green-400" },
      { icon: BarChart3, label: "Relatórios", path: "/relatorios", requiresFinanceiro: true, iconColor: "text-indigo-400" },
    ]
  },
  {
    label: "Minha Conta",
    items: [
      { icon: Sparkles, label: "Meu Plano", path: "/upgrade", isPlans: true, iconColor: "text-yellow-400" },
      { icon: Cog, label: "Configurações", path: "/configuracoes", iconColor: "text-slate-400" },
    ]
  }
];

export function AppSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const { data: sidebarData } = useSidebarData();
  const { isTrialActive, trialDaysRemaining, shouldShowPlans } = usePlan();
  const { canViewFinanceiro } = useUserRole();

  const isCollapsed = state === "collapsed";

  const getBadgeValue = (key: "servicosAtrasados" | "estoqueBaixo" | "solicitacoesPendentes" | null | undefined): number | null => {
    if (!key) return null;
    const value = sidebarData[key];
    return value > 0 ? value : null;
  };

  const getFilteredItems = (items: MenuItem[]) => {
    return items.filter(item => {
      if (item.requiresFinanceiro && !canViewFinanceiro) return false;
      if (item.isPlans && !shouldShowPlans) return false;
      return true;
    });
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Header com Logo */}
      <SidebarHeader className="h-[72px] flex items-center justify-center border-b border-sidebar-border px-5">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={logoMechanicRaizPro}
            alt="Mechanic Raiz Pro"
            className={isCollapsed ? "w-10 h-10 object-contain shrink-0" : "h-12 w-auto object-contain"}
          />
        </Link>
      </SidebarHeader>

      {/* Menu Principal */}
      <SidebarContent className="px-2 py-4 gap-6">
        {/* INÍCIO - sempre primeiro e destacado */}
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  isActive={location.pathname === "/"}
                  tooltip="Início"
                >
                  <Link to="/">
                    <Home className={cn(
                      "!w-5 !h-5 text-blue-400",
                      location.pathname === "/" && "drop-shadow-[0_0_6px_currentColor]"
                    )} />
                    <span className="text-[15px]">Início</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Grupos de menu */}
        {menuGroups.map((group) => {
          const filteredItems = getFilteredItems(group.items);
          if (filteredItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label} className="p-0">
              {!isCollapsed && (
                <SidebarGroupLabel className="text-[11px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest mb-2 px-3">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {filteredItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const badgeValue = getBadgeValue(item.badgeKey);
                    const isPlansItem = item.isPlans;

                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton 
                          asChild 
                          isActive={isActive}
                          tooltip={item.label}
                          className={cn(
                            isPlansItem && isTrialActive && "bg-amber-500/10 border border-amber-500/30"
                          )}
                        >
                          <Link to={item.path} className="relative">
                            <item.icon className={cn(
                              "!w-5 !h-5",
                              isPlansItem && isTrialActive ? "text-amber-500" : item.iconColor,
                              isActive && "drop-shadow-[0_0_6px_currentColor]"
                            )} />
                            <span className="text-[15px]">{item.label}</span>
                            
                            {isPlansItem && isTrialActive && !isCollapsed && (
                              <Badge className="text-[10px] px-1.5 py-0 h-5 bg-amber-500 text-white ml-auto">
                                {trialDaysRemaining}d
                              </Badge>
                            )}
                            
                            {badgeValue && !isCollapsed && (
                              <Badge 
                                variant="destructive" 
                                className="text-[10px] px-1.5 py-0 h-5 min-w-5 ml-auto"
                              >
                                {badgeValue}
                              </Badge>
                            )}
                            
                            {badgeValue && isCollapsed && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full" />
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border p-4">
        {!isCollapsed && (
          <p className="text-[11px] text-sidebar-foreground/40 leading-relaxed">
            Sistema de gestão operacional e pré-fiscal. Não emite notas fiscais.
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}