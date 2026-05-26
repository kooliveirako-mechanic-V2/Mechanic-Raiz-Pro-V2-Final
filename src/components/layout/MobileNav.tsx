import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  Home,
  Users,
  Car,
  Wrench,
  Calendar,
  Package,
  FileText,
  Receipt,
  Settings,
  Bell,
  LogOut,
  Sparkles,
  Sun,
  Moon,
  Cog,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useOficina } from "@/contexts/OficinaContext";
import { usePlan } from "@/hooks/usePlan";
import { useSidebarData } from "@/hooks/useSidebarData";
import { useUserRole } from "@/hooks/useUserRole";
import { ThemeSelectorCompact } from "@/components/ThemeSelector";

// Menu "Mão na Graxa" com terminologia simplificada
const menuGroups = [
  {
    label: "Ações do Dia",
    items: [
      { icon: Users, label: "Clientes", path: "/clientes", iconColor: "text-emerald-400" },
      { icon: Car, label: "Veículos", path: "/veiculos", iconColor: "text-cyan-400" },
      { icon: Wrench, label: "Serviços", path: "/servicos", badgeKey: "servicosAtrasados", iconColor: "text-orange-400" },
      { icon: Calendar, label: "Agenda", path: "/agenda", iconColor: "text-violet-400" },
    ]
  },
  {
    label: "Financeiro",
    items: [
      { icon: FileText, label: "Orçamentos", path: "/orcamentos", iconColor: "text-pink-400" },
      { icon: Package, label: "Estoque", path: "/estoque", badgeKey: "estoqueBaixo", iconColor: "text-amber-400" },
      { icon: Receipt, label: "Recebimentos", path: "/financeiro", requiresFinanceiro: true, iconColor: "text-green-400" },
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

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { oficinaAtual } = useOficina();
  const { isTrialActive, trialDaysRemaining, shouldShowPlans } = usePlan();
  const { theme, setTheme } = useTheme();
  const { data: sidebarData } = useSidebarData();
  const { canViewFinanceiro } = useUserRole();

  const userName = user?.user_metadata?.nome || user?.email?.split("@")[0] || "Usuário";
  const userInitials = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  const getBadgeValue = (key?: string) => {
    if (!key) return null;
    const value = sidebarData[key as keyof typeof sidebarData];
    return typeof value === 'number' && value > 0 ? value : null;
  };

  return (
    <header 
      className="fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 lg:hidden safe-top"
      style={{ minHeight: '3.5rem' }}
    >
      {/* Logo + Nome da Oficina */}
      <Link to="/" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
          <Wrench className="w-4 h-4 text-accent-foreground" />
        </div>
        <span className="font-bold text-sidebar-foreground text-sm truncate max-w-[140px]">
          {oficinaAtual?.nome || "Mechanic Raiz Pro"}
        </span>
      </Link>

      {/* Tema + Notificações + Menu */}
      <div className="flex items-center gap-1">
        <ThemeSelectorCompact />

        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg"
          asChild
        >
          <Link to="/notificacoes">
            <Bell className="w-5 h-5" />
            {sidebarData.notificacoesNaoLidas > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
            )}
          </Link>
        </Button>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent 
            side="right" 
            className="w-72 bg-sidebar border-sidebar-border p-0"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
                <span className="font-semibold text-sidebar-foreground">Menu</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Nav */}
              <nav className="flex-1 overflow-y-auto py-2">
                {/* Início */}
                <div className="px-3 mb-2">
                  <Link
                    to="/"
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                      location.pathname === "/"
                        ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <Home className={cn(
                      "w-5 h-5 text-blue-400",
                      location.pathname === "/" && "drop-shadow-[0_0_6px_currentColor]"
                    )} />
                    <span>Início</span>
                  </Link>
                </div>

                <Separator className="my-2 bg-sidebar-border/50" />

                {menuGroups.map((group) => {
                  const visibleItems = group.items.filter(item => {
                    if ((item as any).requiresFinanceiro && !canViewFinanceiro) return false;
                    if ((item as any).isPlans && !shouldShowPlans) return false;
                    return true;
                  });
                  if (visibleItems.length === 0) return null;

                  return (
                    <div key={group.label} className="px-3 py-2">
                      <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mb-2">
                        {group.label}
                      </p>
                      <div className="space-y-0.5">
                        {visibleItems.map((item) => {
                          const isActive = location.pathname === item.path;
                          const isPlansItem = (item as any).isPlans;
                          const badgeValue = getBadgeValue((item as any).badgeKey);
                          
                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              onClick={() => setOpen(false)}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                                isActive
                                  ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                                isPlansItem && isTrialActive && "bg-amber-500/10 border border-amber-500/20"
                              )}
                            >
                              <item.icon className={cn(
                                "w-5 h-5", 
                                isPlansItem && isTrialActive 
                                  ? "text-amber-500" 
                                  : (item as any).iconColor || "text-sidebar-foreground",
                                isActive && "drop-shadow-[0_0_6px_currentColor]"
                              )} />
                              <span className="flex-1">{item.label}</span>
                              
                              {isPlansItem && isTrialActive && (
                                <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-500 text-white">
                                  {trialDaysRemaining}d
                                </Badge>
                              )}
                              
                              {badgeValue && (
                                <Badge 
                                  variant="destructive" 
                                  className="text-[10px] px-1.5 py-0 h-4 bg-destructive"
                                >
                                  {badgeValue}
                                </Badge>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </nav>

              {/* Footer */}
              <div className="border-t border-sidebar-border p-3 space-y-2">
                <div className="px-1">
                  <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-2 mb-2">
                    Aparência
                  </p>
                  <div className="flex gap-2">
                    {[
                      { value: "light", label: "Claro", Icon: Sun },
                      { value: "dark", label: "Escuro", Icon: Moon },
                    ].map(({ value, label, Icon }) => {
                      const isActive = theme === value;
                      return (
                        <button
                          key={value}
                          onClick={() => setTheme(value)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-colors",
                            isActive
                              ? "bg-accent text-accent-foreground font-semibold"
                              : "bg-sidebar-accent/30 text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-sm">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Separator className="bg-sidebar-border/50" />

                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-sidebar-accent/30">
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-xs font-semibold">
                    {userInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">
                      {userName}
                    </p>
                    <p className="text-[11px] text-sidebar-foreground/50 truncate">
                      {oficinaAtual?.nome || "Oficina"}
                    </p>
                  </div>
                </div>

                <Separator className="bg-sidebar-border/50" />
                
                <Button
                  variant="ghost"
                  onClick={() => {
                    signOut();
                    setOpen(false);
                  }}
                  className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg h-10"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm">Sair da conta</span>
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}