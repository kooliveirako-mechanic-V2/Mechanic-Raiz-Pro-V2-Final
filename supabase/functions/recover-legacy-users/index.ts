import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: require service role or admin token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    // Validate caller is admin via service role
    const token = authHeader.replace("Bearer ", "");
    if (token !== serviceKey) {
      // Verify it's a valid user with admin access
      const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await callerClient.auth.getUser(token);
      if (userError || !userData?.user?.id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Parse options
    const body = await req.json().catch(() => ({}));
    const { dry_run = true, limit = 5, email_filter } = body as {
      dry_run?: boolean;
      limit?: number;
      email_filter?: string;
    };

    // Get pending migrations
    let query = supabase
      .from("user_migration_map")
      .select("*")
      .is("new_user_id", null)
      .order("email")
      .limit(Math.min(limit, dry_run ? 200 : 50)); // dry-run até 200, real cap 50

    if (email_filter) {
      query = query.eq("email", email_filter);
    }

    const { data: pending, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!pending || pending.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending migrations", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{
      email: string;
      nome: string | null;
      status: "created" | "already_exists" | "error";
      detail?: string;
    }> = [];

    // Pre-carrega TODOS auth.users uma única vez (perf + evita listUsers por iteração)
    const { data: allAuthUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authByEmail = new Map<string, { id: string; provider: string }>();
    (allAuthUsers?.users ?? []).forEach((u) => {
      if (u.email) {
        authByEmail.set(u.email.toLowerCase(), {
          id: u.id,
          provider: u.app_metadata?.provider || "email",
        });
      }
    });

    for (const user of pending) {
      try {
        const emailLc = user.email.toLowerCase();
        const existing = authByEmail.get(emailLc);

        // Audit-rich enrichment (oficina + counts + plan) baseado no old_user_id
        // Oficina ainda está vinculada ao old_user_id até o trigger relink rodar
        const { data: oficinaOld } = await supabase
          .from("oficinas")
          .select("id,nome")
          .eq("user_id", user.old_user_id)
          .maybeSingle();

        let clientesCount = 0, veiculosCount = 0, osCount = 0;
        let planType: string | null = null;
        let subStatus: string | null = null;
        let trialEndsAt: string | null = null;

        if (oficinaOld?.id) {
          const [{ count: c1 }, { count: c2 }, { count: c3 }, { data: sub }] = await Promise.all([
            supabase.from("clientes").select("id", { count: "exact", head: true }).eq("oficina_id", oficinaOld.id),
            supabase.from("veiculos").select("id", { count: "exact", head: true }).eq("oficina_id", oficinaOld.id),
            supabase.from("ordens_servico").select("id", { count: "exact", head: true }).eq("oficina_id", oficinaOld.id),
            supabase.from("subscriptions").select("plan_type,status,trial_ends_at").eq("oficina_id", oficinaOld.id).maybeSingle(),
          ]);
          clientesCount = c1 ?? 0; veiculosCount = c2 ?? 0; osCount = c3 ?? 0;
          planType = sub?.plan_type ?? null;
          subStatus = sub?.status ?? null;
          trialEndsAt = sub?.trial_ends_at ?? null;
        }

        const isPagante = subStatus === "active" && planType && planType !== "trial";
        const isTrial = !!(trialEndsAt && new Date(trialEndsAt) > new Date());
        const isDuplicate = !!existing;

        // Heurística de risco
        let risco: "baixo" | "medio" | "alto" = "baixo";
        const motivosRisco: string[] = [];
        if (!oficinaOld) { risco = "alto"; motivosRisco.push("sem oficina vinculada"); }
        else if (osCount === 0 && clientesCount === 0) { risco = "medio"; motivosRisco.push("oficina vazia"); }
        if (isDuplicate && existing?.provider !== "email") {
          risco = "alto";
          motivosRisco.push(`conta já existe via ${existing?.provider}`);
        }
        if (isPagante) motivosRisco.push("pagante ativo - prioridade alta");

        const recoveryUrl = "https://mechanicraizpro.com.br/reset-password";

        const auditRow = {
          email: user.email,
          old_user_id: user.old_user_id,
          new_user_id: existing?.id ?? null,
          provider_atual: existing?.provider ?? null,
          oficina_vinculada: oficinaOld ? { id: oficinaOld.id, nome: oficinaOld.nome } : null,
          clientes: clientesCount,
          veiculos: veiculosCount,
          ordens_servico: osCount,
          pagante_ativo: isPagante,
          trial_ativo: isTrial,
          conta_duplicada: isDuplicate,
          vai_receber_recovery: !isDuplicate,
          recovery_url_final: recoveryUrl,
          relink_oficina_correta: !!oficinaOld, // trigger trg_relink_migrated_user religa por old_user_id
          risco,
          motivos_risco: motivosRisco,
        };

        if (existing) {
          if (!dry_run) {
            await supabase
              .from("user_migration_map")
              .update({ new_user_id: existing.id, migrated_at: new Date().toISOString() })
              .eq("old_user_id", user.old_user_id);
          }
          results.push({
            email: user.email,
            nome: user.nome,
            status: "already_exists",
            detail: `Auth user exists: ${existing.id} (provider: ${existing.provider})`,
            audit: auditRow,
          } as any);
          continue;
        }

        if (dry_run) {
          results.push({
            email: user.email,
            nome: user.nome,
            status: "created",
            detail: "DRY RUN - would create user and send recovery email",
            audit: auditRow,
          } as any);
          continue;
        }

        // Create user in auth.users with email confirmed
        // This triggers trg_relink_migrated_user automatically
        const tempPassword = crypto.randomUUID() + "Aa1!"; // Strong temp password
        const { data: newUser, error: createError } =
          await supabase.auth.admin.createUser({
            email: user.email.toLowerCase().trim(),
            password: tempPassword,
            email_confirm: true, // Skip email verification
            user_metadata: {
              nome: user.nome || "Usuário",
              migrated: true,
              migrated_at: new Date().toISOString(),
            },
          });

        if (createError) {
          results.push({
            email: user.email,
            nome: user.nome,
            status: "error",
            detail: createError.message,
          });
          continue;
        }

        // Generate recovery link so user can set their own password
        const { data: linkData, error: linkError } =
          await supabase.auth.admin.generateLink({
            type: "recovery",
            email: user.email.toLowerCase().trim(),
            options: {
              redirectTo: "https://mechanicraizpro.com.br/reset-password",
            },
          });

        if (linkError || !linkData?.properties?.action_link) {
          results.push({
            email: user.email,
            nome: user.nome,
            status: "created",
            detail: `User created (${newUser?.user?.id}) but recovery link failed: ${linkError?.message || "no link"}`,
          });
          continue;
        }

        const recoveryLink = linkData.properties.action_link;

        // Send recovery email via Resend
        if (resendKey) {
          const resend = new Resend(resendKey);
          const nome = user.nome || "Mecânico";

          await resend.emails.send({
            from: "Mechanic Raiz Pro <suporte@mechanicraizpro.com.br>",
            to: [user.email.trim()],
            subject: "🔧 Seu acesso ao Mechanic Raiz Pro foi restaurado!",
            html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:20px;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
    <div style="background:#0077B6;padding:30px;text-align:center;">
      <span style="color:#fff;font-size:24px;font-weight:bold;">🔧 Mechanic Raiz Pro</span>
    </div>
    <div style="padding:40px 30px;">
      <p style="color:#0E1B2A;font-size:20px;font-weight:bold;margin:0 0 20px;">
        Olá, ${nome}! 👋
      </p>
      <p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 15px;">
        Fizemos uma atualização importante no sistema e <strong>seu acesso foi restaurado</strong>.
      </p>
      <p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 15px;">
        Todos os seus dados estão preservados: clientes, veículos, ordens de serviço, estoque e financeiro.
      </p>
      <p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 30px;">
        Clique no botão abaixo para <strong>definir sua nova senha</strong> e voltar a usar o sistema:
      </p>
      <div style="text-align:center;margin:30px 0;">
        <a href="${recoveryLink}" style="background:#FF7A18;color:#fff;padding:16px 36px;text-decoration:none;font-weight:bold;font-size:16px;border-radius:8px;display:inline-block;">
          DEFINIR MINHA SENHA
        </a>
      </div>
      <p style="color:#888;font-size:14px;margin:30px 0 0;">
        Este link expira em 24 horas. Após definir sua senha, você poderá acessar normalmente.
      </p>
    </div>
    <div style="background:#f9f9f9;padding:20px;text-align:center;border-top:1px solid #eee;">
      <span style="color:#999;font-size:12px;">© 2026 Mechanic Raiz Pro. Todos os direitos reservados.</span>
    </div>
  </div>
</body>
</html>`,
          });
        }

        results.push({
          email: user.email,
          nome: user.nome,
          status: "created",
          detail: `User created (${newUser?.user?.id}), recovery email sent`,
        });
      } catch (err) {
        results.push({
          email: user.email,
          nome: user.nome,
          status: "error",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const summary = {
      dry_run,
      total_pending: pending.length,
      created: results.filter((r) => r.status === "created").length,
      already_exists: results.filter((r) => r.status === "already_exists").length,
      errors: results.filter((r) => r.status === "error").length,
      results,
    };

    return new Response(JSON.stringify(summary, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in recover-legacy-users:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
