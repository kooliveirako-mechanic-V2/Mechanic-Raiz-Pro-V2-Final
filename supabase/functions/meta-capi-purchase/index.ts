// [Fase I] ARQUIVADA — função stub retorna 410 Gone.
// Motivo: era enviada Purchase direto para Meta sem deduplicação garantida
// com o Pixel browser. A partir de agora, Purchase é disparada via GTM
// (mrp_event_name=payment_succeeded) com Event ID={{DLV - event_id}}, e a
// CAPI server-side voltará via Marketing Oracle (proxy seguro) reutilizando
// o mesmo event_id.
//
// Mantemos a função publicada (não deletamos) apenas para detectar callers
// remanescentes via logs. Se ficar 100% sem hits, podemos deletar.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.warn("[meta-capi-purchase ARCHIVED] unexpected call", {
      method: req.method,
      origin: req.headers.get("origin"),
      referer: req.headers.get("referer"),
      user_agent: req.headers.get("user-agent"),
    });
  } catch {
    // ignore logging errors
  }

  return new Response(
    JSON.stringify({
      ok: false,
      error: "gone",
      message:
        "meta-capi-purchase foi arquivada. Purchase agora dispara via GTM (payment_succeeded) e CAPI volta via Marketing Oracle proxy.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
