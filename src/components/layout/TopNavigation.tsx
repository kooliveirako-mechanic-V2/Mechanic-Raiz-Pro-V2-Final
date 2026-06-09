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
  LogOut,
  Bell,
  ChevronDown,
  Check,
  Building2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useOficina } from "@/contexts/OficinaContext";
import { useSidebarData } from "@/hooks/useSidebarData";
import { usePlan } from "@/hooks/usePlan";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MenuItem {
  icon: any;
  label: string;
  path: string;
  badgeKey: "servicosAtrasados" | "estoqueBaixo" | null;
  requiresFinanceiro?: boolean;
}

// Menu completo
const menuItemsConfig: MenuItem[] = [
  { icon: LayoutDashboard, label: "Início", path: "/", badgeKey: null },
  { icon: Users, label: "Clientes", path: "/clientes", badgeKey: null },
  { icon: Car, label: "Veículos", path: "/veiculos", badgeKey: null },
  { icon: Wrench, label: "Serviços", path: "/servicos", badgeKey: "servicosAtrasados" },
  { icon: Calendar, label: "Agenda", path: "/agenda", badgeKey: null },
  { icon: Package, label: "Estoque", path: "/estoque", badgeKey: "estoqueBaixo" },
  { icon: FileText, label: "Orçamentos", path: "/orcamentos", badgeKey: null },
  { icon: DollarSign, label: "Financeiro", path: "/financeiro", badgeKey: null, requiresFinanceiro: true },
];

export function TopNavigation() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { oficinas, oficinaAtual, setOficinaAtual } = useOficina();
  const { data: sidebarData } = useSidebarData();
  const { isTrialActive, trialDaysRemaining, shouldShowPlans } = usePlan();
  const { canViewFinanceiro } = useUserRole();

  // Filtrar itens do menu baseado em permissões
  const menuItems = menuItemsConfig.filter(item => 
    !item.requiresFinanceiro || canViewFinanceiro
  );

  const userName = user?.user_metadata?.nome || user?.email?.split("@")[0] || "Usuário";
  const userInitials = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  const getBadgeValue = (key: "servicosAtrasados" | "estoqueBaixo" | null): number | null => {
    if (!key) return null;
    const value = sidebarData[key];
    return value > 0 ? value : null;
  };

  const getWorkshopTypeLabel = () => {
    if (!oficinaAtual?.tipo) return "";
    switch (oficinaAtual.tipo) {
      case "moto": return "Motos";
      case "carro": return "Carros";
      default: return "Carros & Motos";
    }
  };

  return (
    <>
      {/* Header Principal - Navegação */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-40 h-14 bg-sidebar border-b border-sidebar-border"
      >
        <div className="h-full flex items-center justify-between px-4 lg:px-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center"
            >
              <Wrench className="w-4 h-4 text-accent-foreground" />
            </motion.div>
            <span className="font-bold text-sidebar-foreground text-sm hidden sm:block">Mechanic Raiz Pro</span>
          </Link>

          {/* Menu Principal - Centro */}
          <nav className="flex-1 flex items-center justify-center gap-0.5 overflow-x-auto scrollbar-none mx-2">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              const badgeValue = getBadgeValue(item.badgeKey);
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "relative flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className={cn(
                    "w-4 h-4 flex-shrink-0",
                    isActive && "text-accent"
                  )} />
                  <span className="text-xs lg:text-sm">{item.label}</span>
                  
                  {badgeValue && (
                    <Badge 
                      variant="destructive" 
                      className="text-[10px] px-1 py-0 h-4 min-w-4 bg-destructive"
                    >
                      {badgeValue}
                    </Badge>
                  )}

                  {/* Indicador ativo */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.span 
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        exit={{ scaleX: 0 }}
                        className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full" 
                      />
                    )}
                  </AnimatePresence>
                </Link>
              );
            })}

            {/* Planos - com indicador de trial (só mostra após 3 dias de uso) */}
            {shouldShowPlans && (
              <Link
                to="/upgrade"
                className={cn(
                  "relative flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap",
                  location.pathname === "/upgrade"
                    ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  isTrialActive && "bg-amber-500/10 border border-amber-500/30"
                )}
              >
                <Sparkles className={cn(
                  "w-4 h-4 flex-shrink-0",
                  isTrialActive ? "text-amber-500" : "text-accent"
                )} />
                <span className="text-xs lg:text-sm">Planos</span>
                {isTrialActive && (
                  <Badge className="text-[10px] px-1 py-0 h-4 bg-amber-500 text-white">
                    {trialDaysRemaining}d
                  </Badge>
                )}
              </Link>
            )}
          </nav>

          {/* Ações - Direita */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Notificações */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/notificacoes"
                  className={cn(
                    "relative flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
                    location.pathname === "/notificacoes"
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <Bell className="w-4 h-4" />
                  {sidebarData.notificacoesNaoLidas > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Notificações
              </TooltipContent>
            </Tooltip>

            {/* Configurações */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/configuracoes"
                  className={cn(
                    "flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
                    location.pathname === "/configuracoes"
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <Settings className="w-4 h-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Configurações
              </TooltipContent>
            </Tooltip>

            {/* Separador */}
            <div className="w-px h-5 bg-sidebar-border mx-0.5" />

            {/* Perfil do Usuário */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 px-1.5 gap-1 hover:bg-sidebar-accent/50"
                >
                  <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-[10px] font-semibold">
                    {userInitials}
                  </div>
                  <ChevronDown className="w-3 h-3 text-sidebar-foreground/60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-3 py-2 border-b border-border">
                  <p className="font-medium text-sm">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <DropdownMenuItem asChild className="py-2">
                  <Link to="/configuracoes" className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    <span className="text-sm">Configurações</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => signOut()}
                  className="text-destructive focus:text-destructive py-2"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  <span className="text-sm">Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.header>

      {/* Linha Secundária - Contexto da Oficina */}
      <div className="fixed top-14 left-0 right-0 z-30 h-8 bg-sidebar/80 backdrop-blur-sm border-b border-sidebar-border/50">
        <div className="h-full flex items-center justify-between px-4 lg:px-6">
          {/* Contexto da Oficina */}
          <div className="flex items-center gap-3">
            {/* Seletor de Oficina (discreto) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors">
                  <Building2 className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">
                    {oficinaAtual?.nome || "Selecionar Oficina"}
                  </span>
                  {oficinas.length > 1 && (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              </DropdownMenuTrigger>
              {oficinas.length > 1 && (
                <DropdownMenuContent align="start" className="w-56">
                  {oficinas.map((oficina) => (
                    <DropdownMenuItem
                      key={oficina.id}
                      onClick={() => setOficinaAtual(oficina)}
                      className="flex items-center justify-between py-2"
                    >
                      <div>
                        <p className="font-medium text-sm">{oficina.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {oficina.tipo === "moto" ? "Motos" : oficina.tipo === "carro" ? "Carros" : "Carros & Motos"}
                        </p>
                      </div>
                      {oficinaAtual?.id === oficina.id && (
                        <Check className="w-4 h-4 text-accent" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              )}
            </DropdownMenu>

            {/* Separador */}
            <div className="w-px h-3.5 bg-sidebar-border/50" />

            {/* Tipo de Operação */}
            <span className="text-xs text-sidebar-foreground/50">
              {getWorkshopTypeLabel()}
            </span>
          </div>

          {/* Data Atual */}
          <span className="text-xs text-sidebar-foreground/50 capitalize">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </span>
        </div>
      </div>
    </>
  );
}
