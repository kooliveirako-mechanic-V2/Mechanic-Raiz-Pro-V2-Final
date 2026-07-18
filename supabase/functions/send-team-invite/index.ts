import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const DEFAULT_BASE_URL = "https://www.mechanicraizpro.com.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { oficina_id, email, role, base_url } = body as {
      oficina_id?: string;
      email?: string;
      role?: "administrador" | "funcionario";
      base_url?: string;
    };

    // Use the origin sent by the frontend (so links go to the same domain the user is using),
    // falling back to the known published URL. Sanity-check it's a valid http(s) URL.
    let resolvedBase = DEFAULT_BASE_URL;
    if (base_url) {
      try {
        const u = new URL(base_url);
        if (u.protocol === "http:" || u.protocol === "https:") {
          resolvedBase = u.origin;
        }
      } catch {
        // ignore, keep default
      }
    }

    if (!oficina_id || !email || !role) {
      return new Response(JSON.stringify({ error: "Dados incompletos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create invite via RPC (security definer validates ownership)
    const { data: inviteData, error: inviteError } = await supabase.rpc(
      "create_team_invite",
      { _oficina_id: oficina_id, _email: email, _role: role }
    );

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = inviteData as { success: boolean; error?: string; token?: string; email?: string; user_exists?: boolean };
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch oficina name + inviter
    const { data: oficina } = await supabase
      .from("oficinas")
      .select("nome")
      .eq("id", oficina_id)
      .single();

    const { data: profile } = await supabase
      .from("profiles")
      .select("nome")
      .eq("user_id", user.id)
      .single();

    const inviteUrl = `${resolvedBase}/convite/${result.token}`;
    const oficinaNome = oficina?.nome || "a oficina";
    const inviterNome = profile?.nome || "O proprietário";
    const roleLabel = role === "administrador" ? "Administrador" : "Funcionário";

    let emailSent = false;
    if (RESEND_API_KEY) {
      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Mechanic Raiz Pro <contato@mechanicraizpro.com.br>",
            to: [result.email],
            subject: `🔧 ${inviterNome} te convidou para a equipe ${oficinaNome}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #0E1B2A;">Você foi convidado!</h2>
                <p style="font-size: 16px; color: #333;">
                  <strong>${inviterNome}</strong> está te convidando para fazer parte da equipe
                  <strong>${oficinaNome}</strong> no Mechanic Raiz Pro como <strong>${roleLabel}</strong>.
                </p>
                <div style="margin: 32px 0; text-align: center;">
                  <a href="${inviteUrl}"
                     style="background: #0077B6; color: #fff; padding: 14px 28px; border-radius: 8px;
                            text-decoration: none; font-weight: 600; display: inline-block;">
                    Aceitar convite
                  </a>
                </div>
                <p style="font-size: 14px; color: #666;">
                  Ou copie e cole este link no navegador:<br/>
                  <a href="${inviteUrl}" style="color: #0077B6;">${inviteUrl}</a>
                </p>
                <p style="font-size: 13px; color: #999; margin-top: 24px;">
                  Este convite expira em 7 dias. Se você não esperava este e-mail, pode ignorá-lo.
                </p>
              </div>
            `,
          }),
        });
        emailSent = resp.ok;
        if (!resp.ok) console.error("Resend error", await resp.text());
      } catch (e) {
        console.error("Email send failed:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        invite_url: inviteUrl,
        email_sent: emailSent,
        user_exists: result.user_exists,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
