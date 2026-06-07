import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://mechanicraizpro.com.br";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const results: Record<string, unknown[]> = {
    abandono_pos_onboarding: [],
    os_nao_finalizada: [],
    trial_expirando: [],
    trial_expirou: [],
    resumos: [],
  };

  try {
    // =============================================
    // GARGALO 1: Criou oficina mas sem ação core (30min+)
    // =============================================
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Oficinas criadas entre 2h e 30min ago (window for trigger)
    const { data: recentOficinas } = await supabase
      .from("oficinas")
      .select("id, user_id, nome, tipo, created_at")
      .gte("created_at", twoHoursAgo)
      .lte("created_at", thirtyMinAgo);

    for (const oficina of recentOficinas || []) {
      // Check if already sent
      const { data: alreadySent } = await supabase
        .from("engagement_emails")
        .select("id")
        .eq("oficina_id", oficina.id)
        .eq("trigger_type", "abandono_pos_onboarding")
        .limit(1);

      if (alreadySent && alreadySent.length > 0) continue;

      // Check if user has any core actions (clients, vehicles, OS)
      const { count: clientCount } = await supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", oficina.id);

      const { count: osCount } = await supabase
        .from("ordens_servico")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", oficina.id);

      if ((clientCount || 0) === 0 && (osCount || 0) === 0) {
        // Get user email
        const { data: userData } = await supabase.auth.admin.getUserById(oficina.user_id);
        const email = userData?.user?.email;
        const nome = userData?.user?.user_metadata?.nome || "";

        if (email) {
          await sendEngagementEmail({
            to: email,
            nome,
            oficina: oficina.nome,
            trigger: "abandono_pos_onboarding",
            subject: `👌 ${nome ? nome.split(" ")[0] : "Ei"}, sua oficina já está criada — falta só 1 passo`,
            body: generateAbandonoEmail(nome, oficina.nome),
          });

          await supabase.from("engagement_emails").insert({
            oficina_id: oficina.id,
            user_id: oficina.user_id,
            email,
            trigger_type: "abandono_pos_onboarding",
            context_data: { clientes: 0, os: 0 },
          });

          results.abandono_pos_onboarding.push({ email, oficina: oficina.nome });
        }
      }
    }

    // =============================================
    // GARGALO 2: OS criada mas não finalizada (24h+)
    // =============================================
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: pendingOS } = await supabase
      .from("ordens_servico")
      .select("id, oficina_id, tipo_servico, created_at")
      .in("status", ["pendente", "em_andamento"])
      .gte("created_at", twoDaysAgo)
      .lte("created_at", oneDayAgo);

    const processedOficinas = new Set<string>();

    for (const os of pendingOS || []) {
      if (processedOficinas.has(os.oficina_id)) continue;
      processedOficinas.add(os.oficina_id);

      const { data: alreadySent } = await supabase
        .from("engagement_emails")
        .select("id")
        .eq("oficina_id", os.oficina_id)
        .eq("trigger_type", "os_nao_finalizada")
        .gte("sent_at", twoDaysAgo)
        .limit(1);

      if (alreadySent && alreadySent.length > 0) continue;

      // Get oficina + user info
      const { data: oficina } = await supabase
        .from("oficinas")
        .select("user_id, nome")
        .eq("id", os.oficina_id)
        .single();

      if (!oficina) continue;

      const { data: userData } = await supabase.auth.admin.getUserById(oficina.user_id);
      const email = userData?.user?.email;
      const nome = userData?.user?.user_metadata?.nome || "";

      if (email) {
        await sendEngagementEmail({
          to: email,
          nome,
          oficina: oficina.nome,
          trigger: "os_nao_finalizada",
          subject: `🔧 ${nome ? nome.split(" ")[0] : "Ei"}, sua OS está quase pronta — finalize e veja o lucro`,
          body: generateOSNaoFinalizadaEmail(nome, oficina.nome),
        });

        await supabase.from("engagement_emails").insert({
          oficina_id: os.oficina_id,
          user_id: oficina.user_id,
          email,
          trigger_type: "os_nao_finalizada",
          context_data: { os_id: os.id },
        });

        results.os_nao_finalizada.push({ email, oficina: oficina.nome });
      }
    }

    // =============================================
    // GARGALO 3: Trial expirando/expirado com uso real
    // =============================================
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // D-1: Trial expiring tomorrow
    const { data: expiringTrials } = await supabase
      .from("subscriptions")
      .select("oficina_id, trial_ends_at")
      .eq("status", "trial")
      .gte("trial_ends_at", now.toISOString())
      .lte("trial_ends_at", tomorrow);

    for (const sub of expiringTrials || []) {
      const { data: alreadySent } = await supabase
        .from("engagement_emails")
        .select("id")
        .eq("oficina_id", sub.oficina_id)
        .eq("trigger_type", "trial_expirando_com_uso")
        .limit(1);

      if (alreadySent && alreadySent.length > 0) continue;

      // Check usage
      const { count: actionCount } = await supabase
        .from("ordens_servico")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", sub.oficina_id);

      const { count: clientCount } = await supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", sub.oficina_id);

      const totalActions = (actionCount || 0) + (clientCount || 0);
      if (totalActions < 3) continue; // Only target users with real usage

      const { data: oficina } = await supabase
        .from("oficinas")
        .select("user_id, nome")
        .eq("id", sub.oficina_id)
        .single();

      if (!oficina) continue;

      const { data: userData } = await supabase.auth.admin.getUserById(oficina.user_id);
      const email = userData?.user?.email;
      const nome = userData?.user?.user_metadata?.nome || "";

      if (email) {
        await sendEngagementEmail({
          to: email,
          nome,
          oficina: oficina.nome,
          trigger: "trial_expirando",
          subject: `⚠️ ${nome ? nome.split(" ")[0] : "Ei"}, seu acesso expira amanhã — não perca seus dados`,
          body: generateTrialExpirandoEmail(nome, oficina.nome, totalActions),
        });

        await supabase.from("engagement_emails").insert({
          oficina_id: sub.oficina_id,
          user_id: oficina.user_id,
          email,
          trigger_type: "trial_expirando_com_uso",
          context_data: { actions: totalActions },
        });

        results.trial_expirando.push({ email, oficina: oficina.nome, actions: totalActions });
      }
    }

    // D+1: Trial expired yesterday with usage
    const { data: expiredTrials } = await supabase
      .from("subscriptions")
      .select("oficina_id, trial_ends_at")
      .eq("status", "trial")
      .gte("trial_ends_at", yesterday)
      .lte("trial_ends_at", now.toISOString());

    for (const sub of expiredTrials || []) {
      const { data: alreadySent } = await supabase
        .from("engagement_emails")
        .select("id")
        .eq("oficina_id", sub.oficina_id)
        .eq("trigger_type", "trial_expirou_com_uso")
        .limit(1);

      if (alreadySent && alreadySent.length > 0) continue;

      const { count: actionCount } = await supabase
        .from("ordens_servico")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", sub.oficina_id);

      const { count: clientCount } = await supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", sub.oficina_id);

      const totalActions = (actionCount || 0) + (clientCount || 0);
      if (totalActions < 3) continue;

      const { data: oficina } = await supabase
        .from("oficinas")
        .select("user_id, nome")
        .eq("id", sub.oficina_id)
        .single();

      if (!oficina) continue;

      const { data: userData } = await supabase.auth.admin.getUserById(oficina.user_id);
      const email = userData?.user?.email;
      const nome = userData?.user?.user_metadata?.nome || "";

      if (email) {
        await sendEngagementEmail({
          to: email,
          nome,
          oficina: oficina.nome,
          trigger: "trial_expirou",
          subject: `😔 ${nome ? nome.split(" ")[0] : "Ei"}, seu trial acabou — mas sua oficina ainda está aqui`,
          body: generateTrialExpirouEmail(nome, oficina.nome, totalActions),
        });

        await supabase.from("engagement_emails").insert({
          oficina_id: sub.oficina_id,
          user_id: oficina.user_id,
          email,
          trigger_type: "trial_expirou_com_uso",
          context_data: { actions: totalActions },
        });

        results.trial_expirou.push({ email, oficina: oficina.nome, actions: totalActions });
      }
    }

    // =============================================
    // GARGALO 4: Valor email (D+2/D+3 sem OS criada)
    // =============================================
    const twoDaysAgoDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const threeDaysAgoDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: valorOficinas } = await supabase
      .from("oficinas")
      .select("id, user_id, nome, tipo, created_at")
      .gte("created_at", threeDaysAgoDate)
      .lte("created_at", twoDaysAgoDate);

    for (const oficina of valorOficinas || []) {
      const { data: alreadySent } = await supabase
        .from("engagement_emails")
        .select("id")
        .eq("oficina_id", oficina.id)
        .eq("trigger_type", "valor_sem_os")
        .limit(1);

      if (alreadySent && alreadySent.length > 0) continue;

      const { count: osCount } = await supabase
        .from("ordens_servico")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", oficina.id);

      if ((osCount || 0) > 0) continue; // Already has OS, skip

      const { data: userData } = await supabase.auth.admin.getUserById(oficina.user_id);
      const email = userData?.user?.email;
      const nome = userData?.user?.user_metadata?.nome || "";

      if (email) {
        await sendEngagementEmail({
          to: email,
          nome,
          oficina: oficina.nome,
          trigger: "valor_sem_os",
          subject: `💰 ${nome ? nome.split(" ")[0] : "Ei"}, oficinas como a ${oficina.nome} faturam 30% a mais com controle`,
          body: generateValorEmail(nome, oficina.nome, oficina.tipo),
        });

        await supabase.from("engagement_emails").insert({
          oficina_id: oficina.id,
          user_id: oficina.user_id,
          email,
          trigger_type: "valor_sem_os",
        });

        results.resumos.push({ type: "valor_sem_os", email, oficina: oficina.nome });
      }
    }

    // =============================================
    // GARGALO 5: Dicas email (D+5/D+7 se criou OS)
    // =============================================
    const fiveDaysAgoDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgoDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: dicasOficinas } = await supabase
      .from("oficinas")
      .select("id, user_id, nome, tipo, created_at")
      .gte("created_at", sevenDaysAgoDate)
      .lte("created_at", fiveDaysAgoDate);

    for (const oficina of dicasOficinas || []) {
      const { data: alreadySent } = await supabase
        .from("engagement_emails")
        .select("id")
        .eq("oficina_id", oficina.id)
        .eq("trigger_type", "dicas_com_uso")
        .limit(1);

      if (alreadySent && alreadySent.length > 0) continue;

      const { count: osCount } = await supabase
        .from("ordens_servico")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", oficina.id);

      if ((osCount || 0) === 0) continue; // No OS, skip

      const { data: userData } = await supabase.auth.admin.getUserById(oficina.user_id);
      const email = userData?.user?.email;
      const nome = userData?.user?.user_metadata?.nome || "";

      if (email) {
        await sendEngagementEmail({
          to: email,
          nome,
          oficina: oficina.nome,
          trigger: "dicas_com_uso",
          subject: `🚀 ${nome ? nome.split(" ")[0] : "Ei"}, 3 dicas pra lucrar mais com o Mechanic Raiz Pro`,
          body: generateDicasEmail(nome, oficina.nome),
        });

        await supabase.from("engagement_emails").insert({
          oficina_id: oficina.id,
          user_id: oficina.user_id,
          email,
          trigger_type: "dicas_com_uso",
        });

        results.resumos.push({ type: "dicas_com_uso", email, oficina: oficina.nome });
      }
    }

    // =============================================
    // MELHORIA EXTRA: Lead session summaries
    // =============================================
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentAllOficinas } = await supabase
      .from("oficinas")
      .select("id, user_id, nome, tipo, created_at")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false });

    for (const oficina of recentAllOficinas || []) {
      const { count: clientes } = await supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", oficina.id);

      const { count: veiculos } = await supabase
        .from("veiculos")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", oficina.id);

      const { count: osCriadas } = await supabase
        .from("ordens_servico")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", oficina.id);

      const { count: osFinalizadas } = await supabase
        .from("ordens_servico")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", oficina.id)
        .eq("status", "finalizado");

      const { count: financeiro } = await supabase
        .from("financeiro")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", oficina.id);

      const { count: orcamentos } = await supabase
        .from("orcamentos")
        .select("id", { count: "exact", head: true })
        .eq("oficina_id", oficina.id);

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, trial_ends_at, plan_type")
        .eq("oficina_id", oficina.id)
        .single();

      const { data: userData } = await supabase.auth.admin.getUserById(oficina.user_id);

      const totalActions = (clientes || 0) + (veiculos || 0) + (osCriadas || 0) + (financeiro || 0) + (orcamentos || 0);

      // Build human-readable summary
      const actions: string[] = [];
      if (clientes) actions.push(`${clientes} cliente(s)`);
      if (veiculos) actions.push(`${veiculos} veículo(s)`);
      if (osCriadas) actions.push(`${osCriadas} OS (${osFinalizadas} finalizada(s))`);
      if (financeiro) actions.push(`${financeiro} lançamento(s) financeiro(s)`);
      if (orcamentos) actions.push(`${orcamentos} orçamento(s)`);

      const trialStatus = sub?.status === "trial"
        ? sub.trial_ends_at
          ? new Date(sub.trial_ends_at) > now
            ? `Trial ativo (expira ${new Date(sub.trial_ends_at).toLocaleDateString("pt-BR")})`
            : `Trial EXPIRADO em ${new Date(sub.trial_ends_at).toLocaleDateString("pt-BR")}`
          : "Trial ativo"
        : sub?.status === "active"
        ? `Assinante ${sub.plan_type}`
        : sub?.status || "Sem assinatura";

      results.resumos.push({
        oficina: oficina.nome,
        tipo: oficina.tipo,
        email: userData?.user?.email,
        nome: userData?.user?.user_metadata?.nome,
        criado_em: oficina.created_at,
        status_trial: trialStatus,
        total_acoes: totalActions,
        resumo: actions.length > 0 ? `Criou ${actions.join(", ")}` : "Nenhuma ação após criar oficina",
        whatsapp_msg: totalActions > 0
          ? `Oi ${userData?.user?.user_metadata?.nome?.split(" ")[0] || ""}! Vi que você já cadastrou ${actions.join(", ")} no Mechanic Raiz Pro. ${osCriadas && !osFinalizadas ? "Vi que tem OS aberta — quando finalizar, o financeiro já organiza tudo automaticamente!" : "Como está sendo a experiência?"} Precisa de ajuda com alguma coisa?`
          : `Oi ${userData?.user?.user_metadata?.nome?.split(" ")[0] || ""}! Vi que você criou sua oficina "${oficina.nome}" no Mechanic Raiz Pro. O próximo passo leva menos de 1 minuto: cadastrar o primeiro cliente. Quer que eu te mostre?`,
      });
    }

    console.log(`✅ Engagement check complete:`, JSON.stringify({
      abandono: results.abandono_pos_onboarding.length,
      os_pendente: results.os_nao_finalizada.length,
      trial_expirando: results.trial_expirando.length,
      trial_expirou: results.trial_expirou.length,
      resumos: results.resumos.length,
    }));

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Engagement check error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// =============================================
// EMAIL SENDING
// =============================================
async function sendEngagementEmail(params: {
  to: string;
  nome: string;
  oficina: string;
  trigger: string;
  subject: string;
  body: string;
}) {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Mechanic Raiz Pro <suporte@mechanicraizpro.com.br>",
      to: [params.to],
      subject: params.subject,
      html: params.body,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`Erro envio ${params.trigger} para ${params.to}:`, errorText);
  } else {
    console.log(`✅ Email ${params.trigger} enviado para ${params.to}`);
  }

  // Rate limit protection
  await new Promise((r) => setTimeout(r, 500));
}

// =============================================
// EMAIL TEMPLATES
// =============================================
function emailWrapper(headerBg: string, headerContent: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 20px;">
<tr><td align="center">
<table width="100%" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
<tr><td style="background:${headerBg};padding:30px;text-align:center;">${headerContent}</td></tr>
<tr><td style="padding:35px 30px;">${bodyContent}</td></tr>
<tr><td style="background-color:#f8f9fa;padding:20px 30px;text-align:center;border-top:1px solid #eee;">
<p style="color:#6B7280;font-size:13px;margin:0;">Precisa de ajuda? Estou aqui!</p>
<p style="margin:10px 0 0 0;"><a href="https://wa.me/5511950891497" style="color:#0077B6;text-decoration:none;font-weight:500;">📱 Chamar no WhatsApp</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

function generateAbandonoEmail(nome: string, oficina: string): string {
  const p = nome ? nome.split(" ")[0] : "Ei";
  return emailWrapper(
    "linear-gradient(135deg, #0077B6 0%, #00A8E8 100%)",
    `<h1 style="color:#fff;margin:0;font-size:22px;">👌 ${p}, sua oficina tá criada!</h1>`,
    `<p style="color:#4a4a4a;font-size:16px;line-height:1.7;margin:0 0 15px;">
       Falta só <strong>1 coisa</strong>: cadastrar seu primeiro cliente.
     </p>
     <p style="color:#4a4a4a;font-size:15px;line-height:1.7;margin:0 0 20px;">
       Depois disso, é só abrir a OS e o sistema já cuida do financeiro pra você.
     </p>
     <div style="text-align:center;margin:25px 0;">
       <a href="${BASE_URL}/auth" style="display:inline-block;background:linear-gradient(135deg,#FF7A00,#FF9A40);color:#fff;text-decoration:none;padding:15px 35px;border-radius:8px;font-size:16px;font-weight:bold;box-shadow:0 4px 12px rgba(255,122,0,0.3);">
         Cadastrar primeiro cliente →
       </a>
     </div>`
  );
}

function generateOSNaoFinalizadaEmail(nome: string, oficina: string): string {
  const p = nome ? nome.split(" ")[0] : "Ei";
  return emailWrapper(
    "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
    `<h1 style="color:#fff;margin:0;font-size:22px;">🔧 Tem OS aberta, ${p}!</h1>`,
    `<p style="color:#4a4a4a;font-size:16px;line-height:1.7;margin:0 0 15px;">
       Quando você finaliza a OS, o sistema calcula o lucro e organiza o financeiro <strong>sozinho</strong>.
     </p>
     <p style="color:#4a4a4a;font-size:15px;line-height:1.7;margin:0 0 20px;">
       É aí que você vê o valor real do controle.
     </p>
     <div style="text-align:center;margin:25px 0;">
       <a href="${BASE_URL}/servicos" style="display:inline-block;background:linear-gradient(135deg,#FF7A00,#FF9A40);color:#fff;text-decoration:none;padding:15px 35px;border-radius:8px;font-size:16px;font-weight:bold;box-shadow:0 4px 12px rgba(255,122,0,0.3);">
         Finalizar minha OS →
       </a>
     </div>`
  );
}

function generateTrialExpirandoEmail(nome: string, oficina: string, actions: number): string {
  const p = nome ? nome.split(" ")[0] : "Ei";
  return emailWrapper(
    "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)",
    `<h1 style="color:#fff;margin:0;font-size:22px;">⚠️ Expira amanhã, ${p}!</h1>`,
    `<p style="color:#4a4a4a;font-size:16px;line-height:1.7;margin:0 0 15px;">
       Você já tem <strong>${actions} registros</strong> na ${oficina}. Amanhã perde o acesso.
     </p>
     <p style="color:#059669;font-size:17px;font-weight:bold;text-align:center;margin:20px 0;">
       A partir de R$ 47,90/mês — menos que 2 serviços
     </p>
     <div style="text-align:center;margin:25px 0;">
       <a href="${BASE_URL}/upgrade" style="display:inline-block;background:linear-gradient(135deg,#FF7A00,#FF9A40);color:#fff;text-decoration:none;padding:16px 45px;border-radius:8px;font-size:17px;font-weight:bold;box-shadow:0 4px 15px rgba(255,122,0,0.4);">
         GARANTIR MEU ACESSO →
       </a>
     </div>`
  );
}

function generateTrialExpirouEmail(nome: string, oficina: string, actions: number): string {
  const p = nome ? nome.split(" ")[0] : "Ei";
  return emailWrapper(
    "linear-gradient(135deg, #6B7280 0%, #4B5563 100%)",
    `<h1 style="color:#fff;margin:0;font-size:22px;">😔 Trial acabou, ${p}</h1>`,
    `<p style="color:#4a4a4a;font-size:16px;line-height:1.7;margin:0 0 15px;">
       Seus <strong>${actions} registros</strong> da ${oficina} tão salvos. Reativa e volta tudo como estava.
     </p>
     <div style="text-align:center;margin:25px 0;">
       <a href="${BASE_URL}/upgrade" style="display:inline-block;background:linear-gradient(135deg,#0077B6,#00A8E8);color:#fff;text-decoration:none;padding:15px 40px;border-radius:8px;font-size:16px;font-weight:bold;">
         Reativar acesso →
       </a>
     </div>
     <p style="color:#888;font-size:13px;text-align:center;">A partir de R$ 47,90/mês • Cancele quando quiser</p>`
  );
}

function generateValorEmail(nome: string, oficina: string, tipo: string): string {
  const p = nome ? nome.split(" ")[0] : "Ei";
  const dor = tipo === "moto"
    ? "Oficina de moto que controla peças e garantias fatura R$ 2.000/mês a mais."
    : tipo === "auto_eletrica"
    ? "Diagnóstico bem documentado = 40% a mais no serviço. Cliente paga pelo profissionalismo."
    : "Oficina organizada reduz retrabalho em 60% e aumenta ticket médio.";

  return emailWrapper(
    "linear-gradient(135deg, #10B981 0%, #059669 100%)",
    `<h1 style="color:#fff;margin:0;font-size:22px;">💰 Quanto cê perde sem controle, ${p}?</h1>`,
    `<p style="color:#4a4a4a;font-size:16px;line-height:1.7;margin:0 0 15px;">
       ${dor}
     </p>
     <p style="color:#4a4a4a;font-size:15px;line-height:1.7;margin:0 0 20px;">
       Sua ${oficina} tá pronta. <strong>Cliente → Veículo → OS.</strong> 2 minutos e o financeiro já funciona.
     </p>
     <div style="text-align:center;margin:25px 0;">
       <a href="${BASE_URL}/auth" style="display:inline-block;background:linear-gradient(135deg,#FF7A00,#FF9A40);color:#fff;text-decoration:none;padding:15px 35px;border-radius:8px;font-size:16px;font-weight:bold;box-shadow:0 4px 12px rgba(255,122,0,0.3);">
         Criar minha primeira OS →
       </a>
     </div>`
  );
}

function generateDicasEmail(nome: string, oficina: string): string {
  const p = nome ? nome.split(" ")[0] : "Ei";
  return emailWrapper(
    "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
    `<h1 style="color:#fff;margin:0;font-size:22px;">🚀 3 dicas rápidas, ${p}!</h1>`,
    `<p style="color:#4a4a4a;font-size:15px;line-height:1.7;margin:0 0 20px;">
       Você já tá usando o sistema. Agora tira o máximo:
     </p>
     <div style="margin:0 0 12px;">
       <p style="color:#1a1a1a;font-size:15px;margin:0;font-weight:bold;">1️⃣ Coloca o custo da peça</p>
       <p style="color:#4a4a4a;font-size:14px;margin:4px 0 0;">O sistema calcula seu lucro real. Muita oficina descobre que cobra menos do que deveria.</p>
     </div>
     <div style="margin:0 0 12px;">
       <p style="color:#1a1a1a;font-size:15px;margin:0;font-weight:bold;">2️⃣ Cadastra as peças no estoque</p>
       <p style="color:#4a4a4a;font-size:14px;margin:4px 0 0;">Finalizou a OS? Estoque baixa sozinho. Nunca mais esquece de comprar.</p>
     </div>
     <div style="margin:0 0 12px;">
       <p style="color:#1a1a1a;font-size:15px;margin:0;font-weight:bold;">3️⃣ Manda a OS pro cliente no WhatsApp</p>
       <p style="color:#4a4a4a;font-size:14px;margin:4px 0 0;">Clica em "Compartilhar" e envia direto. Profissionalismo que fideliza.</p>
     </div>
     <div style="text-align:center;margin:25px 0;">
       <a href="${BASE_URL}/auth" style="display:inline-block;background:linear-gradient(135deg,#8B5CF6,#7C3AED);color:#fff;text-decoration:none;padding:15px 35px;border-radius:8px;font-size:16px;font-weight:bold;">
         Acessar minha oficina →
       </a>
     </div>`
  );
}
