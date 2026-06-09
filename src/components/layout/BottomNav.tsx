import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Package,
  DollarSign,
  Plus,
  Wrench,
  Zap,
  FileText,
  MoreHorizontal,
  Calendar,
  Car,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OSRapidaModal } from "@/components/servicos/OSRapidaModal";
import { VendaRapidaModal } from "@/components/vendas/VendaRapidaModal";
import { useUserRole } from "@/hooks/useUserRole";
import { useMobileAlertBadges } from "@/hooks/useMobileAlertBadges";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useModalUrl } from "@/hooks/useModalUrl";
import { motion, AnimatePresence } from "framer-motion";

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [osModalOpen, setOsModalOpen] = useModalUrl("os-rapida");
  const [vendaRapidaOpen, setVendaRapidaOpen] = useModalUrl("venda-rapida");
  const [showOSOptions, setShowOSOptions] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const { canViewFinanceiro } = useUserRole();
  const { inicioCount, financeiroCount, estoqueCount } = useMobileAlertBadges();
  const haptic = useHapticFeedback();

  // P1 FIX #6: More menu items for Agenda, Veículos, etc.
  const moreMenuItems = [
    { icon: Calendar, label: "Agenda", path: "/agenda" },
    { icon: Car, label: "Veículos", path: "/veiculos" },
    { icon: Wrench, label: "Serviços", path: "/servicos" },
    ...(canViewFinanceiro ? [] : [{ icon: DollarSign, label: "Financeiro", path: "/financeiro" }]),
  ];

  const navItems = [
    { icon: LayoutDashboard, label: "Início", path: "/", badge: inicioCount },
    canViewFinanceiro 
      ? { icon: DollarSign, label: "Financeiro", path: "/financeiro", badge: financeiroCount }
      : { icon: Wrench, label: "Serviços", path: "/servicos", badge: 0 },
    { icon: null, label: "Nova OS", path: null, isCenter: true, badge: 0 },
    { icon: Package, label: "Estoque", path: "/estoque", badge: estoqueCount },
    { icon: MoreHorizontal, label: "Mais", path: null, isMore: true, badge: 0 },
  ];

  const handleCenterClick = () => {
    haptic.medium();
    setShowOSOptions(true);
  };

  const handleOSRapida = () => {
    setShowOSOptions(false);
    setOsModalOpen(true);
  };

  const handleOSCompleta = () => {
    setShowOSOptions(false);
    navigate("/servicos?nova=completa");
  };

  return (
    <>
      {/* Overlay + OS options */}
      <AnimatePresence>
        {showOSOptions && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[55] lg:hidden"
              onClick={() => setShowOSOptions(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[56] flex flex-col gap-3 lg:hidden"
            >
              <button
                onClick={handleOSRapida}
                className="flex items-center gap-3 bg-card border border-border rounded-2xl px-5 py-3.5 shadow-xl active:scale-95 transition-transform min-w-[200px]"
              >
                <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-accent" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">OS Rápida</p>
                  <p className="text-[11px] text-muted-foreground">Em segundos</p>
                </div>
              </button>

              <button
                onClick={handleOSCompleta}
                className="flex items-center gap-3 bg-card border border-border rounded-2xl px-5 py-3.5 shadow-xl active:scale-95 transition-transform min-w-[200px]"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">OS Completa</p>
                  <p className="text-[11px] text-muted-foreground">Todos os campos</p>
                </div>
              </button>

              <button
                onClick={() => { setShowOSOptions(false); setVendaRapidaOpen(true); }}
                className="flex items-center gap-3 bg-card border border-border rounded-2xl px-5 py-3.5 shadow-xl active:scale-95 transition-transform min-w-[200px]"
              >
                <div className="w-10 h-10 rounded-xl bg-warning/15 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-warning" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">Venda Rápida</p>
                  <p className="text-[11px] text-muted-foreground">Balcão · sem OS</p>
                </div>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* P1 FIX #6: "Mais" menu overlay */}
      <AnimatePresence>
        {showMoreMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[55] lg:hidden"
              onClick={() => setShowMoreMenu(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-28 right-4 z-[56] flex flex-col gap-2 lg:hidden"
            >
              {moreMenuItems.map((item) => (
                <button
                  key={item.path}
                  data-tour={item.label === "Serviços" ? "menu-clientes" : undefined}
                  onClick={() => {
                    setShowMoreMenu(false);
                    navigate(item.path);
                  }}
                  className="flex items-center gap-3 bg-card border border-border rounded-2xl px-5 py-3.5 shadow-xl active:scale-95 transition-transform min-w-[180px]"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">{item.label}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
        <div className="absolute inset-0 bg-sidebar border-t border-sidebar-border/50" />
        
        <div className="relative flex items-center justify-around px-1 pt-2 safe-bottom" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0.5rem))' }}>
          {navItems.map((item) => {
            const isActive = item.path && location.pathname === item.path;
            
            if (item.isCenter) {
              return (
                <button
                  key="nova-os"
                  onClick={showOSOptions ? () => setShowOSOptions(false) : handleCenterClick}
                  className="relative -mt-10 flex flex-col items-center justify-center group active:scale-95 transition-transform"
                >
                  <div className="absolute inset-0 -m-2 rounded-full bg-accent/20" />
                  <div 
                    className="relative rounded-full flex items-center justify-center border-4 border-sidebar overflow-hidden shadow-[0_10px_30px_-5px_hsl(var(--accent)/0.5)]"
                    style={{ width: '72px', height: '72px' }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-accent via-accent to-accent/80" />
                    <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent opacity-60" />
                    <motion.div
                      animate={{ rotate: showOSOptions ? 45 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Plus className="relative w-8 h-8 text-accent-foreground drop-shadow-lg" strokeWidth={2.5} />
                    </motion.div>
                  </div>
                  <span className="text-[10px] font-bold text-sidebar-foreground mt-2 tracking-wide uppercase">
                    {item.label}
                  </span>
                </button>
              );
            }

            // P1 FIX #6: "Mais" button
            if ((item as any).isMore) {
              const isMoreActive = moreMenuItems.some(m => location.pathname === m.path);
              return (
                <button
                  key="mais"
                  onClick={() => {
                    haptic.light();
                    setShowMoreMenu(!showMoreMenu);
                    setShowOSOptions(false);
                  }}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center py-2.5 relative active:scale-95 transition-transform",
                    isMoreActive || showMoreMenu ? "text-accent" : "text-sidebar-foreground/50"
                  )}
                >
                  <div className="relative">
                    {isMoreActive && (
                      <div className="absolute inset-0 -m-2 rounded-full bg-accent/25 blur-md" />
                    )}
                    <MoreHorizontal className={cn(
                      "w-5 h-5 relative transition-colors duration-200",
                      (isMoreActive || showMoreMenu) && "drop-shadow-[0_0_10px_hsl(var(--accent)/0.6)]"
                    )} strokeWidth={(isMoreActive || showMoreMenu) ? 2.5 : 2} />
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium transition-colors duration-200 mt-1.5",
                    (isMoreActive || showMoreMenu) ? "text-accent font-semibold" : "text-sidebar-foreground/50"
                  )}>
                    {item.label}
                  </span>
                  {isMoreActive && (
                    <div className="absolute -bottom-0.5 w-1.5 h-1.5 bg-accent rounded-full shadow-[0_0_8px_hsl(var(--accent)/0.8)]" />
                  )}
                </button>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path!}
                data-tour={item.label === "Estoque" ? "menu-estoque" : item.label === "Financeiro" ? "menu-financeiro" : undefined}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-2.5 relative active:scale-95 transition-transform",
                  isActive ? "text-accent" : "text-sidebar-foreground/50"
                )}
              >
                {item.icon && (
                  <div className="relative">
                    {isActive && (
                      <div className="absolute inset-0 -m-2 rounded-full bg-accent/25 blur-md" />
                    )}
                    <item.icon className={cn(
                      "w-5 h-5 relative transition-colors duration-200",
                      isActive && "drop-shadow-[0_0_10px_hsl(var(--accent)/0.6)]"
                    )} strokeWidth={isActive ? 2.5 : 2} />
                    {(item.badge ?? 0) > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold leading-none shadow-sm">
                        {item.badge! > 9 ? "9+" : item.badge}
                      </span>
                    )}
                  </div>
                )}
                <span className={cn(
                  "text-[10px] font-medium transition-colors duration-200 mt-1.5",
                  isActive ? "text-accent font-semibold" : "text-sidebar-foreground/50"
                )}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute -bottom-0.5 w-1.5 h-1.5 bg-accent rounded-full shadow-[0_0_8px_hsl(var(--accent)/0.8)]" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <OSRapidaModal open={osModalOpen} onOpenChange={setOsModalOpen} />
      <VendaRapidaModal open={vendaRapidaOpen} onOpenChange={setVendaRapidaOpen} />
    </>
  );
}
