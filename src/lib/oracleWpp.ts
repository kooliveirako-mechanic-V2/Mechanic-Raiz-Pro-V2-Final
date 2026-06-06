// Helper central — abre WhatsApp e empurra evento Contact para o dataLayer/GTM.
// REGRA RAIZ: a LP é a ÚNICA fonte da verdade da classificação de origem.
// Oracle apenas espelha. Nunca inventar utm_source/medium/campaign.
// [Fase I] LEADS_SECRET removido do client (era P0 secret leak).
// [Fase I] fbq('track','Contact') direto removido — Contact agora dispara
//          exclusivamente via GTM (tag "Meta Pixel - Contato" com
//          trigger mrp_event_name=contact_whatsapp e Event ID={{DLV - event_id}}).
import { trackEvent } from "@/lib/tracking";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const ID_KEYS = ["campaign_id", "adset_id", "ad_id", "placement", "fbclid", "gclid"] as const;
const FIRST_TOUCH_KEY = "mrp_first_touch_origin";

type StringMap = Record<string, string>;

type Origin = {
  utm_source: string;
  utm_medium: string;
  utm_campaign?: string;
  source_label: string; // human label para mensagem WhatsApp
};

function readUrlParams(): StringMap {
  const out: StringMap = {};
  try {
    const qs = new URLSearchParams(window.location.search);
    [...UTM_KEYS, ...ID_KEYS].forEach((k) => {
      const v = qs.get(k);
      if (v) out[k] = v;
    });
  } catch {}
  return out;
}

function readCookie(name: string): string {
  try {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&") + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  } catch {
    return "";
  }
}

// Classifica origem real a partir de URL/referrer. NUNCA inventa.
function classifyOrigin(): Origin {
  const url = readUrlParams();
  const ref = (() => {
    try { return document.referrer || ""; } catch { return ""; }
  })().toLowerCase();

  // 1) Ads pagos detectados por click ID (vocabulário NOVO: meta_ads/google_ads/tiktok_ads)
  if (url.fbclid) {
    return { utm_source: "meta_ads", utm_medium: "cpc", utm_campaign: url.utm_campaign || "meta_ads", source_label: "anuncio" };
  }
  if (url.gclid) {
    return { utm_source: "google_ads", utm_medium: "cpc", utm_campaign: url.utm_campaign || "google_ads", source_label: "anuncio" };
  }
  if ((url as any).ttclid) {
    return { utm_source: "tiktok_ads", utm_medium: "cpc", utm_campaign: url.utm_campaign || "tiktok_ads", source_label: "anuncio" };
  }

  // 2) UTM explícita na URL — normaliza vocabulário (Meta_Ads → meta_ads, GMB → gmb etc).
  if (url.utm_source) {
    const rawSrc = url.utm_source;
    const src = normalizeSource(rawSrc);
    const med = (url.utm_medium || "").toLowerCase();
    const isPaid = med === "cpc" || med === "paid" || med === "ads";
    let label = "campanha";
    if (isPaid) label = "anuncio";
    else if (src.includes("instagram")) label = "instagram";
    else if (src.includes("facebook")) label = "facebook";
    else if (src === "gmb" || src.includes("google_meu_negocio")) label = "gmb";
    else if (src.includes("tiktok")) label = "tiktok";
    else if (src.includes("youtube")) label = "youtube";
    else if (src.includes("whatsapp")) label = "whatsapp";
    return {
      utm_source: src || rawSrc,
      utm_medium: url.utm_medium || "referral",
      utm_campaign: url.utm_campaign,
      source_label: label,
    };
  }

  // 3) Referrer orgânico
  if (ref) {
    if (ref.includes("instagram.com")) return { utm_source: "instagram", utm_medium: "organic", source_label: "instagram" };
    if (ref.includes("facebook.com") || ref.includes("fb.com")) return { utm_source: "facebook", utm_medium: "organic", source_label: "facebook" };
    if (ref.includes("google.com/maps") || ref.includes("business.google") || ref.includes("maps.google")) {
      return { utm_source: "gmb", utm_medium: "organic", source_label: "gmb" };
    }
    if (ref.includes("google.")) return { utm_source: "google", utm_medium: "organic", source_label: "google" };
    if (ref.includes("tiktok.com")) return { utm_source: "tiktok", utm_medium: "organic", source_label: "tiktok" };
    if (ref.includes("youtube.com") || ref.includes("youtu.be")) return { utm_source: "youtube", utm_medium: "organic", source_label: "youtube" };
    if (ref.includes("whatsapp.com") || ref.includes("wa.me") || ref.includes("l.wl.co")) {
      return { utm_source: "whatsapp", utm_medium: "referral", source_label: "whatsapp" };
    }
    if (ref.includes("messenger.com") || ref.includes("m.me")) {
      return { utm_source: "messenger", utm_medium: "referral", source_label: "messenger" };
    }
    if (ref.includes("bing.com")) return { utm_source: "bing", utm_medium: "organic", source_label: "google" };
  }

  // 4) Sem sinal — direto/desconhecido. NÃO inventar.
  return { utm_source: "direct", utm_medium: "none", source_label: "direct" };
}

// First-touch: persiste a 1ª origem real e a respeita até o fim da visita.
function getFirstTouchOrigin(): Origin {
  try {
    const stored = localStorage.getItem(FIRST_TOUCH_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Origin;
      if (parsed && parsed.utm_source) return parsed;
    }
  } catch {}
  const fresh = classifyOrigin();
  try {
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(fresh));
  } catch {}
  return fresh;
}

// utm_slug: vindo do shortlink Marketing Oracle (?mo=CODE). Persistido em
// localStorage(mrp_utms) pelo script em index.html. Fallback: lê e valida `mo`
// da URL atual caso o script ainda não tenha rodado.
export function getUtmSlug(): string {
  // 1) localStorage (first-touch)
  try {
    const raw = localStorage.getItem("mrp_utms");
    if (raw) {
      const parsed = JSON.parse(raw);
      const v = parsed && typeof parsed.utm_slug === "string" ? parsed.utm_slug : "";
      if (/^[a-z0-9]{3,32}$/.test(v)) return v;
    }
  } catch {}
  // 2) URL atual
  try {
    const mo = new URLSearchParams(window.location.search).get("mo") || "";
    const s = mo.trim().toLowerCase();
    if (/^[a-z0-9]{3,32}$/.test(s)) return s;
  } catch {}
  return "";
}

export function getOriginContext(): StringMap {
  const o = getFirstTouchOrigin();
  const out: StringMap = {
    utm_source: o.utm_source,
    utm_medium: o.utm_medium,
  };
  if (o.utm_campaign) out.utm_campaign = o.utm_campaign;

  // IDs de campanha/click sempre da URL atual (têm prioridade quando presentes)
  const url = readUrlParams();
  ID_KEYS.forEach((k) => { if (url[k]) out[k] = url[k]; });

  // utm_slug: anexa quando disponível (opcional)
  const slug = getUtmSlug();
  if (slug) out.utm_slug = slug;
  return out;
}

// Lê atribuição persistida pelo capi-client.js no sessionStorage.
function readMocapiAttr(): StringMap {
  try {
    const raw = sessionStorage.getItem("_mocapi_attr");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

// Normaliza utm_source para o vocabulário oficial do Oracle (snake_case lowercase).
// Aceita formatos legados (Meta_Ads, fb, ig, gmn, etc.) e novos.
export function normalizeSource(source?: string | null): string {
  const s = (source || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!s) return '';

  // === PAGO ===
  if (['meta_ads', 'meta', 'facebook_ads', 'facebook_cpc', 'fb_ads', 'fbads'].includes(s)) return 'meta_ads';
  if (['google_ads', 'google_cpc', 'googleads', 'adwords'].includes(s)) return 'google_ads';
  if (['tiktok_ads', 'tiktok_cpc', 'tiktokads'].includes(s)) return 'tiktok_ads';

  // === ORGÂNICO ===
  if (['instagram', 'ig', 'insta'].includes(s)) return 'instagram';
  if (['facebook', 'fb'].includes(s)) return 'facebook';
  if (['gmb', 'gmn', 'google_meu_negocio', 'google_maps', 'maps'].includes(s)) return 'gmb';
  if (['youtube', 'yt'].includes(s)) return 'youtube';
  if (['tiktok', 'tt'].includes(s)) return 'tiktok';
  if (['whatsapp', 'wa', 'whats'].includes(s)) return 'whatsapp';
  if (['google'].includes(s)) return 'google';
  if (['direct', 'direto', 'none', '(direct)', '(none)'].includes(s)) return 'direct';

  return s; // mantém valor original normalizado se não houver mapeamento
}

// Mensagem WhatsApp dinâmica baseada em utm_source normalizado + fallback por referrer.
function buildDynamicMessage(ctx: {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  referrer?: string | null;
}): string {
  const src = normalizeSource(ctx.utm_source);
  const camp = (ctx.utm_campaign || '').trim().toLowerCase();
  const base = 'mais informações sobre o Mechanic Raiz Pro para oficinas e auto elétricas';

  // === PAGO ===
  if (src === 'meta_ads')    return `Olá! Vim pelo anúncio meta e quero ${base}.`;
  if (src === 'google_ads')  return `Olá! Vim pelo anúncio do google e quero ${base}.`;
  if (src === 'tiktok_ads')  return `Olá! Vim pelo anúncio e quero ${base}.`;

  // === ORGÂNICO ===
  if (src === 'instagram' && (camp === 'story' || camp === 'stories')) {
    return `Olá! Vim pelo Story do Instagram e quero ${base}.`;
  }
  if (src === 'instagram') return `Olá! Vim pela Bio do Instagram e quero ${base}.`;
  if (src === 'gmb')       return `Olá! Vim pelo Google Meu Negócio e quero ${base}.`;
  if (src === 'youtube')   return `Olá! Vim pelo YouTube e quero ${base}.`;
  if (src === 'tiktok')    return `Olá! Vim pelo TikTok e quero ${base}.`;
  if (src === 'google')    return `Olá! Vim pelo Google e quero ${base}.`;
  if (src === 'whatsapp')  return `Olá! Vim pelo WhatsApp e quero ${base}.`;
  if (src === 'facebook')  return `Olá! Vim pelo Facebook e quero ${base}.`;

  // === FALLBACK por referrer ===
  const ref = (ctx.referrer || '').toLowerCase();
  if (ref.includes('instagram')) return `Olá! Vim pela Bio do Instagram e quero ${base}.`;
  if (ref.includes('youtube'))   return `Olá! Vim pelo YouTube e quero ${base}.`;
  if (ref.includes('tiktok'))    return `Olá! Vim pelo TikTok e quero ${base}.`;
  if (ref.includes('google'))    return `Olá! Vim pelo Google e quero ${base}.`;

  // === DIRETO ===
  return `Olá! Quero ${base}.`;
}

// Monta contexto para mensagem dinâmica.
// Prioridade explícita: 1) first-touch salvo, 2) UTMs persistidas (mrp_utms),
// 3) URL atual, 4) sessionStorage do capi-client, 5) fallback vazio.
// utm_source é normalizado (Meta_Ads → meta_ads, GMB → gmb etc).
function buildMessageContext() {
  // 1) first-touch (mais autoritativo — origem inicial do lead)
  let ft: Partial<Origin> = {};
  try {
    const raw = localStorage.getItem(FIRST_TOUCH_KEY);
    if (raw) ft = JSON.parse(raw) as Partial<Origin>;
  } catch {}
  // 2) UTMs persistidas
  let saved: StringMap = {};
  try {
    const raw = localStorage.getItem("mrp_utms");
    if (raw) saved = JSON.parse(raw) as StringMap;
  } catch {}
  // 3) URL atual
  const url = readUrlParams();
  // 4) sessionStorage do capi-client
  const attr = readMocapiAttr();
  let referrer = "";
  try { referrer = document.referrer || ""; } catch {}

  const pick = (k: string) =>
    (ft as any)[k] || saved[k] || url[k] || attr[k] || "";

  // Detecta paid via click ID quando utm_source ainda não veio normalizado
  const hasFbclid = !!(url.fbclid || saved.fbclid || attr.fbclid);
  const hasGclid = !!(url.gclid || saved.gclid || attr.gclid);
  let utm_source = pick("utm_source");
  if (!utm_source && hasFbclid) utm_source = "meta_ads";
  else if (!utm_source && hasGclid) utm_source = "google_ads";

  return {
    utm_source: normalizeSource(utm_source),
    utm_medium: pick("utm_medium"),
    utm_campaign: pick("utm_campaign"),
    utm_content: pick("utm_content"),
    referrer,
  };
}

// [Fase I] buildOracleWppUrl REMOVIDO — era função morta e exigia LEADS_SECRET
// no client. O fluxo oficial agora vai direto para wa.me, com tracking pelo GTM.

// Dispara trackEvent('contact_whatsapp') (dataLayer → GTM → Meta Pixel) e abre wa.me.
// Se `message` não vier, usa mensagem dinâmica baseada na origem real.
export async function trackContactAndOpenWpp(
  mocCta: string,
  options?: { message?: string; contentName?: string; target?: "_blank" | "_self" }
): Promise<void> {
  const ft = getFirstTouchOrigin();
  const message = options?.message ?? buildDynamicMessage(buildMessageContext());
  const contentName = `wpp_${mocCta}`;
  const target = options?.target ?? "_blank";

  try {
    const origin = getOriginContext();
    if (origin.utm_source) origin.utm_source = normalizeSource(origin.utm_source);
    const fbp = readCookie("_fbp");
    const fbc = readCookie("_fbc");

    const tracking_context: StringMap = { ...origin };
    if (fbp) tracking_context.fbp = fbp;
    if (fbc) tracking_context.fbc = fbc;
    tracking_context.utm_content = mocCta;
    tracking_context.moc_cta = mocCta;
    tracking_context.moc_route = "wpp";
    tracking_context.origin_label = ft.source_label;
    try {
      tracking_context.source_url = window.location.href;
      if (document.referrer) tracking_context.referrer = document.referrer;
    } catch {}

    const payload: Record<string, any> = {
      content_name: contentName,
      content_category: mocCta,
      content_type: "wpp_cta",
      button_location: mocCta,
      tracking_context,
      ...tracking_context,
    };

    // [Fase I] Fonte oficial = dataLayer/GTM. A tag "Meta Pixel - Contato"
    // do GTM consome mrp_event_name=contact_whatsapp e usa Event ID={{DLV - event_id}}.
    // Dedup mantida: 1 disparo POR SESSÃO por origem de botão (Infinity TTL).
    trackEvent('contact_whatsapp', {
      dedupKey: `contact_whatsapp:${mocCta}`,
      dedupTtlMs: Number.POSITIVE_INFINITY,
      params: payload,
    });

    // [Fase I] fbq('track','Contact') direto REMOVIDO para evitar duplicação
    // com a tag GTM "Meta Pixel - Contato". A tag GTM dispara com eventID
    // compartilhado, garantindo dedup correto com a CAPI quando ela voltar
    // server-side via edge/proxy.

    // pequeno delay pra dar chance ao envio síncrono antes do open()
    await new Promise((r) => setTimeout(r, 150));
  } catch (e) {
    console.warn("[oracleWpp] Contact tracking failed", e);
  }

  const waUrl = `https://wa.me/5511950891497?text=${encodeURIComponent(message)}`;
  if (target === "_self") {
    window.location.href = waUrl;
  } else {
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }
}
