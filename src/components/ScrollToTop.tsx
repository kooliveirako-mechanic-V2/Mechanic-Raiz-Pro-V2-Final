import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackEvent } from "@/lib/tracking";

/**
 * Componente responsável por resetar o scroll em navegações
 * e gerenciar o disparo ÚNICO de PageView para o GTM/dataLayer.
 */
export function ScrollToTop() {
  const { pathname, search, hash } = useLocation();
  const lastPathRef = useRef<string | null>(null);
  const isFirstRun = useRef(true);

  useEffect(() => {
    const currentPath = pathname;
    const currentSearch = search;
    const isInitial = isFirstRun.current;

    // BLOQUEIO REFORÇADO: Se o pathname não mudou, ignoramos o disparo de page_view.
    // Isso evita que a seleção de plano (?plano=moto) dispare um segundo PageView
    // já que o usuário ainda está na mesma página (/auth).
    if (!isInitial && lastPathRef.current === currentPath) {
      // Logamos no console para depuração no preview
      console.info(
        `[ScrollToTop] 🛡️ PageView BLOQUEADO (apenas parâmetros mudaram na rota ${currentPath}):`,
        currentSearch
      );
      return;
    }

    // Se chegou aqui, ou é carga inicial ou mudou de página de fato (ex: / -> /auth)
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    
    // Disparo oficial para o dataLayer -> GTM
    console.info(
      `[ScrollToTop] 🚀 Disparando page_view oficial (${isInitial ? "CARGA INICIAL" : "MUDANÇA DE ROTA"}):`,
      currentPath
    );
    
    trackEvent("page_view", {
      params: {
        page_path: currentPath,
        page_search: currentSearch,
        is_initial_load: isInitial,
        nav_type: isInitial ? "initial" : "spa",
      },
      // Garantimos que não haja disparo direto redundante
      skipPixel: true,
      skipMocapi: true,
    });

    // Atualiza estado para a próxima mudança de URL
    lastPathRef.current = currentPath;
    isFirstRun.current = false;

    // Tratamento de scroll para elementos com scroll interno se necessário
    const appScrollRoot = document.querySelector<HTMLElement>("[data-app-scroll-root]");
    if (appScrollRoot) {
      appScrollRoot.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [pathname]); // Observamos apenas pathname para evitar disparos em query params

  return null;
}

