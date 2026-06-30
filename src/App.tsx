import { lazy, Suspense } from "react";
import { Sentry } from "@/lib/sentry";
import { SentryErrorFallback } from "@/components/SentryErrorFallback";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { OficinaProvider } from "@/contexts/OficinaContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Loader2, RefreshCw } from "lucide-react";
import { ScrollToTop } from "@/components/ScrollToTop";

function lazyWithRetry(importFn: () => Promise<any>) {
  return lazy(() =>
    importFn().catch((err) => {
      console.warn("[LazyLoad] Chunk failed, retrying...", err);
      return new Promise((resolve) => setTimeout(resolve, 1500)).then(() =>
        importFn().catch((retryErr) => {
          console.error("[LazyLoad] Retry failed:", retryErr);
          return {
            default: () => (
              <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <div className="flex flex-col items-center gap-4 text-center max-w-sm">
                  <RefreshCw className="w-10 h-10 text-muted-foreground" />
                  <h2 className="text-lg font-semibold text-foreground">Erro ao carregar página</h2>
                  <p className="text-sm text-muted-foreground">
                    Verifique sua conexão com a internet e tente novamente.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                  >
                    Recarregar
                  </button>
                </div>
              </div>
            ),
          };
        })
      );
    })
  );
}

import Auth from "./pages/Auth";

const Index = lazyWithRetry(() => import("./pages/Index"));
const Onboarding = lazyWithRetry(() => import("./pages/Onboarding"));
const Clientes = lazyWithRetry(() => import("./pages/Clientes"));
const Veiculos = lazyWithRetry(() => import("./pages/Veiculos"));
const Servicos = lazyWithRetry(() => import("./pages/Servicos"));
const Agenda = lazyWithRetry(() => import("./pages/Agenda"));
const Estoque = lazyWithRetry(() => import("./pages/Estoque"));
const Orcamentos = lazyWithRetry(() => import("./pages/Orcamentos"));
const Financeiro = lazyWithRetry(() => import("./pages/Financeiro"));
const Configuracoes = lazyWithRetry(() => import("./pages/Configuracoes"));
const Notificacoes = lazyWithRetry(() => import("./pages/Notificacoes"));
const OSPublica = lazyWithRetry(() => import("./pages/OSPublica"));
const OrcamentoPublico = lazyWithRetry(() => import("./pages/OrcamentoPublico"));
const PortalCliente = lazyWithRetry(() => import("./pages/PortalCliente"));
const Instalar = lazyWithRetry(() => import("./pages/Instalar"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const PagamentoSucesso = lazyWithRetry(() => import("./pages/PagamentoSucesso"));
const PagamentoFalha = lazyWithRetry(() => import("./pages/PagamentoFalha"));
const PagamentoPendente = lazyWithRetry(() => import("./pages/PagamentoPendente"));
const Upgrade = lazyWithRetry(() => import("./pages/Upgrade"));
const Relatorios = lazyWithRetry(() => import("./pages/Relatorios"));
const TermosUso = lazyWithRetry(() => import("./pages/TermosUso"));
const PoliticaPrivacidade = lazyWithRetry(() => import("./pages/PoliticaPrivacidade"));
const CentralAjuda = lazyWithRetry(() => import("./pages/CentralAjuda"));
const LimparCache = lazyWithRetry(() => import("./pages/LimparCache"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const CadastroConcluido = lazyWithRetry(() => import("./pages/CadastroConcluido"));
const Convite = lazyWithRetry(() => import("./pages/Convite"));
const Solicitacoes = lazyWithRetry(() => import("./pages/Solicitacoes"));
const AgendamentoPublico = lazyWithRetry(() => import("./pages/AgendamentoPublico"));
const Sentinela = lazyWithRetry(() => import("./pages/Sentinela"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const msg = (error as Error)?.message?.toLowerCase() ?? "";
        if (msg.includes("jwt") || msg.includes("permission") || msg.includes("row-level security")) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      gcTime: 10 * 60 * 1000,
    },
    mutations: {
      retry: false,
    },
  },
});

function PageFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    </div>
  );
}

function AppContent() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <OficinaProvider>
            <TooltipProvider>
              <Sonner />
              <BrowserRouter>
                <ScrollToTop />
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/login" element={<Navigate to="/auth" replace />} />
                    <Route path="/cadastro-concluido" element={<CadastroConcluido />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/onboarding" element={<Onboarding />} />
                    <Route path="/os/:id" element={<OSPublica />} />
                    <Route path="/orcamento/o/:oficinaId/:numero" element={<OrcamentoPublico />} />
                    <Route path="/orcamento/:id" element={<OrcamentoPublico />} />
                    <Route path="/portal/:token" element={<PortalCliente />} />
                    <Route path="/agendar/:slug" element={<AgendamentoPublico />} />
                    <Route path="/convite/:token" element={<Convite />} />
                    <Route path="/instalar" element={<Instalar />} />
                    <Route path="/termos" element={<TermosUso />} />
                    <Route path="/termos-uso" element={<Navigate to="/termos" replace />} />
                    <Route path="/privacidade" element={<PoliticaPrivacidade />} />
                    <Route path="/politica-privacidade" element={<Navigate to="/privacidade" replace />} />
                    <Route path="/ajuda" element={<CentralAjuda />} />
                    <Route path="/limpar" element={<LimparCache />} />
                    <Route path="/pagamento/sucesso" element={<PagamentoSucesso />} />
                    <Route path="/pagamento/falha" element={<PagamentoFalha />} />
                    <Route path="/pagamento/pendente" element={<PagamentoPendente />} />
                    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                    <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
                    <Route path="/veiculos" element={<ProtectedRoute><Veiculos /></ProtectedRoute>} />
                    <Route path="/servicos" element={<ProtectedRoute><Servicos /></ProtectedRoute>} />
                    <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
                    <Route path="/solicitacoes" element={<ProtectedRoute><Solicitacoes /></ProtectedRoute>} />
                    <Route path="/estoque" element={<ProtectedRoute><Estoque /></ProtectedRoute>} />
                    <Route path="/orcamentos" element={<ProtectedRoute><Orcamentos /></ProtectedRoute>} />
                    <Route path="/financeiro" element={<ProtectedRoute><Financeiro /></ProtectedRoute>} />
                    <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
                    <Route path="/notificacoes" element={<ProtectedRoute><Notificacoes /></ProtectedRoute>} />
                    <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
                    <Route path="/upgrade" element={<ProtectedRoute><Upgrade /></ProtectedRoute>} />
                    <Route path="/sentinela" element={<ProtectedRoute><Sentinela /></ProtectedRoute>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </OficinaProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

const App = Sentry.withErrorBoundary(AppContent, {
  fallback: ({ error, resetError }) => (
    <SentryErrorFallback error={error as Error} resetError={resetError} />
  ),
});

export default App;
