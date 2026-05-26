import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 Iniciando envio do anúncio de 14 dias grátis...");
    
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Buscar todos os usuários com oficinas
    const { data: oficinas, error: oficinasError } = await supabase
      .from("oficinas")
      .select(`
        id,
        nome,
        tipo,
        user_id
      `);

    if (oficinasError) {
      console.error("Erro ao buscar oficinas:", oficinasError);
      throw oficinasError;
    }

    console.log(`📊 Encontradas ${oficinas?.length || 0} oficinas`);

    // Buscar emails dos usuários
    const userIds = oficinas?.map(o => o.user_id) || [];
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error("Erro ao buscar usuários:", usersError);
      throw usersError;
    }

    const userEmailMap = new Map(users?.map(u => [u.id, { email: u.email, nome: u.user_metadata?.nome || u.email?.split("@")[0] }]) || []);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const oficina of oficinas || []) {
      const userData = userEmailMap.get(oficina.user_id);
      
      if (!userData?.email) {
        console.log(`⚠️ Usuário sem email: ${oficina.user_id}`);
        continue;
      }

      const html = generateAnnouncementEmail({
        nome: userData.nome || "Parceiro",
        oficina: oficina.nome,
        tipo: oficina.tipo,
      });

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Mechanic Raiz Pro <suporte@mechanicraizpro.com.br>",
            to: [userData.email],
            subject: "🎁 LIBERADO! 14 Dias GRÁTIS para sua oficina — Aproveite agora!",
            html,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error(`❌ Erro ao enviar para ${userData.email}:`, errorText);
          results.push({ email: userData.email, success: false, error: errorText });
          errorCount++;
        } else {
          console.log(`✅ Email enviado para ${userData.email}`);
          results.push({ email: userData.email, success: true });
          successCount++;
        }

        // Delay entre envios para não sobrecarregar
        // Delay maior para respeitar rate limit do Resend (2 req/s)
        await new Promise(resolve => setTimeout(resolve, 600));
      } catch (emailError: any) {
        console.error(`❌ Erro ao enviar para ${userData.email}:`, emailError);
        results.push({ email: userData.email, success: false, error: emailError.message });
        errorCount++;
      }
    }

    console.log(`\n📧 Resumo do envio:`);
    console.log(`   ✅ Sucesso: ${successCount}`);
    console.log(`   ❌ Erros: ${errorCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        totalEnviados: successCount,
        totalErros: errorCount,
        results 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Erro geral:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

function generateAnnouncementEmail(data: { nome: string; oficina: string; tipo: string }): string {
  const { nome, oficina, tipo } = data;
  const primeiroNome = nome.split(" ")[0];
  
  const beneficiosPorTipo = getBeneficiosPorTipo(tipo);
  const valorPlano = getValorPlano(tipo);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);">
              
              <!-- Header Celebração -->
              <tr>
                <td style="background: linear-gradient(135deg, #0077B6 0%, #00A8E8 50%, #10B981 100%); padding: 40px 30px; text-align: center;">
                  <div style="font-size: 60px; margin-bottom: 10px;">🎉</div>
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                    ${primeiroNome}, LIBERAMOS 14 DIAS GRÁTIS!
                  </h1>
                  <p style="color: rgba(255,255,255,0.95); margin: 15px 0 0 0; font-size: 18px;">
                    Sem cartão. Sem compromisso. Acesso total.
                  </p>
                </td>
              </tr>
              
              <!-- Badge de destaque -->
              <tr>
                <td style="text-align: center; padding: 0;">
                  <div style="display: inline-block; background: linear-gradient(135deg, #FF7A00 0%, #FF9A40 100%); color: white; padding: 12px 35px; border-radius: 0 0 20px 20px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(255, 122, 0, 0.3);">
                    🔓 TODAS AS FUNCIONALIDADES LIBERADAS
                  </div>
                </td>
              </tr>
              
              <!-- Conteúdo -->
              <tr>
                <td style="padding: 40px 35px;">
                  <p style="color: #1a1a1a; font-size: 17px; line-height: 1.8; margin: 0 0 25px 0;">
                    Oi ${primeiroNome}! 👋
                  </p>
                  
                  <p style="color: #374151; font-size: 16px; line-height: 1.8; margin: 0 0 25px 0;">
                    A gente sabe que gerenciar a <strong>${oficina}</strong> não é fácil. Entre atender cliente, fazer diagnóstico, comprar peça, cobrar serviço... sobra pouco tempo pra organizar tudo.
                  </p>
                  
                  <p style="color: #374151; font-size: 16px; line-height: 1.8; margin: 0 0 25px 0;">
                    Por isso, decidimos <strong>liberar 14 dias grátis</strong> do Mechanic Raiz Pro pra você testar sem pressa, sem pressão e sem precisar colocar cartão.
                  </p>
                  
                  <!-- Box de benefícios -->
                  <div style="background: linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%); border: 2px solid #10B981; border-radius: 12px; padding: 25px; margin: 30px 0;">
                    <h3 style="color: #059669; margin: 0 0 15px 0; font-size: 18px;">
                      ✨ O que você ganha nesses 14 dias:
                    </h3>
                    <ul style="color: #374151; font-size: 15px; line-height: 2.2; padding-left: 0; margin: 0; list-style: none;">
                      ${beneficiosPorTipo}
                    </ul>
                  </div>
                  
                  <!-- Destaque valor -->
                  <div style="background: #FEF3C7; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0;">
                    <p style="color: #92400E; font-size: 15px; margin: 0;">
                      💡 <strong>Depois dos 14 dias?</strong> Se gostar, planos a partir de <strong>${valorPlano}/mês</strong>.<br>
                      <span style="font-size: 14px;">Menos que 2 serviços simples pagam o sistema!</span>
                    </p>
                  </div>
                  
                  <!-- CTA Principal -->
                  <div style="text-align: center; margin: 35px 0;">
                    <a href="https://mechanicraizpro.com.br/auth"
                       style="display: inline-block; background: linear-gradient(135deg, #FF7A00 0%, #FF9A40 100%); color: #ffffff; text-decoration: none; padding: 20px 55px; border-radius: 12px; font-size: 20px; font-weight: bold; box-shadow: 0 6px 25px rgba(255, 122, 0, 0.4); transition: transform 0.2s;">
                      COMEÇAR AGORA — É GRÁTIS! 🚀
                    </a>
                  </div>
                  
                  <p style="color: #6B7280; font-size: 14px; text-align: center; margin: 25px 0 0 0;">
                    Clique no botão acima e faça login para ativar seus 14 dias.<br>
                    <strong>Sem cartão, sem pegadinha.</strong>
                  </p>
                </td>
              </tr>
              
              <!-- Seção de confiança -->
              <tr>
                <td style="background: #F8FAFC; padding: 30px 35px; border-top: 1px solid #E2E8F0;">
                  <p style="color: #64748B; font-size: 14px; text-align: center; margin: 0 0 15px 0;">
                    🔒 <strong>Seus dados estão seguros</strong> — não compartilhamos com ninguém
                  </p>
                  <p style="color: #64748B; font-size: 14px; text-align: center; margin: 0;">
                    ⚡ <strong>Suporte humano</strong> — qualquer dúvida, é só chamar
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #1E293B; padding: 30px 35px; text-align: center;">
                  <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0 0 15px 0;">
                    Precisa de ajuda? Estamos aqui!
                  </p>
                  <a href="https://wa.me/5511950891497?text=Oi! Quero saber mais sobre os 14 dias grátis do Mechanic Raiz Pro" 
                     style="display: inline-block; background: #25D366; color: white; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-size: 14px; font-weight: 500;">
                    📱 Chamar no WhatsApp
                  </a>
                  <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 20px 0 0 0;">
                    © 2026 Mechanic Raiz Pro — Sistema de Gestão para Oficinas<br>
                    Feito com 💙 para mecânicos que querem crescer
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function getBeneficiosPorTipo(tipo: string): string {
  const beneficiosBase = `
    <li>✅ <strong>Cadastro ilimitado</strong> de clientes e veículos</li>
    <li>✅ <strong>Ordens de Serviço</strong> profissionais com WhatsApp</li>
    <li>✅ <strong>Orçamentos</strong> com link público para aprovação</li>
    <li>✅ <strong>Financeiro completo</strong> — veja seu lucro real</li>
    <li>✅ <strong>Estoque</strong> com alertas de reposição</li>
    <li>✅ <strong>Dashboard</strong> com visão completa do negócio</li>
  `;
  
  switch (tipo) {
    case "moto":
      return beneficiosBase + `<li>✅ <strong>Focado em motos</strong> — tudo pensado pro seu nicho</li>`;
    case "carro":
      return beneficiosBase + `<li>✅ <strong>Gestão de carros</strong> — histórico completo por veículo</li>`;
    case "ambos":
      return beneficiosBase + `<li>✅ <strong>Moto + Carro</strong> — gerencia tudo em um só lugar</li>`;
    case "auto_eletrica":
      return beneficiosBase + `
        <li>✅ <strong>Diagnóstico elétrico</strong> com códigos OBD</li>
        <li>✅ <strong>Histórico técnico</strong> por módulo e sistema</li>
      `;
    default:
      return beneficiosBase;
  }
}

function getValorPlano(tipo: string): string {
  switch (tipo) {
    case "moto":
      return "R$ 47,90";
    case "carro":
    case "auto_eletrica":
      return "R$ 67,90";
    case "ambos":
      return "R$ 97,90";
    default:
      return "R$ 47,90";
  }
}

serve(handler);
