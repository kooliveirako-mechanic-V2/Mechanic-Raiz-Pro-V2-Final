import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

/**
 * BLINDAGEM: Persistência e restauração de rota ativa.
 *
 * Causa raiz do problema: no PWA mobile, ao sair para o WhatsApp e voltar
 * 2+ minutos depois, o sistema operacional mata a aba e o PWA reabre em "/".
 * sessionStorage é zerado nesse cenário — por isso usamos localStorage.
 *
 * Fluxo:
 *  1. useRoutePersistence salva a URL completa (path + search + hash) sempre
 *     que ela muda em uma rota interna válida.
 *  2. useRouteRestore (montado na Index) detecta cold-start em "/" e
 *     navega de volta para a última rota, abrindo automaticamente o modal
 *     associado (ex: ?new=1, ?os=nova).
 *  3. Expira em 24h pra não restaurar contexto antigo demais.
 */

const LAST_ROUTE_KEY = "mechanic_last_route_v2";
const RESTORE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// Rotas que não devem ser salvas/restauradas
const EXCLUDED_ROUTES = [
  "/auth",
  "/onboarding",
  "/os/",
  "/orcamento/",
  "/portal/",
  "/instalar",
  "/reset-password",
  "/cadastro-concluido",
  "/convite/",
  "/pagamento/",
  "/limpar",
];

const VALID_ROUTES = [
  "/",
  "/clientes",
  "/veiculos",
  "/servicos",
  "/agenda",
  "/estoque",
  "/orcamentos",
  "/financeiro",
  "/configuracoes",
  "/notificacoes",
  "/upgrade",
  "/relatorios",
];

interface StoredRoute {
  route: string;
  timestamp: number;
}

function readStoredRoute(): StoredRoute | null {
  try {
    const raw = localStorage.getItem(LAST_ROUTE_KEY);
    if (!raw) return null;
    // Backward compat: valor antigo era string crua
    if (raw.startsWith("/")) {
      return { route: raw, timestamp: Date.now() };
    }
    const parsed = JSON.parse(raw) as StoredRoute;
    if (!parsed?.route || !parsed?.timestamp) return null;
    if (Date.now() - parsed.timestamp > RESTORE_TTL_MS) {
      localStorage.removeItem(LAST_ROUTE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredRoute(route: string) {
  try {
    const payload: StoredRoute = { route, timestamp: Date.now() };
    localStorage.setItem(LAST_ROUTE_KEY, JSON.stringify(payload));
  } catch {
    /* localStorage cheio ou indisponível — ignora */
  }
}

export function useRoutePersistence() {
  const location = useLocation();

  useEffect(() => {
    const shouldExclude = EXCLUDED_ROUTES.some(
      (route) => location.pathname === route || location.pathname.startsWith(route)
    );
    if (shouldExclude) return;

    const fullRoute = `${location.pathname}${location.search}${location.hash}`;
    writeStoredRoute(fullRoute);
  }, [location.pathname, location.search, location.hash]);
}

export function useRouteRestore() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Só restaurar na carga inicial da home limpa; se já houver query/hash, respeitar a URL atual
    if (
      location.pathname !== "/" ||
      location.key !== "default" ||
      location.search ||
      location.hash
    ) {
      return;
    }

    const stored = readStoredRoute();
    if (!stored) return;

    try {
      const url = new URL(stored.route, window.location.origin);
      // Não restaurar se for a própria home limpa
      if (
        !VALID_ROUTES.includes(url.pathname) ||
        (url.pathname === "/" && !url.search && !url.hash)
      ) {
        return;
      }

      navigate(`${url.pathname}${url.search}${url.hash}`, { replace: true });

      // Feedback amigável quando o usuário estava em fluxo crítico
      const search = url.search;
      const isCriticalFlow =
        search.includes("new=1") ||
        search.includes("os=nova") ||
        search.includes("modal=os-rapida") ||
        search.includes("edit=");
      if (isCriticalFlow) {
        setTimeout(() => {
          toast.info("Retomando de onde você parou", {
            description: "Seu rascunho foi preservado.",
          });
        }, 300);
      }
    } catch {
      localStorage.removeItem(LAST_ROUTE_KEY);
    }
  }, [location.hash, location.key, location.pathname, location.search, navigate]);
}

export function clearSavedRoute() {
  try {
    localStorage.removeItem(LAST_ROUTE_KEY);
    // Limpar legado também
    sessionStorage.removeItem("mechanic_last_route");
  } catch {
    /* ignore */
  }
}
