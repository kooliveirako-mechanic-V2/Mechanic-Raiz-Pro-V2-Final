import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TrialUser {
  oficina_id: string;
  oficina_nome: string;
  email: string;
  nome: string;
  tipo: string;
  dias_no_trial: number;
  os_finalizadas: number;
  total_clientes: number;
  faturamento_total: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 Iniciando envio de emails do trial...");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Buscar usuários em trial nos dias certos
    const { data: trialUsers, error: queryError } = await supabase.rpc("get_trial_email_recipients");

    if (queryError) {
      console.error("Erro ao buscar usuários do trial:", queryError);

      // Fallback: query direta
      const users = await getTrialUsersDirectly(supabase);
      if (!users.length) {
        return new Response(
          JSON.stringify({ success: true, message: "Nenhum usuário elegível hoje", enviados: 0 }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      return await processUsers(supabase, users);
    }

    if (!trialUsers?.length) {
      console.log("📭 Nenhum usuário elegível para email hoje");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum usuário elegível hoje", enviados: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return await processUsers(supabase, trialUsers);
  } catch (error: any) {
    console.error("Erro geral:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

async function getTrialUsersDirectly(supabase: any): Promise<TrialUser[]> {
  // Get subscriptions in trial
  const { data: subs, error: subsError } = await supabase
    .from("subscriptions")
    .select("oficina_id, created_at, trial_ends_at")
    .eq("status", "trial")
    .gt("trial_ends_at", new Date().toISOString());

  if (subsError || !subs?.length) {
    console.log("Nenhuma subscription em trial encontrada");
    return [];
  }

  const results: TrialUser[] = [];

  for (const sub of subs) {
    const diasNoTrial = Math.floor(
      (Date.now() - new Date(sub.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Apenas nos dias corretos: 0, 3, 7, 12, 14
    if (![0, 3, 7, 12, 14].includes(diasNoTrial)) continue;

    const emailType = getEmailTypeForDay(diasNoTrial);

    // Verificar se já enviou
    const { data: alreadySent } = await supabase
      .from("trial_email_logs")
      .select("id")
      .eq("oficina_id", sub.oficina_id)
      .eq("email_type", emailType)
      .maybeSingle();

    if (alreadySent) continue;

    // Buscar dados da oficina
    const { data: oficina } = await supabase
      .from("oficinas")
      .select("id, nome, tipo, user_id")
      .eq("id", sub.oficina_id)
      .single();

    if (!oficina) continue;

    // Buscar email do user
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) continue;

    const user = users?.find((u: any) => u.id === oficina.user_id);
    if (!user?.email) continue;

    // Buscar métricas
    const { count: osCount } = await supabase
      .from("ordens_servico")
      .select("id", { count: "exact", head: true })
      .eq("oficina_id", sub.oficina_id)
      .eq("status", "finalizado");

    const { count: clientCount } = await supabase
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .eq("oficina_id", sub.oficina_id);

    const { data: finData } = await supabase
      .from("financeiro")
      .select("valor")
      .eq("oficina_id", sub.oficina_id)
      .eq("tipo", "entrada");

    const faturamento = finData?.reduce((sum: number, f: any) => sum + (f.valor || 0), 0) || 0;

    results.push({
      oficina_id: oficina.id,
      oficina_nome: oficina.nome,
      email: user.email,
      nome: user.user_metadata?.nome || user.email.split("@")[0],
      tipo: oficina.tipo,
      dias_no_trial: diasNoTrial,
      os_finalizadas: osCount || 0,
      total_clientes: clientCount || 0,
      faturamento_total: faturamento,
    });
  }

  return results;
}

function getEmailTypeForDay(day: number): string {
  switch (day) {
    case 0: return "trial_dia_0_boasvindas";
    case 3: return "trial_dia_3_valor";
    case 7: return "trial_dia_7_prova_social";
    case 12: return "trial_dia_12_urgencia";
    case 14: return "trial_dia_14_ultimo_dia";
    default: return `trial_dia_${day}`;
  }
}

async function processUsers(supabase: any, users: TrialUser[]): Promise<Response> {
  let successCount = 0;
  let errorCount = 0;
  const results: any[] = [];

  for (const user of users) {
    const emailType = getEmailTypeForDay(user.dias_no_trial);

    // Double-check: já enviou?
    const { data: alreadySent } = await supabase
      .from("trial_email_logs")
      .select("id")
      .eq("oficina_id", user.oficina_id)
      .eq("email_type", emailType)
      .maybeSingle();

    if (alreadySent) {
      console.log(`⏭️ Email ${emailType} já enviado para ${user.email}`);
      continue;
    }

    const { subject, html } = generateEmail(user);

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Mechanic Raiz Pro <suporte@mechanicraizpro.com.br>",
          to: [user.email],
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`❌ Erro ao enviar ${emailType} para ${user.email}:`, errorText);
        results.push({ email: user.email, type: emailType, success: false, error: errorText });
        errorCount++;
      } else {
        console.log(`✅ ${emailType} enviado para ${user.email}`);

        // Registrar envio
        await supabase.from("trial_email_logs").insert({
          oficina_id: user.oficina_id,
          user_id: user.email, // stored as reference
          email: user.email,
          email_type: emailType,
        });

        results.push({ email: user.email, type: emailType, success: true });
        successCount++;
      }

      // Rate limit: 600ms entre envios
      await new Promise((resolve) => setTimeout(resolve, 600));
    } catch (err: any) {
      console.error(`❌ Erro ao enviar para ${user.email}:`, err);
      results.push({ email: user.email, type: emailType, success: false, error: err.message });
      errorCount++;
    }
  }

  console.log(`\n📧 Resumo: ✅ ${successCount} enviados | ❌ ${errorCount} erros`);

  return new Response(
    JSON.stringify({ success: true, enviados: successCount, erros: errorCount, results }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
}

// ===== EMAIL GENERATION =====

function generateEmail(user: TrialUser): { subject: string; html: string } {
  const primeiroNome = user.nome.split(" ")[0];

  switch (user.dias_no_trial) {
    case 0:
      return emailDia0(primeiroNome, user);
    case 3:
      return emailDia3(primeiroNome, user);
    case 7:
      return emailDia7(primeiroNome, user);
    case 12:
      return emailDia12(primeiroNome, user);
    case 14:
      return emailDia14(primeiroNome, user);
    default:
      return emailDia0(primeiroNome, user);
  }
}

function wrapEmail(headerBg: string, headerContent: string, bodyContent: string, footerContent?: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 20px;">
<tr><td align="center">
<table width="100%" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.12);">
<tr><td style="background:${headerBg};padding:35px 30px;text-align:center;">
${headerContent}
</td></tr>
<tr><td style="padding:35px 30px;">
${bodyContent}
</td></tr>
<tr><td style="background-color:#1E293B;padding:25px 30px;text-align:center;">
${footerContent || `
<p style="color:rgba(255,255,255,0.7);font-size:13px;margin:0 0 10px 0;">Precisa de ajuda? Estamos aqui!</p>
<a href="https://wa.me/5511950891497?text=Oi! Preciso de ajuda com o Mechanic Raiz Pro" style="display:inline-block;background:#25D366;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:500;">📱 Chamar no WhatsApp</a>
<p style="color:rgba(255,255,255,0.4);font-size:11px;margin:15px 0 0 0;">© 2026 Mechanic Raiz Pro — Sistema de Gestão para Oficinas</p>
`}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function ctaButton(text: string, url: string, bg = "linear-gradient(135deg, #FF7A00 0%, #FF9A40 100%)"): string {
  return `<div style="text-align:center;margin:30px 0;">
<a href="${url}" style="display:inline-block;background:${bg};color:#ffffff;text-decoration:none;padding:18px 50px;border-radius:12px;font-size:18px;font-weight:bold;box-shadow:0 6px 25px rgba(255,122,0,0.4);">
${text}
</a>
</div>`;
}

// ===== EMAIL DIA 0 — BOAS-VINDAS =====
function emailDia0(nome: string, user: TrialUser): { subject: string; html: string } {
  return {
    subject: `🔧 ${nome}, sua oficina agora tem um sistema. Veja por onde começar.`,
    html: wrapEmail(
      "linear-gradient(135deg, #0077B6 0%, #00A8E8 50%, #10B981 100%)",
      `<div style="font-size:50px;margin-bottom:8px;">🎉</div>
       <h1 style="color:#ffffff;margin:0;font-size:26px;text-shadow:0 2px 4px rgba(0,0,0,0.2);">Bem-vindo, ${nome}!</h1>
       <p style="color:rgba(255,255,255,0.95);margin:12px 0 0;font-size:17px;">Sua conta do Mechanic Raiz Pro está pronta</p>`,
      `<p style="color:#1a1a1a;font-size:17px;line-height:1.8;margin:0 0 20px;">
        Oi ${nome}! 👋
       </p>
       <p style="color:#374151;font-size:16px;line-height:1.8;margin:0 0 20px;">
        Para aproveitar os <strong>14 dias grátis</strong> ao máximo, comece por aqui:
       </p>
       <div style="background:#F0FDF4;border:2px solid #10B981;border-radius:12px;padding:20px;margin:20px 0;">
        <p style="color:#059669;font-size:16px;margin:0;font-weight:600;">
          👉 Crie sua primeira Ordem de Serviço
        </p>
        <p style="color:#374151;font-size:14px;margin:8px 0 0;">
          Leva menos de 2 minutos. Você só precisa do nome do cliente e do tipo de serviço.
        </p>
       </div>
       ${ctaButton("CRIAR MINHA PRIMEIRA OS 🚀", "https://mechanicraizpro.com.br/servicos")}
       <p style="color:#6B7280;font-size:14px;text-align:center;margin:20px 0 0;">
        Qualquer dúvida, é só responder esse email.
       </p>
       <div style="background:#FEF3C7;border-radius:8px;padding:15px;margin-top:20px;text-align:center;">
        <p style="color:#92400E;font-size:14px;margin:0;">
          💡 <strong>P.S:</strong> Você não precisa de treinamento.<br>Se sabe usar WhatsApp, sabe usar o sistema.
        </p>
       </div>`
    ),
  };
}

// ===== EMAIL DIA 3 — DICA DE VALOR =====
function emailDia3(nome: string, user: TrialUser): { subject: string; html: string } {
  const criouOS = user.os_finalizadas > 0;

  if (criouOS) {
    return {
      subject: `${nome}, você já criou ${user.os_finalizadas} OS. Agora veja como cobrar mais.`,
      html: wrapEmail(
        "linear-gradient(135deg, #10B981 0%, #059669 100%)",
        `<div style="font-size:50px;margin-bottom:8px;">📈</div>
         <h1 style="color:#ffffff;margin:0;font-size:24px;">${nome}, que ótimo!</h1>
         <p style="color:rgba(255,255,255,0.95);margin:10px 0 0;font-size:16px;">Você já está usando o sistema 💪</p>`,
        `<p style="color:#1a1a1a;font-size:16px;line-height:1.8;margin:0 0 20px;">
          Agora um hack rápido pra você lucrar mais:
         </p>
         <div style="background:#EFF6FF;border-left:4px solid #3B82F6;padding:20px;border-radius:8px;margin:20px 0;">
          <p style="color:#1E40AF;font-size:15px;margin:0;">
            💡 <strong>Sabia que oficinas que controlam o custo das peças cobram em média 23% a mais por serviço?</strong>
          </p>
         </div>
         <p style="color:#374151;font-size:16px;line-height:1.8;margin:20px 0;">
          No Mechanic Raiz Pro, é só cadastrar o custo de compra das peças no estoque — o sistema mostra automaticamente quanto você está lucrando em cada OS.
         </p>
         ${ctaButton("CADASTRAR MINHAS PEÇAS 📦", "https://mechanicraizpro.com.br/estoque", "linear-gradient(135deg, #0077B6 0%, #00A8E8 100%)")}`
      ),
    };
  }

  return {
    subject: `${nome}, sua oficina está esperando por você.`,
    html: wrapEmail(
      "linear-gradient(135deg, #0077B6 0%, #00A8E8 100%)",
      `<div style="font-size:50px;margin-bottom:8px;">👋</div>
       <h1 style="color:#ffffff;margin:0;font-size:24px;">${nome}, tudo bem?</h1>`,
      `<p style="color:#1a1a1a;font-size:16px;line-height:1.8;margin:0 0 20px;">
        Vi que você ainda não criou nenhuma OS.
       </p>
       <p style="color:#374151;font-size:16px;line-height:1.8;margin:0 0 5px;">Não precisa configurar nada antes.</p>
       <p style="color:#374151;font-size:16px;line-height:1.8;margin:0 0 5px;">Não precisa cadastrar peças.</p>
       <p style="color:#374151;font-size:16px;line-height:1.8;margin:0 0 20px;">Não precisa preencher tudo.</p>
       <div style="background:#F0FDF4;border:2px solid #10B981;border-radius:12px;padding:20px;margin:20px 0;">
        <p style="color:#059669;font-size:16px;margin:0;">
          Só abre o app, clica em <strong>"Nova OS Rápida"</strong> e coloca o nome do primeiro cliente. Isso já é suficiente para começar.
        </p>
       </div>
       ${ctaButton("CRIAR MINHA PRIMEIRA OS 🚀", "https://mechanicraizpro.com.br/servicos")}`
    ),
  };
}

// ===== EMAIL DIA 7 — PROVA SOCIAL =====
function emailDia7(nome: string, user: TrialUser): { subject: string; html: string } {
  return {
    subject: `Como a Oficina Silva faturou R$4.200 no primeiro mês com o sistema`,
    html: wrapEmail(
      "linear-gradient(135deg, #0E1B2A 0%, #1E3A5F 100%)",
      `<div style="font-size:50px;margin-bottom:8px;">💰</div>
       <h1 style="color:#ffffff;margin:0;font-size:24px;">Metade do trial, ${nome}!</h1>
       <p style="color:rgba(255,255,255,0.9);margin:10px 0 0;font-size:16px;">Você ainda tem 7 dias de teste</p>`,
      `<p style="color:#1a1a1a;font-size:16px;line-height:1.8;margin:0 0 25px;">
        Deixa eu te contar o que aconteceu com o João, dono da Oficina Silva em Campinas:
       </p>
       <div style="background:#F8FAFC;border-radius:12px;padding:25px;margin:20px 0;border:1px solid #E2E8F0;">
        <p style="color:#0F172A;font-size:18px;font-style:italic;line-height:1.7;margin:0;">
          "Eu usava caderno. No primeiro mês com o sistema, percebi que estava cobrando errado em 30% das OS. Corrigi isso e faturei <strong>R$4.200 a mais</strong>."
        </p>
        <p style="color:#64748B;font-size:14px;margin:15px 0 0;font-style:normal;">
          — João Silva, Oficina Silva, Campinas/SP
        </p>
       </div>
       <p style="color:#374151;font-size:16px;line-height:1.8;margin:20px 0;">
        Isso não é propaganda. É o que acontece quando você para de fazer gestão de cabeça.
       </p>
       ${ctaButton("CONTINUAR USANDO O SISTEMA →", "https://mechanicraizpro.com.br/auth", "linear-gradient(135deg, #0077B6 0%, #00A8E8 100%)")}`
    ),
  };
}

// ===== EMAIL DIA 12 — URGÊNCIA + OFERTA =====
function emailDia12(nome: string, user: TrialUser): { subject: string; html: string } {
  const faturamentoFormatado = user.faturamento_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return {
    subject: `${nome}, faltam 2 dias. Aqui está o que você já conquistou.`,
    html: wrapEmail(
      "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
      `<div style="font-size:50px;margin-bottom:8px;">⏰</div>
       <h1 style="color:#ffffff;margin:0;font-size:24px;">Faltam 2 dias, ${nome}!</h1>
       <p style="color:rgba(255,255,255,0.95);margin:10px 0 0;font-size:16px;">Seu período de teste termina em breve</p>`,
      `<p style="color:#1a1a1a;font-size:16px;line-height:1.8;margin:0 0 25px;">
        Olha o que você já fez com o Mechanic Raiz Pro:
       </p>
       <div style="background:linear-gradient(135deg,#F0FDF4 0%,#ECFDF5 100%);border:2px solid #10B981;border-radius:12px;padding:25px;margin:20px 0;">
        <p style="color:#059669;font-size:16px;line-height:2.2;margin:0;">
          ✅ <strong>${user.os_finalizadas}</strong> ordens de serviço finalizadas<br>
          ✅ <strong>${user.total_clientes}</strong> clientes cadastrados<br>
          ✅ <strong>${faturamentoFormatado}</strong> em faturamento registrado
        </p>
       </div>
       <div style="background:#FEF3C7;border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
        <p style="color:#92400E;font-size:16px;margin:0;font-weight:600;">
          🎁 Assine hoje e ganhe <strong>20% de desconto</strong> no primeiro mês!
        </p>
        <p style="color:#92400E;font-size:14px;margin:8px 0 0;">
          Use o cupom: <strong style="background:#FDE68A;padding:3px 10px;border-radius:4px;">MECANICO20</strong>
        </p>
       </div>
       <p style="color:#DC2626;font-size:14px;text-align:center;margin:0 0 5px;font-weight:600;">
        ⚠️ Se você parar agora, perde acesso a tudo isso.
       </p>
       ${ctaButton("QUERO CONTINUAR COM DESCONTO 🎁", "https://mechanicraizpro.com.br/upgrade?cupom=MECANICO20")}
       <p style="color:#6B7280;font-size:13px;text-align:center;margin:15px 0 0;">
        O desconto expira junto com seu trial.
       </p>`
    ),
  };
}

// ===== EMAIL DIA 14 — ÚLTIMO DIA =====
function emailDia14(nome: string, user: TrialUser): { subject: string; html: string } {
  const valorPlano = getValorPlano(user.tipo);

  return {
    subject: `${nome}, sua conta expira hoje à meia-noite.`,
    html: wrapEmail(
      "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)",
      `<div style="font-size:50px;margin-bottom:8px;">🚨</div>
       <h1 style="color:#ffffff;margin:0;font-size:26px;">ÚLTIMO DIA, ${nome}!</h1>
       <p style="color:rgba(255,255,255,0.95);margin:10px 0 0;font-size:18px;">Sua conta expira hoje à meia-noite</p>`,
      `<p style="color:#1a1a1a;font-size:17px;line-height:1.8;margin:0 0 20px;">
        ${nome}, hoje é o último dia do seu trial.
       </p>
       <div style="background:#FEF2F2;border:2px solid #DC2626;border-radius:12px;padding:25px;margin:20px 0;">
        <p style="color:#991B1B;font-size:16px;line-height:2;margin:0;">
          Você criou <strong>${user.os_finalizadas} OS</strong> e atendeu <strong>${user.total_clientes} clientes</strong>.<br>
          <strong>Tudo isso some à meia-noite se você não assinar.</strong>
        </p>
       </div>
       <p style="color:#374151;font-size:16px;line-height:1.8;margin:20px 0;">
        Não começa do zero. Não perde os dados.<br>
        Só continua de onde parou.
       </p>
       <div style="background:#F0FDF4;border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
        <p style="color:#059669;font-size:18px;margin:0;font-weight:600;">
          O plano mais simples é <strong>${valorPlano}/mês</strong>
        </p>
        <p style="color:#059669;font-size:14px;margin:8px 0 0;">
          Menos do que uma troca de óleo 🔧
        </p>
       </div>
       ${ctaButton("GARANTIR MINHA CONTA AGORA 🔒", "https://mechanicraizpro.com.br/upgrade")}
       <p style="color:#6B7280;font-size:14px;text-align:center;margin:20px 0 0;">
        Se tiver alguma dúvida, responde esse email.<br>
        Alguém da equipe responde em menos de 1 hora.
       </p>`
    ),
  };
}

function getValorPlano(tipo: string): string {
  switch (tipo) {
    case "moto": return "R$ 47,90";
    case "carro":
    case "auto_eletrica": return "R$ 67,90";
    case "ambos": return "R$ 97,90";
    default: return "R$ 47,90";
  }
}

serve(handler);
