import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════════════
// RATE LIMITING: 5 requests per 15 minutes per IP (prevent email bombing)
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

// SECURITY: Always return same response regardless of email existence
const GENERIC_SUCCESS = {
  success: true,
  message: "Se o email existir, você receberá um link de recuperação.",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting by IP
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`pwd-reset:${clientIP}`, 5, 15 * 60_000)) {
      // Return generic success to not reveal rate limiting to attackers
      return new Response(JSON.stringify(GENERIC_SUCCESS), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Validate body size (prevent large payload attacks)
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 2048) {
      return new Response(JSON.stringify({ error: "Requisição inválida" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Requisição inválida" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { email, redirectUrl } = body as { email?: string; redirectUrl?: string };

    // Validate email format
    if (!email || typeof email !== "string" || email.length > 255) {
      return new Response(JSON.stringify({ error: "Email inválido" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Email inválido" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Validate redirectUrl - only allow our own domains
    const allowedOrigins = [
      "https://mechanicraizpro.com.br",
      "https://www.mechanicraizpro.com.br",
      "https://mechanicraizpro.vercel.app",
      "https://mechanicraizpro.com.br",
    ];

    let safeRedirectUrl = "https://mechanicraizpro.com.br/reset-password";
    if (redirectUrl && typeof redirectUrl === "string") {
      try {
        const parsed = new URL(redirectUrl);
        // Only accept allowlisted origins AND only the /reset-password path
        if (
          allowedOrigins.some((o) => parsed.origin === o) &&
          parsed.pathname === "/reset-password"
        ) {
          safeRedirectUrl = redirectUrl;
        }
      } catch {
        // Invalid URL, use default
      }
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate password reset link
    const { data, error: resetError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: email.trim().toLowerCase(),
      options: {
        redirectTo: safeRedirectUrl,
      },
    });

    if (resetError) {
      console.error("Error generating reset link (non-identifying):", resetError.status);
      // SECURITY: Don't reveal if email exists or not
      return new Response(JSON.stringify(GENERIC_SUCCESS), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const resetLink = data?.properties?.action_link;

    if (!resetLink) {
      return new Response(JSON.stringify(GENERIC_SUCCESS), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Send email with Resend
    await resend.emails.send({
      from: "Mechanic Raiz Pro <suporte@mechanicraizpro.com.br>",
      to: [email.trim()],
      subject: "Recuperação de Senha - Sistema para Mecânico",
      text: `Recuperação de Senha - Sistema para Mecânico

Você solicitou a recuperação da sua senha.

Clique no link abaixo ou copie e cole no seu navegador para criar uma nova senha:

${resetLink}

Se você não solicitou esta recuperação, pode ignorar este email com segurança.

Este link expira em 24 horas.

© 2025 Sistema para Mecânico. Todos os direitos reservados.`,
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
</head>
<body style="margin:0;padding:20px;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
    <div style="background:#0077B6;padding:30px;text-align:center;">
      <span style="color:#fff;font-size:24px;font-weight:bold;">🔧 Sistema para Mecânico</span>
    </div>
    <div style="padding:40px 30px;">
      <p style="color:#0E1B2A;font-size:20px;font-weight:bold;margin:0 0 20px;">Recuperação de Senha</p>
      <p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 30px;">
        Você solicitou a recuperação da sua senha. Clique no botão abaixo para criar uma nova senha:
      </p>
      <div style="text-align:center;margin:30px 0;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${resetLink}" style="height:50px;v-text-anchor:middle;width:280px;" arcsize="16%" stroke="f" fillcolor="#FF7A18">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">REDEFINIR MINHA SENHA</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <a href="${resetLink}" style="background:#FF7A18;color:#fff;padding:16px 36px;text-decoration:none;font-weight:bold;font-size:16px;border-radius:8px;display:inline-block;">REDEFINIR MINHA SENHA</a>
        <!--<![endif]-->
      </div>
      <p style="color:#888;font-size:14px;margin:30px 0 0;">Se você não solicitou esta recuperação, ignore este email.</p>
      <p style="color:#888;font-size:14px;margin:10px 0 0;">Este link expira em 24 horas.</p>
    </div>
    <div style="background:#f9f9f9;padding:20px;text-align:center;border-top:1px solid #eee;">
      <span style="color:#999;font-size:12px;">© 2025 Sistema para Mecânico</span>
    </div>
  </div>
</body>
</html>`,
    });

    // SECURITY: Log only that a reset was sent, not to whom
    console.log("Password reset email processed successfully");

    return new Response(JSON.stringify(GENERIC_SUCCESS), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in send-password-reset function");
    // SECURITY: Never expose error details to client
    return new Response(
      JSON.stringify({ error: "Erro ao processar solicitação" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
