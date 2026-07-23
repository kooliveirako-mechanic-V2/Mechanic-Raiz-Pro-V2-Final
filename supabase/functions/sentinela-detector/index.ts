// SENTINELA RAIZ — Camada 2 (Detector + Alertas)
// Executado por cron a cada 5 minutos.
// 1) Pico de erros: >=3 erros do mesmo tipo em 10 min -> e-mail
// 2) Erros FATAL ou em RPCs financeiras -> e-mail imediato
// 3) 4 detectores de bug silencioso -> e-mail imediato
// Cooldown: 30 min por alert_key (sentinela_alertas_enviados)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// Fase 2.1: e-mail de alerta vem APENAS do secret SENTINELA_ALERT_EMAIL.
// Sem fallback hardcoded: se o secret não estiver definido, o detector
// continua rodando (capturando bugs, gravando snapshot), mas NÃO envia
// e-mail — apenas registra console.warn. Configure o secret antes do deploy.
const ALERT_EMAIL = Deno.env.get("SENTINELA_ALERT_EMAIL") ?? "";
if (!ALERT_EMAIL) {
  console.warn("[sentinela] SENTINELA_ALERT_EMAIL ausente: alerta por e-mail não será enviado");
}
const COOLDOWN_MINUTES = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface AlertItem {
  alert_type: string; // ex: "spike_error", "fatal_error", "detector"
  alert_key: string;  // chave única para cooldown
  subject: string;
  body_html: string;
  payload: Record<string, unknown>;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!to) {
    console.warn("[sentinela] sem destinatário (SENTINELA_ALERT_EMAIL) — alerta não enviado:", subject);
    return false;
  }
  if (!RESEND_API_KEY) {
    console.error("[sentinela] RESEND_API_KEY ausente — pulando envio");
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Sentinela Raiz <suporte@mechanicraizpro.com.br>",
      to: [to],
      subject: `[Sentinela] ${subject}`,
      html,
    }),
  });
  if (!res.ok) {
    console.error("[sentinela] Resend falhou:", await res.text());
    return false;
  }
  return true;
}

/** Verifica cooldown. true = pode enviar. */
async function inCooldown(alert_key: string): Promise<boolean> {
  const since = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000).toISOString();
  const { data } = await admin
    .from("sentinela_alertas_enviados")
    .select("id")
    .eq("alert_key", alert_key)
    .gte("sent_at", since)
    .limit(1);
  return !!(data && data.length > 0);
}

async function recordSent(alert_type: string, alert_key: string, payload: Record<string, unknown>) {
  await admin.from("sentinela_alertas_enviados").insert({ alert_type, alert_key, payload });
}

async function dispatch(item: AlertItem): Promise<{ key: string; sent: boolean; reason?: string }> {
  if (await inCooldown(item.alert_key)) {
    return { key: item.alert_key, sent: false, reason: "cooldown" };
  }
  const ok = await sendEmail(ALERT_EMAIL, item.subject, item.body_html);
  if (ok) await recordSent(item.alert_type, item.alert_key, item.payload);
  return { key: item.alert_key, sent: ok };
}

function htmlWrap(title: string, body: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0E1B2A;color:#fff;border-radius:12px">
    <h1 style="color:#FF7A18;margin:0 0 12px">🛡️ ${title}</h1>
    <div style="background:#fff;color:#0E1B2A;padding:16px;border-radius:8px;margin-top:12px">${body}</div>
    <p style="font-size:11px;opacity:.7;margin-top:16px">Sentinela Raiz — ${new Date().toLocaleString("pt-BR")}</p>
  </div>`;
}

/* ------------------ DETECTORES ------------------ */

async function checkSpikes(): Promise<AlertItem[]> {
  // ≥3 erros do mesmo RPC em 10 min
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: logs } = await admin
    .from("audit_logs")
    .select("new_data, created_at")
    .eq("action", "runtime_error")
    .gte("created_at", since);

  if (!logs || logs.length === 0) return [];

  const counts: Record<string, number> = {};
  for (const l of logs) {
    const rpc = (l.new_data as { rpc?: string } | null)?.rpc ?? "desconhecido";
    counts[rpc] = (counts[rpc] || 0) + 1;
  }

  const alerts: AlertItem[] = [];
  for (const [rpc, count] of Object.entries(counts)) {
    if (count >= 3) {
      alerts.push({
        alert_type: "spike_error",
        alert_key: `spike:${rpc}`,
        subject: `Pico de erros em ${rpc} (${count} em 10min)`,
        body_html: htmlWrap(
          "Pico de erros detectado",
          `<p><b>RPC:</b> ${rpc}<br/><b>Ocorrências:</b> ${count} nos últimos 10 minutos.</p>
           <p>Abra <a href="https://www.mechanicraizpro.com.br/sentinela">o painel Sentinela</a> para investigar.</p>`
        ),
        payload: { rpc, count },
      });
    }
  }
  return alerts;
}

/** Normaliza mensagem para agrupamento: minúsculas, sem números/UUIDs/aspas. */
function normalizeMessage(msg: string): string {
  return (msg || "")
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<uuid>")
    .replace(/\d+/g, "<n>")
    .replace(/['"`]/g, "")
    .slice(0, 120);
}

async function checkFatalsAndFinancial(): Promise<AlertItem[]> {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: logs } = await admin
    .from("audit_logs")
    .select("id, new_data, created_at, oficina_id")
    .eq("action", "runtime_error")
    .gte("created_at", since)
    .limit(50);

  if (!logs) return [];

  // Agrupa por (tipo, rpc, oficina, mensagem normalizada). Sem l.id => sem spam.
  const groups = new Map<string, { type: "fatal" | "fin"; rpc: string; oficina: string; msg: string; count: number; firstId: string }>();
  for (const l of logs) {
    const nd = (l.new_data as { rpc?: string; severity?: string; message?: string } | null) ?? {};
    const isFatal = nd.severity === "fatal";
    const isFinancial = /financ|parcela|pagamento|venda_balcao/i.test(nd.rpc ?? "");
    if (!isFatal && !isFinancial) continue;
    const type: "fatal" | "fin" = isFatal ? "fatal" : "fin";
    const rpc = nd.rpc ?? "?";
    const oficina = (l.oficina_id as string | null) ?? "?";
    const msg = normalizeMessage(nd.message ?? "");
    const key = `${type}:${rpc}:${oficina}:${msg}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
    } else {
      groups.set(key, { type, rpc, oficina, msg, count: 1, firstId: l.id as string });
    }
  }

  const alerts: AlertItem[] = [];
  for (const g of groups.values()) {
    alerts.push({
      alert_type: g.type === "fatal" ? "fatal_error" : "financial_error",
      alert_key: `${g.type}:${g.rpc}:${g.oficina}:${g.msg}`,
      subject:
        g.type === "fatal"
          ? `Erro FATAL em ${g.rpc} (${g.count}x)`
          : `Erro em RPC financeira (${g.rpc}, ${g.count}x)`,
      body_html: htmlWrap(
        g.type === "fatal" ? "Erro FATAL" : "Erro em RPC financeira",
        `<p><b>RPC:</b> ${g.rpc}<br/><b>Oficina:</b> ${g.oficina}<br/>
         <b>Ocorrências (10min):</b> ${g.count}<br/>
         <b>Mensagem:</b> ${g.msg || "—"}</p>`
      ),
      payload: { rpc: g.rpc, oficina: g.oficina, count: g.count, first_log_id: g.firstId },
    });
  }
  return alerts;
}

async function checkSilentBugs(): Promise<AlertItem[]> {
  const { data: det, error } = await admin.rpc("get_sentinela_detectores_admin");

  // Se a RPC admin falhar, NÃO inventamos contagem — alertamos falha do detector.
  if (error || !det || !(det as { detectores?: unknown[] }).detectores) {
    console.error("[sentinela] get_sentinela_detectores_admin indisponível", error);
    return [
      {
        alert_type: "detector_failure",
        alert_key: `detector_failure:get_sentinela_detectores_admin`,
        subject: "Detector indisponível: get_sentinela_detectores_admin",
        body_html: htmlWrap(
          "Detector indisponível",
          `<p>A RPC <b>get_sentinela_detectores_admin</b> falhou ao executar.</p>
           <p><b>Erro:</b> ${error?.message ?? "sem detalhes"}</p>
           <p>Bugs silenciosos NÃO foram verificados neste ciclo. Investigue a RPC.</p>`
        ),
        payload: { error: error?.message ?? null },
      },
    ];
  }

  const detectores = (det as { detectores: Array<{ id: string; label: string; count: number; severidade: string }> }).detectores;
  const alerts: AlertItem[] = [];
  for (const d of detectores) {
    if (d.count > 0) {
      alerts.push({
        alert_type: "detector",
        alert_key: `det:${d.id}`,
        subject: `${d.label}: ${d.count} ocorrência(s)`,
        body_html: htmlWrap(
          d.label,
          `<p><b>Detector:</b> ${d.id}<br/><b>Ocorrências:</b> ${d.count}<br/><b>Severidade:</b> ${d.severidade}</p>
           <p>Abra <a href="https://www.mechanicraizpro.com.br/sentinela">o painel Sentinela</a>.</p>`
        ),
        payload: d as unknown as Record<string, unknown>,
      });
    }
  }
  return alerts;
}

/* ------------------ HANDLER ------------------ */

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const results: Array<{ key: string; sent: boolean; reason?: string }> = [];
    const all: AlertItem[] = [
      ...(await checkSpikes()),
      ...(await checkFatalsAndFinancial()),
      ...(await checkSilentBugs()),
    ];
    for (const item of all) {
      results.push(await dispatch(item));
    }
    return new Response(
      JSON.stringify({ success: true, total: all.length, results, timestamp: new Date().toISOString() }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    console.error("[sentinela-detector] erro", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
