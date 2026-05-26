import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CustomEmailRequest {
  to: string;
  subject: string;
  html: string;
}

// Basic email validation
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Simple in-memory rate limit (per cold start) — 5 req/min per caller key
const rateMap = new Map<string, number[]>();
function rateLimit(key: string, max = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (rateMap.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  rateMap.set(key, arr);
  return true;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ─── AUTHENTICATION ────────────────────────────────────────────
    // Accept either a valid JWT (logged-in user calling from app)
    // OR a matching x-internal-secret header (server-to-server).
    const internalSecret = req.headers.get("x-internal-secret");
    const authHeader = req.headers.get("Authorization");
    let callerKey = "anon";
    let authorized = false;

    if (INTERNAL_SECRET && internalSecret && internalSecret === INTERNAL_SECRET) {
      authorized = true;
      callerKey = "internal";
    } else if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data, error } = await supabase.auth.getClaims(token);
      if (!error && data?.claims?.sub) {
        authorized = true;
        callerKey = `user:${data.claims.sub}`;
      }
    }

    if (!authorized) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    // ─── RATE LIMIT ────────────────────────────────────────────────
    if (!rateLimit(callerKey)) {
      return new Response(
        JSON.stringify({ success: false, error: "Too many requests" }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    // ─── INPUT VALIDATION ─────────────────────────────────────────
    const body = (await req.json()) as Partial<CustomEmailRequest>;
    const to = typeof body.to === "string" ? body.to.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const html = typeof body.html === "string" ? body.html : "";

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ success: false, error: "Campos obrigatórios: to, subject, html" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    if (!EMAIL_RE.test(to) || to.length > 254) {
      return new Response(
        JSON.stringify({ success: false, error: "Email inválido" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    if (subject.length > 200) {
      return new Response(
        JSON.stringify({ success: false, error: "Assunto muito longo" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    if (html.length > 200_000) {
      return new Response(
        JSON.stringify({ success: false, error: "Conteúdo HTML muito grande" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    console.log(`Enviando email para: ${to} (caller: ${callerKey})`);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Mechanic Raiz Pro <suporte@mechanicraizpro.com.br>",
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Erro da API Resend:", errorText);
      return new Response(
        JSON.stringify({ success: false, error: "Falha ao enviar email" }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const data = await res.json();
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Erro ao enviar email customizado:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
