/**
 * [Fase B/C] Refatorado: agora é um WRAPPER FINO em cima de trackEvent().
 *
 * Antes: chamava fbq() + gtag() direto, gerando hits que NÃO passavam pelo
 * dataLayer/GTM e NÃO compartilhavam event_id com o CAPI (Pixel × CAPI sem dedup).
 *
 * Agora: cada função vira um trackEvent('<nome_canonico>', { params }), que:
 *   1) empurra no dataLayer (GTM consome — GA4/Ads são configurados lá),
 *   2) dispara Pixel + MOCapi com MESMO event_id (Meta dedupa),
 *   3) só dispara de verdade em hosts de produção (dry-run em preview).
 *
 * Mantemos a API pública pra não quebrar os 3 consumidores existentes
 * (useOrdensServico, useClientes, Onboarding). Podemos deletar o arquivo
 * depois que migrarmos os imports — por ora, zero risco de regressão.
 */

import { trackEvent } from "@/lib/tracking";

/** First oficina created (after signup) — renomeado de signup_completed para evitar duplicação com Auth.tsx. */
export function trackSignupCompleted(oficinaTipo?: string) {
  trackEvent("oficina_created", {
    params: { oficina_tipo: oficinaTipo },
    dedupKey: "oficina_created:session",
    dedupTtlMs: Infinity,
  });
}

/** First client registered in the platform */
export function trackCreatedFirstClient() {
  trackEvent("created_first_client", { params: {} });
}

/** First OS created */
export function trackCreatedFirstOS() {
  trackEvent("created_first_os", { params: {} });
}

/** First OS finalized - AHA moment */
export function trackOSFinalized() {
  trackEvent("os_finalized", { params: {} });
}

/** Trial expired with real usage */
export function trackTrialExpiredWithUsage(actionCount: number) {
  trackEvent("trial_expired_with_usage", { params: { action_count: actionCount } });
}
