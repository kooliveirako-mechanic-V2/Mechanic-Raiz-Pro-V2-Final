// Proxy para Marketing Oracle CAPI — resolve CORS browser → endpoint público.
// [Fase I] Hardening:
//   - LEADS_SECRET lido de Deno.env (nunca hardcoded).
//   - Origin allowlist (em vez de CORS aberto).
//   - Erro controlado quando secret não está configurado.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const UPSTREAM = "https://marketing-tracking.lovable.app/api/public/capi-event";

const ALLOWED_ORIGINS = new Set<string>([
  "https://mechanicraizpro.com.br",
  "https://www.mechanicraizpro.com.br",
  "https://mt.mechanicraizpro.com.br",
]);

function buildCors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = buildCors(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Bloqueia origins fora da allowlist (browser hits sem origin permitido).
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return new Response(JSON.stringify({ error: "origin not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const leadsSecret = Deno.env.get("LEADS_SECRET");
  if (!leadsSecret) {
    console.error("[capi-proxy] LEADS_SECRET not configured in environment");
    return new Response(
      JSON.stringify({ ok: false, error: "server not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.text();
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-leads-secret": leadsSecret,
      },
      body,
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        "Content-Type": upstream.headers.get("content-type") || "application/json",
      },
    });
  } catch (e) {
    console.error("[capi-proxy] err", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
