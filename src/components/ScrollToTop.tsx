import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackEvent, notifyMetaUrlChange } from "@/lib/tracking";

export function ScrollToTop() {
  const { pathname, search, hash } = useLocation();
  const isFirstRun = useRef(true);

  useEffect(() => {
    // [Fase F] page_view com dedup por URL via sessionStorage.
    // Garante 1 disparo por URL única. Recarregar mesma URL não re-dispara
    // (Pixel/CAPI já dispararam PageView no boot via fbq init + capi-client).
    try {
      const currentPath = pathname + search;
      const LAST_KEY = "mrp_last_pageview_path";
      const lastPath = sessionStorage.getItem(LAST_KEY);
      if (currentPath !== lastPath) {
        sessionStorage.setItem(LAST_KEY, currentPath);
        if (isFirstRun.current) {
          isFirstRun.current = false;
          // 1ª carga: Pixel/CAPI já fizeram PageView no boot → só dataLayer (GTM/GA4).
          trackEvent("page_view", {
            params: { is_initial_load: true, nav_type: "initial" },
            skipPixel: true,
            skipMocapi: true,
          });
        } else {
          // Navegação SPA: trackEvent completo com event_id único (Meta dedupa).
          trackEvent("page_view", {
            params: { is_initial_load: false, nav_type: "spa" },
          });
          // [Fase H2] Avisa Pixel da nova URL → Event Setup Tool reavalia regras "URL contains"
          notifyMetaUrlChange();
        }
      } else {
        isFirstRun.current = false;
      }
    } catch {}

    if (hash) return;

    const appScrollRoot = document.querySelector<HTMLElement>("[data-app-scroll-root]");
    if (appScrollRoot) {
      appScrollRoot.scrollTo({ top: 0, left: 0, behavior: "auto" });
      appScrollRoot.scrollTop = 0;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, search, hash]);

  return null;
}
