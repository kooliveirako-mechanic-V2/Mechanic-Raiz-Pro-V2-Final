import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = "https://mechanicraizpro.com.br";

// ═══════════════════════════════════════════════════════════════════
// RATE LIMITING: 5 per minute per IP (prevent email bombing)
// ═══════════════════════════════════════════════════════════════════
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(identifier: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);
  if (Math.random() < 0.05) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (val.resetAt < now) rateLimitMap.delete(key);
    }
  }
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

// A/B subject lines — rotate based on timestamp
const subjectLines = [
  (nome: string, oficina: string) => `🔧 ${nome}, sua oficina "${oficina}" tá pronta — bora usar!`,
  (nome: string, oficina: string) => `${nome}, ${oficina} já tá no ar! Cadastre seu 1º cliente agora 🚀`,
  (nome: string, oficina: string) => `💰 ${nome}, quanto sua oficina perde sem controle? Descubra agora`,
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`welcome:${clientIP}`, 5, 60_000)) {
      return new Response(JSON.stringify({ error: "Muitas requisições" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    // Validate body size
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 4096) {
      return new Response(JSON.stringify({ error: "Requisição inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Requisição inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, nome, oficina, tipo } = body as {
      email?: string;
      nome?: string;
      oficina?: string;
      tipo?: string;
    };

    // Validate email
    if (!email || typeof email !== "string" || email.length > 255) {
      return new Response(JSON.stringify({ error: "Email obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Email inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize inputs
    const safeName = (nome || "").replace(/[<>"']/g, "").slice(0, 100);
    const safeOficina = (oficina || "sua oficina").replace(/[<>"']/g, "").slice(0, 100);
    const safeTipo = ["moto", "auto_eletrica", "carro", "ambos"].includes(tipo || "") ? tipo : "carro";

    const primeiro = safeName ? safeName.split(" ")[0] : "Ei";

    // Pick subject line variant based on minute parity
    const variant = new Date().getMinutes() % subjectLines.length;
    const subject = subjectLines[variant](primeiro, safeOficina);

    const dicaTipo = safeTipo === "moto"
      ? { emoji: "🏍️", texto: "Controle de peças, garantias e financeiro — tudo num lugar só.", cor: "#F97316" }
      : safeTipo === "auto_eletrica"
      ? { emoji: "⚡", texto: "Diagnósticos documentados, peças rastreadas e cliente confiando mais.", cor: "#FBBF24" }
      : { emoji: "🚗", texto: "OS, financeiro, estoque e clientes — sem caderninho, sem planilha.", cor: "#0077B6" };

    const trackingId = crypto.randomUUID();

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>Bem-vindo ao Mechanic Raiz Pro</title>
  <!--[if mso]>
  <style>table,td,div,p,a,span{font-family:Arial,sans-serif!important;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#0E1B2A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

<!-- Preheader text (hidden) -->
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  ${primeiro}, sua oficina ${safeOficina} está pronta! 14 dias grátis para testar tudo. Comece agora →
</div>

<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0E1B2A;padding:30px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:580px;">

  <!-- LOGO HEADER -->
  <tr><td style="text-align:center;padding:20px 0 30px;">
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="background:linear-gradient(135deg,#0077B6,#00A8E8);border-radius:14px;padding:14px;vertical-align:middle;">
          <span style="font-size:28px;color:#fff;">🔧</span>
        </td>
        <td style="padding-left:12px;vertical-align:middle;">
          <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Mechanic<span style="color:#00A8E8;">Pro</span></span>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- HERO CARD -->
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(145deg,#0F2640 0%,#132F50 50%,#0D1F35 100%);border-radius:20px;border:1px solid rgba(0,168,232,0.15);overflow:hidden;">
      
      <!-- Hero gradient top bar -->
      <tr><td style="height:4px;background:linear-gradient(90deg,#0077B6,#00A8E8,#FF7A18,#00A8E8,#0077B6);"></td></tr>
      
      <!-- Hero content -->
      <tr><td style="padding:40px 32px 30px;">
        <h1 style="color:#ffffff;margin:0 0 8px;font-size:28px;font-weight:800;line-height:1.2;letter-spacing:-0.5px;">
          Fala, ${primeiro}! 👋
        </h1>
        <p style="color:rgba(255,255,255,0.7);margin:0;font-size:16px;line-height:1.6;">
          Sua oficina <strong style="color:#00A8E8;">${safeOficina}</strong> foi criada com sucesso.
        </p>
      </td></tr>

      <!-- Tipo badge -->
      <tr><td style="padding:0 32px 24px;">
        <table cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.05);border-radius:12px;border:1px solid rgba(255,255,255,0.08);width:100%;">
          <tr>
            <td style="padding:16px 20px;vertical-align:middle;width:50px;">
              <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,${dicaTipo.cor}22,${dicaTipo.cor}11);text-align:center;line-height:44px;font-size:24px;">
                ${dicaTipo.emoji}
              </div>
            </td>
            <td style="padding:16px 16px 16px 0;vertical-align:middle;">
              <p style="color:rgba(255,255,255,0.85);margin:0;font-size:14px;line-height:1.6;">
                ${dicaTipo.texto}
              </p>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Steps -->
      <tr><td style="padding:0 32px 28px;">
        <p style="color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin:0 0 16px;">
          Próximos passos
        </p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
          <tr>
            <td style="width:36px;vertical-align:top;">
              <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#0077B6,#00A8E8);text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#fff;">1</div>
            </td>
            <td style="padding:3px 0 0;vertical-align:top;">
              <p style="color:#ffffff;margin:0;font-size:14px;font-weight:600;">Cadastre seu primeiro cliente</p>
              <p style="color:rgba(255,255,255,0.5);margin:2px 0 0;font-size:13px;">Nome e telefone — 30 segundos</p>
            </td>
          </tr>
        </table>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
          <tr>
            <td style="width:36px;vertical-align:top;">
              <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#0077B6,#00A8E8);text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#fff;">2</div>
            </td>
            <td style="padding:3px 0 0;vertical-align:top;">
              <p style="color:#ffffff;margin:0;font-size:14px;font-weight:600;">Abra sua primeira OS</p>
              <p style="color:rgba(255,255,255,0.5);margin:2px 0 0;font-size:13px;">Registre o serviço e o valor</p>
            </td>
          </tr>
        </table>
        
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:36px;vertical-align:top;">
              <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#FF7A18,#FF9A40);text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#fff;">3</div>
            </td>
            <td style="padding:3px 0 0;vertical-align:top;">
              <p style="color:#ffffff;margin:0;font-size:14px;font-weight:600;">Veja seu lucro no Dashboard</p>
              <p style="color:rgba(255,255,255,0.5);margin:2px 0 0;font-size:13px;">Entenda pra onde vai seu dinheiro</p>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- CTA Button -->
      <tr><td style="padding:0 32px 36px;text-align:center;">
        <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr><td style="border-radius:12px;background:linear-gradient(135deg,#FF7A00,#FF9A40);box-shadow:0 8px 24px rgba(255,122,0,0.35);">
            <a href="${BASE_URL}/auth" style="display:inline-block;color:#ffffff;text-decoration:none;padding:16px 48px;font-size:16px;font-weight:700;letter-spacing:0.3px;">
              Abrir minha oficina →
            </a>
          </td></tr>
        </table>
      </td></tr>

    </table>
  </td></tr>

  <!-- TRIAL INFO CARD -->
  <tr><td style="padding:20px 0 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(0,168,232,0.08);border-radius:16px;border:1px solid rgba(0,168,232,0.12);">
      <tr><td style="padding:24px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:middle;">
              <p style="color:#00A8E8;font-size:14px;font-weight:700;margin:0 0 4px;">
                ⏱️ 14 dias grátis — sem cartão
              </p>
              <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0;line-height:1.5;">
                Use todas as funcionalidades. Se gostar, planos a partir de <strong style="color:rgba(255,255,255,0.7);">R$ 47,90/mês</strong>.
              </p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:32px 0 10px;text-align:center;">
    <p style="color:rgba(255,255,255,0.35);font-size:12px;margin:0 0 8px;">Dúvida? Chama no WhatsApp que eu te ajudo!</p>
    <a href="https://wa.me/5511950891497" style="color:#00A8E8;text-decoration:none;font-size:13px;font-weight:600;">📱 Falar comigo</a>
    <p style="color:rgba(255,255,255,0.2);font-size:11px;margin:16px 0 0;">
      Mechanic Raiz Pro · Sistema para oficinas mecânicas<br>
      <a href="${BASE_URL}" style="color:rgba(255,255,255,0.3);text-decoration:none;">mechanicraizpro.com.br</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>

</body>
</html>`;

    if (!RESEND_API_KEY) {
      console.error("Email service not configured");
      return new Response(JSON.stringify({ error: "Serviço de email indisponível" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Mechanic Raiz Pro <suporte@mechanicraizpro.com.br>",
        to: [email.trim()],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      console.error("Welcome email send failed:", res.status);
      return new Response(JSON.stringify({ error: "Erro ao enviar email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    // SECURITY: Don't log email addresses
    console.log(`Welcome email sent | variant=${variant}`);

    return new Response(JSON.stringify({ success: true, variant }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Welcome email error");
    return new Response(JSON.stringify({ error: "Erro ao processar solicitação" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
