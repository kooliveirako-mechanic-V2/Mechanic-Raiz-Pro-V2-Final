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
const ALERT_EMAIL = "ko.oliveira2016@gmail.com";
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
           <p>Abra <a href="https://mechanicraizpro.lovable.app/sentinela">o painel Sentinela</a> para investigar.</p>`
        ),
        payload: { rpc, count },
      });
    }
  }
  return alerts;
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
  const alerts: AlertItem[] = [];
  for (const l of logs) {
    const nd = (l.new_data as { rpc?: string; severity?: string; message?: string } | null) ?? {};
    const isFatal = nd.severity === "fatal";
    const isFinancial = /financ|parcela|pagamento|venda_balcao/i.test(nd.rpc ?? "");
    if (!isFatal && !isFinancial) continue;
    alerts.push({
      alert_type: isFatal ? "fatal_error" : "financial_error",
      alert_key: `${isFatal ? "fatal" : "fin"}:${nd.rpc ?? "?"}:${l.id}`,
      subject: isFatal ? `Erro FATAL em ${nd.rpc}` : `Erro em RPC financeira (${nd.rpc})`,
      body_html: htmlWrap(
        isFatal ? "Erro FATAL" : "Erro em RPC financeira",
        `<p><b>RPC:</b> ${nd.rpc}<br/><b>Oficina:</b> ${l.oficina_id ?? "?"}<br/>
         <b>Mensagem:</b> ${nd.message ?? "—"}</p>`
      ),
      payload: { log_id: l.id, rpc: nd.rpc, severity: nd.severity },
    });
  }
  return alerts;
}

async function checkSilentBugs(): Promise<AlertItem[]> {
  const { data: det, error } = await admin.rpc("get_sentinela_detectores_admin");
  // Fallback: chamamos via SQL bruto se RPC admin não existir
  let detectores: Array<{ id: string; label: string; count: number; severidade: string }> = [];
  if (!error && det && (det as { detectores?: unknown[] }).detectores) {
    detectores = (det as { detectores: Array<{ id: string; label: string; count: number; severidade: string }> }).detectores;
  } else {
    // Faz cada query manualmente (service-role ignora RLS)
    const [osSemItem, estoqueNeg, parcelaSemFin, osSemParcela] = await Promise.all([
      admin.from("ordens_servico").select("id", { count: "exact", head: true }).eq("status", "finalizada"),
      admin.from("estoque").select("id", { count: "exact", head: true }).lt("quantidade", 0),
      admin.from("parcelas_pagamento").select("id", { count: "exact", head: true }).eq("status", "pago"),
      admin.from("ordens_servico").select("id", { count: "exact", head: true }).eq("status", "finalizada").gt("valor_servico", 0),
    ]);
    // Aproximação: contagens brutas (não cruzam com NOT EXISTS). Mantemos como sinal.
    detectores = [
      { id: "estoque_negativo", label: "Estoque negativo", count: estoqueNeg.count ?? 0, severidade: "red" },
    ];
    // Detectores que exigem NOT EXISTS são melhor servidos pela RPC; se ela falhou, logamos.
    console.warn("[sentinela] get_sentinela_detectores_admin indisponível — usando fallback parcial", error);
    void osSemItem; void parcelaSemFin; void osSemParcela;
  }

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
           <p>Abra <a href="https://mechanicraizpro.lovable.app/sentinela">o painel Sentinela</a>.</p>`
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
