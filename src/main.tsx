// ═══════════════════════════════════════════════════════════════
// BOOTSTRAP SEGURO: Nenhum módulo do app é importado antes de
// validar as variáveis de ambiente. Isso evita que o client.ts
// do Supabase execute createClient() com valores undefined,
// causando tela branca irrecuperável.
//
// Ordem de execução:
// 1. Ler env vars (inline, sem imports)
// 2. Se ausentes → renderizar erro HTML puro, parar aqui
// 3. Se presentes → dynamic import do app real
// ═══════════════════════════════════════════════════════════════

declare const __BUILD_ID__: string;
declare const __BUILD_TIMESTAMP__: string;

const _buildId = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";
const _buildTime = typeof __BUILD_TIMESTAMP__ !== "undefined" ? __BUILD_TIMESTAMP__ : "dev";

// Log build version immediately (before any module evaluation)
console.info(`[MRP] Build: ${_buildId} | ${_buildTime}`);

// ── Step 1: Read env vars ────────────────────────────────────
const _supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const _supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// ── Step 2: If missing, render error and STOP ────────────────
if (!_supabaseUrl || !_supabaseKey) {
  console.error("[MRP] FATAL: Supabase environment variables missing.", {
    VITE_SUPABASE_URL: _supabaseUrl ? "present" : "MISSING",
    VITE_SUPABASE_PUBLISHABLE_KEY: _supabaseKey ? "present" : "MISSING",
    build: _buildId,
    timestamp: _buildTime,
  });

  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <div style="min-height:100vh;background:#0E1B2A;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
        <div style="background:#162A3E;border-radius:16px;padding:40px 32px;max-width:420px;width:100%;text-align:center;border:1px solid rgba(255,255,255,.1)">
          <div style="font-size:64px;margin-bottom:16px">⚠️</div>
          <h1 style="font-size:1.5rem;margin-bottom:8px">ERRO DE CONFIGURAÇÃO TESTE 01</h1>
          <p style="color:#94a3b8;font-size:.95rem;margin-bottom:16px">
            O sistema não conseguiu conectar ao servidor. Isso geralmente é temporário.
          </p>
          <p style="color:#94a3b8;font-size:.85rem;margin-bottom:24px">
            Tente recarregar a página. Se o problema persistir, entre em contato com o suporte.
          </p>
          <button onclick="window.location.reload()" style="display:block;width:100%;padding:14px;background:#0077B6;color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:600;cursor:pointer">
            Recarregar
          </button>
          <a href="/limpar.html" style="display:block;margin-top:12px;color:#00A8E8;font-size:.85rem;text-decoration:none">
            Limpar cache e tentar novamente
          </a>
          <p style="color:#475569;font-size:.7rem;margin-top:16px;font-family:monospace">
            ENV_MISSING: URL=${_supabaseUrl ? 'OK' : 'EMPTY'} KEY=${_supabaseKey ? 'OK' : 'EMPTY'}<br/>
            BUILD: ${_buildId} | ${_buildTime}
          </p>
        </div>
      </div>
    `;
  }
  // STOP — do NOT import anything else
} else {
  // ── Step 3: Env OK → boot the app via dynamic import ────────
  bootApp();
}

async function bootApp() {
  // Cache busting logic (runs before app render)
  if (typeof window !== "undefined") {
    const isInIframe = (() => {
      try { return window.self !== window.top; } catch { return true; }
    })();

    const hostname = window.location.hostname;
    const isPreviewHost =
      hostname.includes("id-preview--") ||
      hostname.includes("lovableproject.com");

    if (isInIframe || isPreviewHost) {
      navigator.serviceWorker?.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((k) => void caches.delete(k)));
      }
    } else if (_buildId !== "dev") {
      const BUST_KEY = "mechanic_cache_busted_build";
      const lastBusted = localStorage.getItem(BUST_KEY);

      if (lastBusted !== _buildId) {
        localStorage.setItem(BUST_KEY, _buildId);

        try {
          console.log("[CacheBust] Build mudou:", lastBusted, "→", _buildId);

          if ("serviceWorker" in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
            console.log(`[CacheBust] ${regs.length} SW(s) removido(s)`);
          }

          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
            console.log(`[CacheBust] ${keys.length} cache(s) limpo(s)`);
          }

          try { localStorage.removeItem("mechanic_last_build"); } catch {}

          window.location.replace(window.location.pathname + "?_bust=" + Date.now());
          return; // Stop — page will reload
        } catch (err) {
          console.error("[CacheBust] Falha:", err);
        }
      } else {
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            console.log("[SW] Controller changed — nova versão ativada");
          });
          navigator.serviceWorker.ready.then((registration) => {
            if (registration.waiting) {
              registration.waiting.postMessage({ type: "SKIP_WAITING" });
            }
            registration.addEventListener("updatefound", () => {
              const newWorker = registration.installing;
              newWorker?.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  newWorker.postMessage({ type: "SKIP_WAITING" });
                }
              });
            });
          });
        }
      }
    }
  }

  // ── Dynamic imports: only NOW do we load app modules ────────
  try {
    const [{ initSentry }, { initAuthGuard }, { createRoot }, { default: App }] = await Promise.all([
      import("./lib/sentry"),
      import("./lib/authGuard"),
      import("react-dom/client"),
      import("./App"),
    ]);

    // Also load CSS
    await import("./index.css");

    initSentry();
    initAuthGuard();

    createRoot(document.getElementById("root")!).render(<App />);
  } catch (err) {
    console.error("[MRP] FATAL: Failed to boot application.", err);
    const root = document.getElementById("root");
    if (root) {
      root.innerHTML = `
        <div style="min-height:100vh;background:#0E1B2A;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
          <div style="background:#162A3E;border-radius:16px;padding:40px 32px;max-width:420px;width:100%;text-align:center;border:1px solid rgba(255,255,255,.1)">
            <div style="font-size:64px;margin-bottom:16px">💥</div>
            <h1 style="font-size:1.5rem;margin-bottom:8px">Erro ao Carregar</h1>
            <p style="color:#94a3b8;font-size:.95rem;margin-bottom:16px">
              O sistema encontrou um problema ao inicializar.
            </p>
            <button onclick="window.location.reload()" style="display:block;width:100%;padding:14px;background:#0077B6;color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:600;cursor:pointer">
              Recarregar
            </button>
            <a href="/limpar.html" style="display:block;margin-top:12px;color:#00A8E8;font-size:.85rem;text-decoration:none">
              Limpar cache e tentar novamente
            </a>
            <p style="color:#475569;font-size:.7rem;margin-top:16px;font-family:monospace">
              BOOT_ERROR: ${err instanceof Error ? err.message : String(err)}<br/>
              BUILD: ${_buildId} | ${_buildTime}
            </p>
          </div>
        </div>
      `;
    }
  }
}
