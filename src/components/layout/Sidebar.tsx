import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Car,
  Wrench,
  Calendar,
  Package,
  DollarSign,
  Settings,
  ChevronLeft,
  LogOut,
  Bell,
  Bike,
  ChevronDown,
  Check,
  FileText,
  Sparkles,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useOficina } from "@/contexts/OficinaContext";
import { useSidebarData } from "@/hooks/useSidebarData";
import { usePlan } from "@/hooks/usePlan";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MenuItem {
  icon: any;
  label: string;
  path: string;
  badgeKey: "servicosAtrasados" | "estoqueBaixo" | null;
}

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", badgeKey: null },
  { icon: Users, label: "Clientes", path: "/clientes", badgeKey: null },
  { icon: Car, label: "Veículos", path: "/veiculos", badgeKey: null },
  { icon: Wrench, label: "Serviços", path: "/servicos", badgeKey: "servicosAtrasados" },
  { icon: Calendar, label: "Agenda", path: "/agenda", badgeKey: null },
  { icon: Package, label: "Estoque", path: "/estoque", badgeKey: "estoqueBaixo" },
  { icon: FileText, label: "Orçamentos", path: "/orcamentos", badgeKey: null },
  { icon: DollarSign, label: "Financeiro", path: "/financeiro", badgeKey: null },
  { icon: Sparkles, label: "Planos", path: "/upgrade", badgeKey: null },
];

const bottomMenuItems = [
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { oficinas, oficinaAtual, setOficinaAtual } = useOficina();
  const { data: sidebarData } = useSidebarData();
  const { planDisplayName, isTrialActive, trialDaysRemaining, shouldShowPlans } = usePlan();
  const { theme, setTheme } = useTheme();

  const userName = user?.user_metadata?.nome || user?.email?.split("@")[0] || "Usuário";
  const userInitials = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  const getBadgeValue = (key: "servicosAtrasados" | "estoqueBaixo" | null): number | null => {
    if (!key) return null;
    const value = sidebarData[key];
    return value > 0 ? value : null;
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 256 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="fixed left-0 top-0 z-40 h-screen bg-sidebar flex flex-col overflow-hidden"
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-sidebar via-sidebar to-sidebar/95 pointer-events-none" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header */}
      <div className="relative flex items-center justify-between p-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3">
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center shadow-lg shadow-accent/30"
          >
            <Wrench className="w-5 h-5 text-accent-foreground" />
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="font-bold text-lg text-sidebar-foreground">Mechanic Raiz Pro</h1>
                <p className="text-xs text-sidebar-muted">Gestão de Oficina</p>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-xl"
          >
            <motion.div
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <ChevronLeft className="w-4 h-4" />
            </motion.div>
          </Button>
        </motion.div>
      </div>

      {/* Workshop Selector */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="relative p-4"
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent/50 border border-sidebar-border/50 cursor-pointer text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center">
                    <Bike className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">
                      {oficinaAtual?.nome || "Selecionar Oficina"}
                    </p>
                    <p className="text-xs text-sidebar-muted">
                      {oficinaAtual?.tipo === "moto" ? "Motos" : oficinaAtual?.tipo === "carro" ? "Carros" : "Moto & Carro"}
                    </p>
                  </div>
                  {oficinas.length > 1 && (
                    <ChevronDown className="w-4 h-4 text-sidebar-muted" />
                  )}
                </motion.button>
              </DropdownMenuTrigger>
              {oficinas.length > 1 && (
                <DropdownMenuContent align="start" className="w-56">
                  {oficinas.map((oficina) => (
                    <DropdownMenuItem
                      key={oficina.id}
                      onClick={() => setOficinaAtual(oficina)}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">{oficina.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {oficina.tipo === "moto" ? "Motos" : oficina.tipo === "carro" ? "Carros" : "Ambos"}
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Navigation */}
      <nav className="relative flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
        {menuItems
          .filter(item => item.path !== "/upgrade" || shouldShowPlans)
          .map((item, index) => {
          const isActive = location.pathname === item.path;
          const badgeValue = getBadgeValue(item.badgeKey);
          const isPlansItem = item.path === "/upgrade";
          
          return (
            <motion.div
              key={item.path}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={item.path}
                className={cn(
                  "relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  isPlansItem && isTrialActive && "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20"
                )}
              >
                {/* Active indicator */}
                <AnimatePresence>
                  {isActive && (
                    <motion.span 
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute left-0 w-1 h-8 bg-gradient-to-b from-accent to-accent/60 rounded-r-full" 
                    />
                  )}
                </AnimatePresence>
                
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className={cn(
                    "flex-shrink-0 transition-colors",
                    isActive ? "text-accent" : "group-hover:text-accent",
                    isPlansItem && isTrialActive && "text-amber-500"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                </motion.div>
                
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex-1"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                
                {/* Trial days badge for Plans item */}
                <AnimatePresence>
                  {!collapsed && isPlansItem && isTrialActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Badge 
                        className="text-xs px-2 py-0.5 bg-amber-500 text-white shadow-lg shadow-amber-500/30"
                      >
                        {trialDaysRemaining}d
                      </Badge>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <AnimatePresence>
                  {!collapsed && badgeValue && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Badge 
                        variant="destructive" 
                        className="text-xs px-2 py-0.5 bg-destructive/90 shadow-lg shadow-destructive/30"
                      >
                        {badgeValue}
                      </Badge>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Bottom Navigation */}
      <div className="relative p-4 border-t border-sidebar-border space-y-1">
        {/* Theme Toggle */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200"
        >
          <motion.div 
            whileHover={{ scale: 1.1 }}
            animate={{ rotate: theme === "dark" ? 0 : 180 }}
            transition={{ duration: 0.3 }}
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5 flex-shrink-0" />
            ) : (
              <Moon className="w-5 h-5 flex-shrink-0" />
            )}
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 text-left"
              >
                {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Notifications */}
        <Link
          to="/notificacoes"
          className="relative flex items-center gap-3 px-4 py-3 rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200"
        >
          <motion.div whileHover={{ scale: 1.1, rotate: [0, -10, 10, 0] }}>
            <Bell className="w-5 h-5 flex-shrink-0" />
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1"
              >
                Notificações
              </motion.span>
            )}
          </AnimatePresence>
          {sidebarData.notificacoesNaoLidas > 0 && (
            <motion.span 
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-2 h-2 bg-destructive rounded-full shadow-lg shadow-destructive/50" 
            />
          )}
        </Link>

        {bottomMenuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200",
              location.pathname === item.path && "bg-sidebar-accent text-sidebar-foreground"
            )}
          >
            <motion.div whileHover={{ scale: 1.1, rotate: 90 }} transition={{ duration: 0.3 }}>
              <item.icon className="w-5 h-5 flex-shrink-0" />
            </motion.div>
            <AnimatePresence>
              {!collapsed && (
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        ))}

        {/* User Profile */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-3 px-4 py-3 mt-2 rounded-xl bg-gradient-to-r from-sidebar-accent/50 to-sidebar-accent/30 border border-sidebar-border/50"
        >
          <motion.div 
            whileHover={{ scale: 1.1 }}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center text-accent-foreground font-semibold shadow-lg shadow-accent/30"
          >
            {userInitials}
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {userName}
                </p>
                <p className="text-xs text-sidebar-muted">Proprietário</p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => signOut()}
                  className="text-sidebar-foreground/70 hover:text-destructive hover:bg-transparent"
                >
                  <motion.div whileHover={{ x: 3 }}>
                    <LogOut className="w-4 h-4" />
                  </motion.div>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.aside>
  );
}
