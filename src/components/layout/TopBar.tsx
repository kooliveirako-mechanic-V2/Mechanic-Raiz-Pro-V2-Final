import { Link, useLocation } from "react-router-dom";
import {
  Bell,
  ChevronDown,
  Check,
  Building2,
  LogOut,
  Settings,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useOficina } from "@/contexts/OficinaContext";
import { useSidebarData } from "@/hooks/useSidebarData";
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
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeSelector } from "@/components/ThemeSelector";

export function TopBar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { oficinas, oficinaAtual, setOficinaAtual } = useOficina();
  const { data: sidebarData } = useSidebarData();

  const userName = user?.user_metadata?.nome || user?.email?.split("@")[0] || "Usuário";
  const userInitials = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 lg:px-6"
    >
      {/* Lado Esquerdo - Trigger + Oficina (proeminente) */}
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-sidebar-foreground/60 hover:text-sidebar-foreground" />
        <div className="w-px h-5 bg-sidebar-border hidden md:block" />

        {/* Nome da Oficina - PROEMINENTE */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 text-sidebar-foreground hover:text-sidebar-foreground/90 transition-colors">
              <Building2 className="w-4 h-4 text-accent" />
              <span className="text-sm font-bold hidden sm:block max-w-[220px] truncate">
                {oficinaAtual?.nome || "Selecionar Oficina"}
              </span>
              {oficinas.length > 1 && (
                <ChevronDown className="w-3.5 h-3.5 text-sidebar-foreground/50" />
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
      </div>

      {/* Centro - Data */}
      <span className="hidden md:block text-sm text-sidebar-foreground/50 capitalize">
        {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
      </span>

      {/* Lado Direito - Tema + Notificações + Perfil simplificado */}
      <div className="flex items-center gap-2">
        <ThemeSelector />
        <div className="w-px h-5 bg-sidebar-border" />

        {/* Notificações */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/notificacoes"
              className={cn(
                "relative flex items-center justify-center h-9 w-9 rounded-lg transition-colors",
                location.pathname === "/notificacoes"
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Bell className="w-4 h-4" />
              {sidebarData.notificacoesNaoLidas > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
              )}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Notificações
          </TooltipContent>
        </Tooltip>

        <div className="w-px h-5 bg-sidebar-border" />

        {/* Perfil - Simplificado */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-9 px-2 gap-2 hover:bg-sidebar-accent/50"
            >
              <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-xs font-semibold">
                {userInitials}
              </div>
              <span className="hidden sm:block text-sm text-sidebar-foreground max-w-[100px] truncate">
                {userName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-sidebar-foreground/60" />
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
            <DropdownMenuItem asChild className="py-2">
              <Link to="/upgrade" className="flex items-center gap-2">
                <Crown className="w-4 h-4" />
                <span className="text-sm">Meu Plano</span>
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
    </motion.header>
  );
}