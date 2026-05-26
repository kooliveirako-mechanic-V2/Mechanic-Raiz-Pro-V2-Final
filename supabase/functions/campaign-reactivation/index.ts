import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RECEIVE_LEADS_TOKEN = Deno.env.get("RECEIVE_LEADS_TOKEN") || Deno.env.get("RECEBER_TOKEN_DE_LEADS");
const WEBHOOK_URL = "https://odhdronjiiczxyeqtiha.supabase.co/functions/v1/receive-leads";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ========================================
// MENSAGENS WHATSAPP (Informal, pessoal)
// ========================================

const WHATSAPP_MESSAGES = {
  // DIA 1 — Primeiro contato
  frio_d1: (nome: string) =>
    `E aí ${nome}! 👋 Aqui é do Mechanic Raiz Pro.\n\n` +
    `Faz um tempo que você testou o sistema, né? Então, a gente evoluiu DEMAIS desde lá! 🚀\n\n` +
    `✅ Painel novo, mais rápido\n` +
    `✅ Controle de auto elétrica completo\n` +
    `✅ Kanban de serviços\n` +
    `✅ Financeiro inteligente\n\n` +
    `Liberamos *+7 dias grátis* pra você ver tudo novo. É só entrar com seu email de antes:\n` +
    `👉 https://mechanicraizpro.com.br/auth\n\n` +
    `Qualquer dúvida, chama aqui! 🔧`,

  morno_d1: (nome: string) =>
    `Fala ${nome}! 😄\n\n` +
    `Tá controlando a oficina como? Na caderneta ainda? 😅\n\n` +
    `Seu acesso no Mechanic Raiz Pro tá te esperando, e a gente liberou *+7 dias grátis* pra você testar direito dessa vez.\n\n` +
    `Em 2 minutos você já tem:\n` +
    `📋 OS organizada\n` +
    `💰 Financeiro no controle\n` +
    `📦 Estoque em dia\n\n` +
    `Entra lá: https://mechanicraizpro.com.br/auth\n\n` +
    `Bora? 💪`,

  quente_d1: (nome: string) =>
    `${nome}, tudo bem? 👋\n\n` +
    `Vi que você criou conta mas não terminou de configurar. Normal, correria de oficina é assim mesmo! 😄\n\n` +
    `Posso te ajudar? Em *2 minutinhos* tá tudo rodando:\n` +
    `1️⃣ Entra aqui: https://mechanicraizpro.com.br/auth\n` +
    `2️⃣ Cadastra o nome da oficina\n` +
    `3️⃣ Pronto, já pode usar tudo!\n\n` +
    `Se travar em algo, me chama aqui que te ajudo na hora! 🔧`,

  // DIA 3 — Follow-up final (urgência)
  frio_d3: (nome: string) =>
    `${nome}, última mensagem! ✋\n\n` +
    `Os *7 dias grátis extras* que liberamos tão acabando...\n\n` +
    `Já tem oficina usando pra:\n` +
    `• Saber exatamente quanto lucra por serviço 💰\n` +
    `• Nunca mais esquecer peça em estoque 📦\n` +
    `• Mandar orçamento profissional pro cliente 📄\n\n` +
    `É só entrar com seu email: https://mechanicraizpro.com.br/auth\n\n` +
    `Depois não vai ter mais essa oportunidade! 🔥`,

  morno_d3: (nome: string) =>
    `Ô ${nome}! Último lembrete aqui 😄\n\n` +
    `Seus *7 dias grátis extras* tão quase acabando.\n\n` +
    `Pensa assim: quanto dinheiro você deixa de ganhar por mês sem saber o lucro real de cada serviço? 🤔\n\n` +
    `O Mechanic Raiz Pro te mostra isso em *tempo real*.\n\n` +
    `Entra lá rapidinho: https://mechanicraizpro.com.br/auth\n\n` +
    `Qualquer coisa, tamo aqui! 👊`,

  quente_d3: (nome: string) =>
    `${nome}! 👋\n\n` +
    `Só passando pra lembrar que seu acesso tá ativo!\n\n` +
    `Se precisar de ajuda pra configurar, me chama aqui que faço junto com você, rapidinho.\n\n` +
    `👉 https://mechanicraizpro.com.br/auth\n\n` +
    `Sucesso na oficina! 🔧💪`,
};

// ========================================
// EMAILS (Profissional, bem escrito)
// ========================================

function generateEmailFrio(nome: string): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
  <tr><td style="background:linear-gradient(135deg,#0077B6,#005F8A);padding:40px 30px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:28px;">🔧 Mechanic Raiz Pro</h1>
    <p style="color:rgba(255,255,255,0.9);margin:10px 0 0;font-size:15px;">Evoluímos. Volte e veja!</p>
  </td></tr>
  <tr><td style="padding:40px 30px;">
    <h2 style="color:#1a1a1a;margin:0 0 20px;font-size:22px;">${nome}, muita coisa mudou! 🚀</h2>
    <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Faz um tempo que você testou o Mechanic Raiz Pro, e desde então a gente trabalhou duro pra entregar a melhor ferramenta de gestão para oficinas do Brasil.
    </p>
    <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin:0 0 10px;font-weight:bold;">
      Veja o que tem de novo:
    </p>
    <ul style="color:#4a4a4a;font-size:15px;line-height:2;margin:0 0 25px;padding-left:20px;">
      <li>🎯 <strong>Painel redesenhado</strong> — tudo mais rápido e intuitivo</li>
      <li>⚡ <strong>Módulo Auto Elétrica</strong> — diagnóstico completo com checklist</li>
      <li>📊 <strong>Indicadores de lucro</strong> — saiba quanto ganha em cada serviço</li>
      <li>📱 <strong>Kanban de serviços</strong> — arraste e organize como um profissional</li>
      <li>💰 <strong>Financeiro inteligente</strong> — parcelas, recorrências, tudo automático</li>
    </ul>
    <div style="background:#FFF5EB;border-left:4px solid #FF7A18;padding:20px;border-radius:8px;margin:0 0 30px;">
      <p style="color:#E06600;font-size:18px;font-weight:bold;margin:0 0 5px;">🎁 Presente especial para você</p>
      <p style="color:#4a4a4a;font-size:15px;margin:0;">Liberamos <strong>+7 dias grátis</strong> para você testar todas as novidades. Sem compromisso.</p>
    </div>
    <div style="text-align:center;margin:30px 0;">
      <a href="https://mechanicraizpro.com.br/auth" style="display:inline-block;background:linear-gradient(135deg,#FF7A00,#FF9A40);color:#fff;text-decoration:none;padding:16px 40px;border-radius:8px;font-size:16px;font-weight:bold;box-shadow:0 4px 12px rgba(255,122,0,0.3);">
        Quero ver as novidades →
      </a>
    </div>
    <p style="color:#888;font-size:14px;text-align:center;margin:25px 0 0;">
      Use o mesmo email que você cadastrou antes. Seus dados estão salvos! 😊
    </p>
  </td></tr>
  <tr><td style="background:#f8f9fa;padding:25px 30px;text-align:center;border-top:1px solid #eee;">
    <p style="color:#888;font-size:12px;margin:0;">© 2026 Mechanic Raiz Pro — Sistema de Gestão para Oficinas</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

function generateEmailMorno(nome: string): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
  <tr><td style="background:linear-gradient(135deg,#0077B6,#005F8A);padding:40px 30px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:28px;">🔧 Mechanic Raiz Pro</h1>
    <p style="color:rgba(255,255,255,0.9);margin:10px 0 0;font-size:15px;">Sua oficina merece controle total</p>
  </td></tr>
  <tr><td style="padding:40px 30px;">
    <h2 style="color:#1a1a1a;margin:0 0 20px;font-size:22px;">${nome}, quanto dinheiro está escapando? 🤔</h2>
    <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Sem um sistema de gestão, a maioria dos donos de oficina <strong>não sabe o lucro real</strong> de cada serviço. Cobram barato demais, esquecem peças no estoque e perdem dinheiro sem perceber.
    </p>
    <div style="background:#FEF2F2;border-radius:8px;padding:20px;margin:0 0 25px;">
      <p style="color:#991B1B;font-size:15px;margin:0 0 10px;font-weight:bold;">❌ Sem controle, você:</p>
      <ul style="color:#7F1D1D;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
        <li>Não sabe se cobrou certo</li>
        <li>Esquece de cobrar peças</li>
        <li>Perde prazo de garantia</li>
        <li>Não tem histórico do veículo</li>
      </ul>
    </div>
    <div style="background:#F0FFF4;border-radius:8px;padding:20px;margin:0 0 25px;">
      <p style="color:#166534;font-size:15px;margin:0 0 10px;font-weight:bold;">✅ Com Mechanic Raiz Pro, você:</p>
      <ul style="color:#15803D;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
        <li>Vê o lucro de cada OS em tempo real</li>
        <li>Controla estoque automaticamente</li>
        <li>Envia orçamento profissional em 1 clique</li>
        <li>Tem todo histórico do cliente e veículo</li>
      </ul>
    </div>
    <div style="background:#FFF5EB;border-left:4px solid #FF7A18;padding:20px;border-radius:8px;margin:0 0 30px;">
      <p style="color:#E06600;font-size:18px;font-weight:bold;margin:0 0 5px;">🎁 +7 dias grátis liberados</p>
      <p style="color:#4a4a4a;font-size:15px;margin:0;">Teste de verdade dessa vez. Sem compromisso, sem cartão.</p>
    </div>
    <div style="text-align:center;margin:30px 0;">
      <a href="https://mechanicraizpro.com.br/auth" style="display:inline-block;background:linear-gradient(135deg,#FF7A00,#FF9A40);color:#fff;text-decoration:none;padding:16px 40px;border-radius:8px;font-size:16px;font-weight:bold;box-shadow:0 4px 12px rgba(255,122,0,0.3);">
        Quero controlar minha oficina →
      </a>
    </div>
  </td></tr>
  <tr><td style="background:#f8f9fa;padding:25px 30px;text-align:center;border-top:1px solid #eee;">
    <p style="color:#888;font-size:12px;margin:0;">© 2026 Mechanic Raiz Pro — Sistema de Gestão para Oficinas</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

function generateEmailQuente(nome: string): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
  <tr><td style="background:linear-gradient(135deg,#0077B6,#005F8A);padding:40px 30px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:28px;">🔧 Mechanic Raiz Pro</h1>
    <p style="color:rgba(255,255,255,0.9);margin:10px 0 0;font-size:15px;">Falta pouco!</p>
  </td></tr>
  <tr><td style="padding:40px 30px;">
    <h2 style="color:#1a1a1a;margin:0 0 20px;font-size:22px;">Oi ${nome}! 👋 Falta só 1 passo</h2>
    <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin:0 0 25px;">
      Você criou sua conta no Mechanic Raiz Pro, mas ainda não configurou sua oficina. Em <strong>2 minutos</strong> você já pode usar tudo!
    </p>
    <div style="background:#F0F9FF;border-radius:12px;padding:25px;margin:0 0 30px;">
      <p style="color:#0077B6;font-size:16px;font-weight:bold;margin:0 0 15px;">Passo a passo rápido:</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:8px 0;font-size:15px;color:#4a4a4a;">
          <span style="background:#0077B6;color:#fff;border-radius:50%;padding:4px 10px;margin-right:12px;font-weight:bold;">1</span>
          Entre com seu email e senha
        </td></tr>
        <tr><td style="padding:8px 0;font-size:15px;color:#4a4a4a;">
          <span style="background:#0077B6;color:#fff;border-radius:50%;padding:4px 10px;margin-right:12px;font-weight:bold;">2</span>
          Digite o nome da sua oficina
        </td></tr>
        <tr><td style="padding:8px 0;font-size:15px;color:#4a4a4a;">
          <span style="background:#0077B6;color:#fff;border-radius:50%;padding:4px 10px;margin-right:12px;font-weight:bold;">3</span>
          Pronto! Comece a cadastrar serviços 🎉
        </td></tr>
      </table>
    </div>
    <div style="text-align:center;margin:30px 0;">
      <a href="https://mechanicraizpro.com.br/auth" style="display:inline-block;background:linear-gradient(135deg,#FF7A00,#FF9A40);color:#fff;text-decoration:none;padding:16px 40px;border-radius:8px;font-size:16px;font-weight:bold;box-shadow:0 4px 12px rgba(255,122,0,0.3);">
        Completar configuração →
      </a>
    </div>
    <p style="color:#888;font-size:14px;text-align:center;margin:25px 0 0;">
      Precisa de ajuda? Responda este email que te ajudamos! 😊
    </p>
  </td></tr>
  <tr><td style="background:#f8f9fa;padding:25px 30px;text-align:center;border-top:1px solid #eee;">
    <p style="color:#888;font-size:12px;margin:0;">© 2026 Mechanic Raiz Pro — Sistema de Gestão para Oficinas</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

// ========================================
// SUBJECTS POR SEGMENTO
// ========================================

const EMAIL_SUBJECTS = {
  frio: "🚀 Mechanic Raiz Pro evoluiu! Seus 7 dias grátis extras te esperam",
  morno: "💰 Quanto dinheiro sua oficina perde sem controle? +7 dias grátis",
  quente: "👋 Falta só 1 passo pra usar o Mechanic Raiz Pro!",
};

// ========================================
// HANDLER PRINCIPAL
// ========================================

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action = "auto" } = await req.json().catch(() => ({}));
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ---- STEP 1: Segmentar usuários (só na primeira execução) ----
    if (action === "segmentar" || action === "auto") {
      console.log("🔄 Segmentando usuários...");

      const { data: mapped } = await supabase
        .from("user_migration_map")
        .select("email, nome, old_user_id");

      if (!mapped || mapped.length === 0) {
        return jsonResponse({ success: true, message: "Nenhum usuário para segmentar" });
      }

      // Buscar quais já migraram (não precisa campanha)
      const migrated = mapped.filter((m) => false); // todos precisam da campanha

      // Buscar auth users para saber data de criação — usar profiles como proxy
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome, telefone, created_at");

      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p])
      );

      const now = new Date();
      const records = [];

      for (const user of mapped) {
        const profile = profileMap.get(user.old_user_id);
        const createdAt = profile?.created_at
          ? new Date(profile.created_at)
          : new Date("2026-01-01");
        const diasDesde = Math.floor(
          (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        let segmento = "frio";
        if (diasDesde <= 7) segmento = "quente";
        else if (diasDesde <= 30) segmento = "morno";

        records.push({
          email: user.email,
          nome: user.nome || profile?.nome || user.email.split("@")[0],
          telefone: profile?.telefone || null,
          segmento,
          dias_desde_cadastro: diasDesde,
          dia_sequencia: 0,
        });
      }

      // Upsert
      const { error: upsertError } = await supabase
        .from("campaign_reactivation")
        .upsert(records, { onConflict: "email" });

      if (upsertError) {
        console.error("Erro ao segmentar:", upsertError);
        throw upsertError;
      }

      const frios = records.filter((r) => r.segmento === "frio").length;
      const mornos = records.filter((r) => r.segmento === "morno").length;
      const quentes = records.filter((r) => r.segmento === "quente").length;

      console.log(`📊 Segmentação: ${frios} frios, ${mornos} mornos, ${quentes} quentes`);

      if (action === "segmentar") {
        return jsonResponse({
          success: true,
          total: records.length,
          segmentos: { frios, mornos, quentes },
          usuarios: records.map((r) => ({
            email: r.email,
            nome: r.nome,
            segmento: r.segmento,
            dias: r.dias_desde_cadastro,
          })),
        });
      }
    }

    // ---- STEP 2: Executar o dia da sequência ----
    if (action === "auto" || action === "dia1" || action === "dia2" || action === "dia3") {
      const { data: pendentes } = await supabase
        .from("campaign_reactivation")
        .select("*");

      if (!pendentes || pendentes.length === 0) {
        return jsonResponse({ success: true, message: "Nenhum pendente" });
      }

      let dia = action;
      if (action === "auto") {
        // Detectar qual dia executar baseado no estado
        const d1Done = pendentes.every((p) => p.whatsapp_d1_enviado);
        const d2Done = pendentes.every((p) => p.email_d2_enviado);
        if (!d1Done) dia = "dia1";
        else if (!d2Done) dia = "dia2";
        else dia = "dia3";
      }

      console.log(`📧 Executando ${dia}...`);
      const results: any[] = [];

      if (dia === "dia1") {
        // DIA 1: WhatsApp via Lead Machine Pro — APENAS leads com telefone
        const toSend = pendentes.filter((p) => !p.whatsapp_d1_enviado);
        // Separar: com telefone → webhook, sem telefone → só marcar como processado
        const comTelefone = toSend.filter((p) => p.telefone && p.telefone.trim().length > 0);
        const semTelefone = toSend.filter((p) => !p.telefone || p.telefone.trim().length === 0);

        const successEmails: string[] = [];
        const failedEmails: string[] = [];

        if (comTelefone.length > 0 && RECEIVE_LEADS_TOKEN) {
          // Enviar UM POR UM para melhor rastreamento
          for (const lead of comTelefone) {
            const payload = [{
              nome: lead.nome,
              email: lead.email,
              telefone: lead.telefone,
              categoria: `reativacao-${lead.segmento}-d1`,
              mensagem: getWhatsAppMessage(lead.segmento, "d1", lead.nome || "Amigo"),
            }];

            try {
              const res = await fetch(WEBHOOK_URL, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-token": RECEIVE_LEADS_TOKEN,
                },
                body: JSON.stringify(payload),
              });

              const body = await res.text();

              if (res.ok) {
                successEmails.push(lead.email);
                results.push({ email: lead.email, success: true, status: res.status });
                console.log(`✅ Lead enviado: ${lead.email} (${lead.segmento})`);
              } else {
                failedEmails.push(lead.email);
                results.push({ email: lead.email, success: false, status: res.status, body });
                console.error(`❌ Webhook rejeitou ${lead.email}: ${res.status} — ${body}`);
              }
            } catch (e: any) {
              failedEmails.push(lead.email);
              results.push({ email: lead.email, success: false, error: e.message });
              console.error(`❌ Erro de rede enviando ${lead.email}: ${e.message}`);
            }
            await new Promise((r) => setTimeout(r, 300));
          }
        } else if (!RECEIVE_LEADS_TOKEN) {
          console.error("❌ RECEIVE_LEADS_TOKEN não configurado — nenhum lead enviado");
        }

        // Marcar APENAS os que foram enviados com sucesso
        if (successEmails.length > 0) {
          await supabase
            .from("campaign_reactivation")
            .update({ whatsapp_d1_enviado: true, dia_sequencia: 1, updated_at: new Date().toISOString() })
            .in("email", successEmails);
        }

        // Leads sem telefone: marcar como processado (não tem WhatsApp pra enviar)
        if (semTelefone.length > 0) {
          await supabase
            .from("campaign_reactivation")
            .update({ whatsapp_d1_enviado: true, dia_sequencia: 1, updated_at: new Date().toISOString() })
            .in("email", semTelefone.map((p) => p.email));
        }

        // Estender trial para frios e mornos (independente do WhatsApp)
        const toExtend = toSend.filter((p) => p.segmento !== "quente");
        if (toExtend.length > 0) {
          const novaData = new Date();
          novaData.setDate(novaData.getDate() + 7);
          
          for (const lead of toExtend) {
            const { data: mapData } = await supabase
              .from("user_migration_map")
              .select("old_user_id")
              .eq("email", lead.email)
              .single();

            if (mapData) {
              const { data: oficina } = await supabase
                .from("oficinas")
                .select("id")
                .eq("user_id", mapData.old_user_id)
                .single();

              if (oficina) {
                await supabase
                  .from("subscriptions")
                  .update({
                    trial_ends_at: novaData.toISOString(),
                    status: "trial",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("oficina_id", oficina.id);
              }
            }
          }

          await supabase
            .from("campaign_reactivation")
            .update({ trial_estendido: true })
            .in("email", toExtend.map((p) => p.email));
        }

        return jsonResponse({
          success: true,
          dia: "dia1",
          canal: "WhatsApp",
          total: toSend.length,
          com_telefone: comTelefone.length,
          sem_telefone: semTelefone.length,
          enviados_sucesso: successEmails.length,
          enviados_falha: failedEmails.length,
          trials_estendidos: toExtend.length,
          falhas: failedEmails,
          results,
        });
      }

      if (dia === "dia2") {
        // DIA 2: Email via Resend
        const toSend = pendentes.filter((p) => !p.email_d2_enviado);
        
        for (const lead of toSend) {
          const nome = lead.nome || "Amigo";
          const emailHtml = getEmailHtml(lead.segmento, nome);
          const subject = EMAIL_SUBJECTS[lead.segmento as keyof typeof EMAIL_SUBJECTS] || EMAIL_SUBJECTS.frio;

          try {
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
              },
              body: JSON.stringify({
                from: "Mechanic Raiz Pro <suporte@mechanicraizpro.com.br>",
                to: [lead.email],
                subject,
                html: emailHtml,
              }),
            });

            results.push({ email: lead.email, success: res.ok });
            if (!res.ok) {
              const err = await res.text();
              console.error(`Erro email ${lead.email}:`, err);
            }
          } catch (e: any) {
            results.push({ email: lead.email, success: false, error: e.message });
          }
          await new Promise((r) => setTimeout(r, 300));
        }

        await supabase
          .from("campaign_reactivation")
          .update({ email_d2_enviado: true, dia_sequencia: 2, updated_at: new Date().toISOString() })
          .in("email", toSend.map((p) => p.email));

        const successCount = results.filter((r) => r.success).length;
        return jsonResponse({
          success: true,
          dia: "dia2",
          canal: "Email",
          total: toSend.length,
          enviados: successCount,
          results,
        });
      }

      if (dia === "dia3") {
        // DIA 3: WhatsApp final — APENAS leads com telefone
        const toSend = pendentes.filter((p) => !p.whatsapp_d3_enviado);
        const comTelefone = toSend.filter((p) => p.telefone && p.telefone.trim().length > 0);
        const semTelefone = toSend.filter((p) => !p.telefone || p.telefone.trim().length === 0);

        const successEmails: string[] = [];
        const failedEmails: string[] = [];

        if (comTelefone.length > 0 && RECEIVE_LEADS_TOKEN) {
          for (const lead of comTelefone) {
            const payload = [{
              nome: lead.nome,
              email: lead.email,
              telefone: lead.telefone,
              categoria: `reativacao-${lead.segmento}-d3`,
              mensagem: getWhatsAppMessage(lead.segmento, "d3", lead.nome || "Amigo"),
            }];

            try {
              const res = await fetch(WEBHOOK_URL, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-token": RECEIVE_LEADS_TOKEN,
                },
                body: JSON.stringify(payload),
              });

              const body = await res.text();
              if (res.ok) {
                successEmails.push(lead.email);
                results.push({ email: lead.email, success: true, status: res.status });
                console.log(`✅ D3 enviado: ${lead.email}`);
              } else {
                failedEmails.push(lead.email);
                results.push({ email: lead.email, success: false, status: res.status, body });
                console.error(`❌ D3 rejeitado ${lead.email}: ${res.status} — ${body}`);
              }
            } catch (e: any) {
              failedEmails.push(lead.email);
              results.push({ email: lead.email, success: false, error: e.message });
            }
            await new Promise((r) => setTimeout(r, 300));
          }
        }

        // Marcar só os bem-sucedidos + sem telefone
        if (successEmails.length > 0) {
          await supabase
            .from("campaign_reactivation")
            .update({ whatsapp_d3_enviado: true, dia_sequencia: 3, updated_at: new Date().toISOString() })
            .in("email", successEmails);
        }
        if (semTelefone.length > 0) {
          await supabase
            .from("campaign_reactivation")
            .update({ whatsapp_d3_enviado: true, dia_sequencia: 3, updated_at: new Date().toISOString() })
            .in("email", semTelefone.map((p) => p.email));
        }

        return jsonResponse({
          success: true,
          dia: "dia3",
          canal: "WhatsApp Final",
          total: toSend.length,
          com_telefone: comTelefone.length,
          enviados_sucesso: successEmails.length,
          enviados_falha: failedEmails.length,
          falhas: failedEmails,
          results,
        });
      }
    }

    // ---- STATUS ----
    if (action === "status") {
      const { data, count } = await supabase
        .from("campaign_reactivation")
        .select("*", { count: "exact" });

      const stats = {
        total: count || 0,
        frios: data?.filter((d) => d.segmento === "frio").length || 0,
        mornos: data?.filter((d) => d.segmento === "morno").length || 0,
        quentes: data?.filter((d) => d.segmento === "quente").length || 0,
        d1_enviados: data?.filter((d) => d.whatsapp_d1_enviado).length || 0,
        d2_enviados: data?.filter((d) => d.email_d2_enviado).length || 0,
        d3_enviados: data?.filter((d) => d.whatsapp_d3_enviado).length || 0,
        trials_estendidos: data?.filter((d) => d.trial_estendido).length || 0,
      };

      return jsonResponse({ success: true, stats, usuarios: data });
    }

    return jsonResponse({ error: "Ação inválida. Use: segmentar, dia1, dia2, dia3, auto, status" }, 400);
  } catch (error: any) {
    console.error("Erro na campanha:", error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
};

function getWhatsAppMessage(segmento: string, dia: string, nome: string): string {
  const key = `${segmento}_${dia}` as keyof typeof WHATSAPP_MESSAGES;
  const fn = WHATSAPP_MESSAGES[key];
  return fn ? fn(nome) : `Olá ${nome}! Acesse: https://mechanicraizpro.com.br/auth`;
}

function getEmailHtml(segmento: string, nome: string): string {
  switch (segmento) {
    case "frio": return generateEmailFrio(nome);
    case "morno": return generateEmailMorno(nome);
    case "quente": return generateEmailQuente(nome);
    default: return generateEmailFrio(nome);
  }
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(handler);
