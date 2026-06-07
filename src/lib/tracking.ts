// Tracking helpers — dedup eventID + fila segura para MOCapi (resolve race condition do `defer`).
// REGRA: 1 conversão real = 1 UUID v4 compartilhado entre fbq + MOCapi.
// Se MOCapi ainda não estiver carregado, evento entra na fila e dispara quando carregar.

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    MOCapi?: { track?: (name: string, payload: any) => any };
    dataLayer?: any[];
  }
}

/** UUID v4 — Meta dedupa melhor que timestamp/hash. */
export function generateEventId(): string {
  try {
    if (typeof crypto !== "undefined" && (crypto as any).randomUUID) {
      return (crypto as any).randomUUID();
    }
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
    return `${h.slice(0,4).join("")}-${h.slice(4,6).join("")}-${h.slice(6,8).join("")}-${h.slice(8,10).join("")}-${h.slice(10,16).join("")}`;
  } catch {
    return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

type QueuedEvent = { name: string; payload: any; ts: number };
const QUEUE: QueuedEvent[] = [];
let DRAIN_TIMER: ReturnType<typeof setInterval> | null = null;
const MAX_QUEUE_AGE_MS = 30_000;
const MAX_DRAIN_ATTEMPTS = 120; // ~30s @ 250ms

function pruneQueue() {
  const now = Date.now();
  while (QUEUE.length && now - QUEUE[0].ts > MAX_QUEUE_AGE_MS) QUEUE.shift();
}

function tryDrain(): boolean {
  const moc = typeof window !== "undefined" ? window.MOCapi : undefined;
  if (!moc || typeof moc.track !== "function") return false;
  pruneQueue();
  while (QUEUE.length) {
    const ev = QUEUE.shift()!;
    try {
      moc.track(ev.name, ev.payload);
      console.info("[MOCapi Queue] drained event", { name: ev.name, waitedMs: Date.now() - ev.ts });
    } catch (e) { console.warn("[tracking] MOCapi.track failed", e); }
  }
  return true;
}

function startDrainPolling() {
  if (DRAIN_TIMER) return;
  let attempts = 0;
  DRAIN_TIMER = setInterval(() => {
    attempts++;
    if (tryDrain()) {
      if (DRAIN_TIMER) { clearInterval(DRAIN_TIMER); DRAIN_TIMER = null; }
    } else if (attempts >= MAX_DRAIN_ATTEMPTS) {
      console.warn("[MOCapi Queue] timeout — MOCapi não carregou em 30s, descartando", QUEUE.length, "evento(s)");
      QUEUE.length = 0;
      if (DRAIN_TIMER) { clearInterval(DRAIN_TIMER); DRAIN_TIMER = null; }
    }
  }, 250);
}

/**
 * [Fase G] DESATIVADO — disparos diretos a MOCapi/CAPI foram removidos.
 * Mantido como no-op apenas para preservar a API e evitar quebra de imports.
 * O rastreamento Meta agora é configurado via Event Setup Tool do Meta.
 */
export function safeMocapiTrack(_name: string, _payload: any): void {
  // no-op
}

/**
 * [Fase I] NEUTRALIZADO — no-op.
 * Motivo: PageView agora sai 100% via dataLayer/GTM com eventID={{DLV - event_id}}.
 * Disparar fbq('track','PageView') direto, sem eventID compartilhado, duplicaria
 * o PageView com a tag GTM. Mantido apenas para preservar a assinatura e evitar
 * quebra dos imports legados — todos os callers devem ser removidos.
 */
export function notifyMetaUrlChange(): void {
  // no-op
}

/**
 * [Fase G] DESATIVADO — não dispara mais fbq nem MOCapi.
 * Mantido como no-op por compatibilidade. Retorna um eventId apenas
 * para preservar a assinatura.
 */
export function trackDedupedEvent(
  _eventName: string,
  _payload: Record<string, any> = {},
  options?: { eventId?: string }
): string {
  return options?.eventId || generateEventId();
}

// ============================================================================
// Fase 1a — trackEvent() central + visitor_id + session_id + dataLayer
// ----------------------------------------------------------------------------
// Esta seção NÃO substitui disparos existentes ainda (isso é Fase 1b).
// Apenas EXPÕE a API base para os componentes migrarem.
// ============================================================================

// ---------- Constantes ----------
const VISITOR_KEY = "mrp_visitor_id";
const SESSION_KEY = "mrp_session";
const UTM_STORAGE_KEY = "mrp_utms"; // já populado pelo index.html
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min de inatividade

// Domínios onde eventos REAIS podem disparar.
// Em qualquer outro host, ficamos em "dry-run" (log no console, sem rede).
const PROD_HOSTS = new Set([
  "mechanicraizpro.com.br",
  "www.mechanicraizpro.com.br",
  "mt.mechanicraizpro.com.br",
]);

// Mapeamento canônico: nome interno → Meta Pixel → MOCapi/CAPI
// Mantemos os nomes oficiais da Meta para preservar compatibilidade com
// Pixel direto + CAPI já configurados.
const EVENT_NAME_MAP: Record<string, { meta: string; mocapi: string }> = {
  page_view:            { meta: "PageView",             mocapi: "PageView" },
  view_plans:           { meta: "ViewContent",          mocapi: "ViewContent" },
  select_plan:          { meta: "InitiateCheckout",     mocapi: "InitiateCheckout" },
  contact_whatsapp:     { meta: "Contact",              mocapi: "Contact" },
  lead_created:         { meta: "Lead",                 mocapi: "Lead" },
  trial_intent_generic: { meta: "Lead",                 mocapi: "Lead" },
  signup_completed:     { meta: "CompleteRegistration", mocapi: "CompleteRegistration" },
  oficina_created:      { meta: "CompleteRegistration", mocapi: "CompleteRegistration" },
  payment_succeeded:    { meta: "Purchase",             mocapi: "Purchase" },
  payment_failed:       { meta: "PaymentFailed",        mocapi: "PaymentFailed" },
};

// ---------- Domain gating ----------
function getHost(): string {
  try { return (typeof window !== "undefined" ? window.location.hostname : "") || ""; } catch { return ""; }
}

export function isProductionHost(): boolean {
  return PROD_HOSTS.has(getHost());
}

// ---------- visitor_id (persistente em localStorage) ----------
export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = generateEventId();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch { return ""; }
}

// ---------- session_id (sessionStorage + 30min inatividade) ----------
type SessionRecord = { id: string; last: number; started: number };

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const now = Date.now();
    let rec: SessionRecord | null = null;
    try { rec = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch {}
    if (!rec || !rec.id || (now - (rec.last || 0)) > SESSION_TIMEOUT_MS) {
      rec = { id: generateEventId(), last: now, started: now };
    } else {
      rec.last = now;
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(rec));
    return rec.id;
  } catch { return ""; }
}

// ---------- Contexto (UTMs first-touch + click IDs + page meta) ----------
function readStoredUtms(): Record<string, any> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(UTM_STORAGE_KEY) || "{}"); } catch { return {}; }
}

function readUrlClickIds(): Record<string, string> {
  try {
    const qs = new URLSearchParams(window.location.search);
    const out: Record<string, string> = {};
    ["fbclid", "gclid", "ttclid", "msclkid"].forEach((k) => {
      const v = qs.get(k);
      if (v) out[k] = v;
    });
    return out;
  } catch { return {}; }
}

/** Contexto que vai junto em TODO evento (UTMs, click IDs, page meta). */
export function getTrackingContext(): Record<string, any> {
  const stored = readStoredUtms();
  const urlClicks = readUrlClickIds();
  let page_url = "", page_path = "", referrer = "", page_title = "";
  try {
    page_url = window.location.href;
    page_path = window.location.pathname + window.location.search;
    referrer = document.referrer || "";
    page_title = document.title || "";
  } catch {}
  return {
    // UTMs (first-touch via index.html → mrp_utms)
    utm_source:   stored.utm_source   || null,
    utm_medium:   stored.utm_medium   || null,
    utm_campaign: stored.utm_campaign || null,
    utm_content:  stored.utm_content  || null,
    utm_term:     stored.utm_term     || null,
    utm_slug:     stored.utm_slug     || null,
    // Click IDs (last-touch — URL atual > storage)
    fbclid: urlClicks.fbclid || stored.fbclid || null,
    gclid:  urlClicks.gclid  || stored.gclid  || null,
    ttclid: urlClicks.ttclid || null,
    // Page meta
    page_url,
    page_path,
    page_title,
    referrer,
    landing_page: stored._landing || null,
    timestamp: new Date().toISOString(),
  };
}

// Grava landing_page na primeira visita (chamado pelo bootstrap abaixo).
function ensureLandingPage() {
  try {
    const raw = localStorage.getItem(UTM_STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    if (!stored._landing) {
      stored._landing = window.location.href;
      stored._ts = stored._ts || Date.now();
      localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(stored));
    }
  } catch {}
}

// ---------- dataLayer.push padrão ----------
function pushDataLayer(payload: Record<string, any>) {
  try {
    if (typeof window === "undefined") return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
  } catch (e) { console.warn("[tracking] dataLayer.push failed", e); }
}

// ---------- trackEvent (API CENTRAL) ----------
export interface TrackEventOptions {
  /** Dados específicos do evento (plan_name, button_location, etc) */
  params?: Record<string, any>;
  /** Força um event_id (caso queira dedupar manualmente) */
  eventId?: string;
  /** Pula Meta Pixel (ex.: page_view se já está fazendo via outro canal) */
  skipPixel?: boolean;
  /** Pula MOCapi/CAPI */
  skipMocapi?: boolean;
  /** Pula dataLayer */
  skipDataLayer?: boolean;
  /**
   * Chave única p/ deduplicar o disparo. Se o MESMO dedupKey for chamado
   * dentro de `dedupTtlMs`, o evento é IGNORADO (retorna ''). Usa sessionStorage.
   * Ex.: dedupKey="select_plan:moto_pro:annual" evita re-cliques no mesmo plano.
   */
  dedupKey?: string;
  /** Janela de dedup em ms (default 2000). Use Infinity para 1x por sessão. */
  dedupTtlMs?: number;
}

const DEDUP_PREFIX = "mrp_dedup_";
function shouldSkipByDedup(key: string, ttlMs: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    const storeKey = DEDUP_PREFIX + key;
    const lastStr = sessionStorage.getItem(storeKey);
    const now = Date.now();
    if (lastStr) {
      const last = Number(lastStr);
      if (Number.isFinite(last) && now - last < ttlMs) return true;
    }
    sessionStorage.setItem(storeKey, String(now));
    return false;
  } catch { return false; }
}

/**
 * API CENTRAL de tracking da LP.
 *
 * Cada chamada:
 *  1. Gera/usa event_id (UUID v4) — mesmo valor para Pixel + CAPI = Meta dedupa.
 *  2. Monta payload completo: { event_id, visitor_id, session_id, ...contexto, ...params }.
 *  3. Empurra para o dataLayer com `event: "mrp_event"` (GTM consome isso).
 *  4. Dispara Meta Pixel direto (fbq) com o nome oficial mapeado + eventID.
 *  5. Dispara MOCapi/CAPI (safeMocapiTrack) com o mesmo event_id.
 *
 * Em hosts não-produção (lovable.app, vercel preview, localhost):
 *   apenas LOGA — não dispara fbq, MOCapi nem dataLayer.
 *
 * @returns event_id usado (útil para correlacionar logs / passar a CAPI server)
 */
export function trackEvent(mrpEventName: string, options: TrackEventOptions = {}): string {
  const { params = {}, skipPixel, skipMocapi, skipDataLayer, dedupKey, dedupTtlMs = 2000 } = options;
  
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
  const now = Date.now();

  // 🛡️ BLOQUEIO 1: PageView duplicado no mesmo pathname.
  if (mrpEventName === "page_view") {
    const lastTrackedPath = sessionStorage.getItem("mrp_last_tracked_pageview");
    const lastTrackedTime = Number(sessionStorage.getItem("mrp_last_tracked_time") || 0);
    
    // Se o path é o mesmo e foi disparado há menos de 3 segundos, ignoramos (mesmo que mude query params)
    if (!params.is_initial_load && currentPath === lastTrackedPath && (now - lastTrackedTime < 3000)) {
      console.info("[trackEvent] 🛡️ PageView BLOQUEADO (repetido/muito rápido):", currentPath);
      return "";
    }
    
    // 🛡️ BLOQUEIO 2: Bloqueio pós-conversão (select_plan, lead_created, etc)
    const conversionLockTime = Number(sessionStorage.getItem("mrp_conversion_lock_time") || 0);
    if (now - conversionLockTime < 4000) {
      console.info("[trackEvent] 🛡️ PageView BLOQUEADO (pós-conversão recente):", currentPath);
      return "";
    }

    sessionStorage.setItem("mrp_last_tracked_pageview", currentPath);
    sessionStorage.setItem("mrp_last_tracked_time", String(now));
  }

  // 🛡️ BLOQUEIO 3: Ativa lock de conversão
  // Se o evento for select_plan ou lead_created, nós bloqueamos QUALQUER page_view nos próximos 4 segundos.
  // Isso mata qualquer disparo automático de GTM/History que ocorra durante o fluxo de checkout/signup.
  if (mrpEventName === "select_plan" || mrpEventName === "lead_created" || mrpEventName === "trial_intent_generic") {
    sessionStorage.setItem("mrp_conversion_lock_time", String(now));
    console.info(`[trackEvent] 🛡️ LOCK de PageView ativado por 4s (evento: ${mrpEventName})`);
  }

  if (dedupKey && shouldSkipByDedup(dedupKey, dedupTtlMs)) {
    console.info("[trackEvent SKIP dedup]", mrpEventName, { dedupKey, dedupTtlMs });
    return "";
  }

  const eventId = options.eventId || generateEventId();
  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  const context = getTrackingContext();

  const fullPayload = {
    event_id: eventId,
    visitor_id: visitorId,
    session_id: sessionId,
    ...context,
    ...params,
  };

  const isProd = isProductionHost();

  // 1) dataLayer (GTM)
  if (!skipDataLayer) {
    // Para PageView, enviamos o nome oficial esperado por triggers legados
    const gtmEvent = mrpEventName === "page_view" ? "page_view" : "mrp_event";
    
    pushDataLayer({
      event: gtmEvent,
      mrp_event_name: mrpEventName,
      ...fullPayload,
    });

    // Se for PageView, enviamos um SEGUNDO push com mrp_event para garantir que tags
    // baseadas no trigger genérico também funcionem.
    if (gtmEvent === "page_view") {
      pushDataLayer({
        event: "mrp_event",
        mrp_event_name: mrpEventName,
        ...fullPayload,
      });
    }
  }

  // [Fase G] Disparos diretos de Meta Pixel (fbq) e MOCapi/CAPI removidos.
  void skipPixel; void skipMocapi;

  console.info(isProd ? "[trackEvent]" : "[trackEvent PREVIEW]", mrpEventName, {
    eventId,
    gtm_event: mrpEventName === "page_view" ? "page_view" : "mrp_event",
    params,
  });
  return eventId;
}

// ---------- Bootstrap ----------
if (typeof window !== "undefined") {
  try {
    getVisitorId();
    ensureLandingPage();
  } catch {}
}
