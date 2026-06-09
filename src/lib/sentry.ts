import * as Sentry from "@sentry/react";

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN || "https://4b426ca865c3e76b89f9502e43cdaa6f@o4511072687882240.ingest.us.sentry.io/4511072703021056";

  // Não inicializar em localhost
  if (!dsn || window.location.hostname === "localhost") {
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: 0.3,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    ignoreErrors: [
      // Service Worker registration failures (non-critical)
      "Failed to register a ServiceWorker",
      "The Service Worker system has shutdown",
      // framer-motion noise
      "ResizeObserver loop",
      "ResizeObserver loop completed with undelivered notifications",
      // browser extensions
      "Non-Error promise rejection captured",
      // Dynamic import failures (handled by lazyWithRetry)
      "Failed to fetch dynamically imported module",
    ],
    beforeSend(event) {
      // Filtrar warnings do framer-motion
      if (event.message?.includes("framer-motion")) return null;
      return event;
    },
  });
}

/**
 * Identifica o usuário logado no Sentry
 */
export function setSentryUser(user: { id: string; email?: string }, oficina_id?: string) {
  Sentry.setUser({ id: user.id, email: user.email });
  if (oficina_id) {
    Sentry.setTag("oficina_id", oficina_id);
  }
}

export function clearSentryUser() {
  Sentry.setUser(null);
}

export { Sentry };
