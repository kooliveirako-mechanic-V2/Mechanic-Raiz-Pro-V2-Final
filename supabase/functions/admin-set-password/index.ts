// Edge Function: admin-set-password
// Define ou redefine a senha local de um usuário pelo email,
// PRESERVANDO providers OAuth existentes (ex.: google).
// Protegida por ADMIN_RESET_TOKEN (segredo).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminToken = Deno.env.get("ADMIN_RESET_TOKEN");
    if (!adminToken) {
      return json({ success: false, error: "ADMIN_RESET_TOKEN não configurado" }, 500);
    }

    const provided = req.headers.get("x-admin-token");
    if (provided !== adminToken) {
      return json({ success: false, error: "Token inválido" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const email: string | undefined = body.email?.toString().trim().toLowerCase();
    const newPassword: string | undefined = body.password?.toString();

    if (!email || !newPassword || newPassword.length < 8) {
      return json(
        { success: false, error: "email e password (>=8) são obrigatórios" },
        400,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Localizar usuário pelo email
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) return json({ success: false, error: listErr.message }, 500);

    const user = list.users.find(
      (u) => (u.email || "").toLowerCase() === email,
    );
    if (!user) {
      return json({ success: false, error: "Usuário não encontrado" }, 404);
    }

    const providersBefore = (user.app_metadata as any)?.providers || [
      (user.app_metadata as any)?.provider,
    ];

    // Atualiza senha. O Supabase preserva os providers OAuth existentes.
    const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(
      user.id,
      { password: newPassword, email_confirm: true },
    );
    if (updErr) return json({ success: false, error: updErr.message }, 500);

    const providersAfter = (updated.user.app_metadata as any)?.providers || [
      (updated.user.app_metadata as any)?.provider,
    ];

    return json({
      success: true,
      user_id: user.id,
      email: user.email,
      providers_before: providersBefore,
      providers_after: providersAfter,
      message:
        "Senha local definida. Login com Google e com email/senha agora funcionam no MESMO user_id.",
    });
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
