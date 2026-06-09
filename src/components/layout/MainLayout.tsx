import { ReactNode } from "react";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { MobileNav } from "./MobileNav";
import { BottomNav } from "./BottomNav";
import { PageTransition } from "./PageTransition";
import { TrialBanner } from "@/components/TrialBanner";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useRoutePersistence } from "@/hooks/useRouteRestore";
import { ConnectionStatus } from "@/components/ui/connection-status";
import { PWAUpdateBanner } from "@/components/PWAUpdateBanner";
import { VersionFooter } from "@/components/VersionFooter";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  // Salvar rota atual para restauração após background
  useRoutePersistence();
  return (
    <SidebarProvider defaultOpen={true}>
      {/* PWA Update Banner — always on top */}
      <PWAUpdateBanner />
      <div className="flex h-[100dvh] min-h-[100dvh] w-full max-w-full overflow-hidden bg-background">
        {/* Background — lightweight, no motion/blur on mobile */}
        <div className="fixed inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-background" />
          
          {/* Light mode subtle gradient */}
          <div className="dark:hidden absolute inset-0 bg-gradient-to-br from-[hsl(218,25%,97%)] via-[hsl(220,20%,98%)] to-[hsl(218,22%,96%)]" />
          
          {/* Dark mode subtle gradient — no blur, no motion */}
          <div className="hidden dark:block absolute inset-0 bg-gradient-to-br from-background via-background to-[hsl(205,30%,8%)]" />
        </div>

        {/* Desktop Sidebar - escondido no mobile */}
        <div className="hidden lg:block">
          <AppSidebar />
        </div>

        {/* Mobile Navigation - Top Header */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50">
          <MobileNav />
        </div>

        {/* Mobile Navigation - Bottom Nav */}
        <BottomNav />

        {/* Main Content Area */}
        <SidebarInset className="flex min-h-0 flex-1 flex-col min-w-0 max-w-full overflow-hidden">
          {/* Desktop Top Bar */}
          <div className="hidden lg:block sticky top-0 z-40">
            <TopBar />
          </div>

          {/* Main Content
              NOTA: o padding-top/bottom para mobile (compensação de TopBar fixa + BottomNav + safe-area)
              é aplicado UMA ÚNICA VEZ em src/index.css via [data-app-scroll-root] @media (max-width:1023px).
              NÃO duplicar aqui — duplicação causa vazio vertical enorme em mobile/PWA. */}
          <div data-app-scroll-root className="flex-1 min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden">
            <div className="px-3 md:p-6 lg:p-8 w-full max-w-full overflow-x-hidden">
              {/* Trial Banner — no wrapper div to avoid dead space when hidden */}
              <TrialBanner />
              
              <PageErrorBoundary>
                <PageTransition>
                  {children}
                </PageTransition>
              </PageErrorBoundary>
              
              {/* Version footer — visible to verify build */}
              <VersionFooter />
            </div>
          </div>
        </SidebarInset>
        
        {/* BLINDAGEM: Indicador de status de conexão */}
        <ConnectionStatus position="bottom-right" showOnlyOffline={true} />
      </div>
    </SidebarProvider>
  );
}
