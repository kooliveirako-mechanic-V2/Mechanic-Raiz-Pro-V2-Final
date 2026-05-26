import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  emails: {
    to: string;
    nome: string;
    oficina: string;
    tipo: string;
    diasRestantes: number;
    segment: "urgente" | "aviso" | "engajamento";
  }[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emails }: EmailRequest = await req.json();
    const results = [];

    for (const email of emails) {
      const html = generateEmail(email);
      const subject = getSubject(email);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Mechanic Raiz Pro <suporte@mechanicraizpro.com.br>",
          to: [email.to],
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Erro ao enviar para ${email.to}:`, errorText);
        results.push({ email: email.to, success: false, error: errorText });
      } else {
        console.log(`✅ Email enviado para ${email.to}`);
        results.push({ email: email.to, success: true });
      }

      // Delay entre envios
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Erro:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

function getSubject(email: { segment: string; diasRestantes: number; nome: string }): string {
  if (email.segment === "urgente") {
    return `⚠️ ${email.nome}, seu teste grátis expira em ${email.diasRestantes} dias!`;
  } else if (email.segment === "aviso") {
    return `🔔 ${email.nome}, faltam ${email.diasRestantes} dias do seu teste - não perca o controle!`;
  }
  return `💡 ${email.nome}, dica rápida para você lucrar mais com o Mechanic Raiz Pro`;
}

function generateEmail(data: { nome: string; oficina: string; tipo: string; diasRestantes: number; segment: string }): string {
  const { nome, oficina, tipo, diasRestantes, segment } = data;
  
  const primeiroNome = nome.split(" ")[0];
  
  // Mensagem específica por segmento de oficina
  const tipoPainPoint = getTipoPainPoint(tipo);
  const valorPlano = getValorPlano(tipo);
  
  if (segment === "urgente") {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                
                <!-- Header URGENTE -->
                <tr>
                  <td style="background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">⚠️ ATENÇÃO, ${primeiroNome}!</h1>
                    <p style="color: rgba(255,255,255,0.95); margin: 10px 0 0 0; font-size: 18px;">
                      Seu teste grátis expira em <strong>${diasRestantes} dias</strong>
                    </p>
                  </td>
                </tr>
                
                <!-- Conteúdo -->
                <tr>
                  <td style="padding: 35px 30px;">
                    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.7; margin: 0 0 20px 0;">
                      Imagina o cenário: <strong>cliente liga perguntando do serviço</strong>, você precisa procurar em cadernos, WhatsApp, anotações soltas... 😰
                    </p>
                    
                    <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 20px; border-radius: 8px; margin: 25px 0;">
                      <p style="color: #92400E; font-size: 15px; margin: 0; font-weight: 500;">
                        ${tipoPainPoint}
                      </p>
                    </div>
                    
                    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.7; margin: 20px 0;">
                      Com o <strong>Mechanic Raiz Pro</strong>, a ${oficina} vai ter:
                    </p>
                    
                    <ul style="color: #374151; font-size: 15px; line-height: 2; padding-left: 20px; margin: 0 0 25px 0;">
                      <li>✅ Histórico completo de cada cliente</li>
                      <li>✅ Controle financeiro na palma da mão</li>
                      <li>✅ Orçamentos profissionais em segundos</li>
                      <li>✅ Nunca mais esquecer peça ou serviço</li>
                    </ul>
                    
                    <p style="color: #059669; font-size: 18px; font-weight: bold; text-align: center; margin: 25px 0;">
                      Por apenas ${valorPlano}/mês — menos que 2 serviços pagam o sistema!
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="https://mechanicraizpro.com.br/auth"
                         style="display: inline-block; background: linear-gradient(135deg, #FF7A00 0%, #FF9A40 100%); color: #ffffff; text-decoration: none; padding: 18px 50px; border-radius: 8px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 15px rgba(255, 122, 0, 0.4);">
                        GARANTIR MEU ACESSO AGORA →
                      </a>
                    </div>
                    
                    <p style="color: #6B7280; font-size: 13px; text-align: center; margin-top: 20px;">
                      Depois de ${diasRestantes} dias, você perde acesso a todos os dados cadastrados.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
                    <p style="color: #6B7280; font-size: 12px; margin: 0;">
                      Precisa de ajuda? Responda este email ou chame no WhatsApp
                    </p>
                    <p style="margin: 10px 0 0 0;">
                      <a href="https://wa.me/5511950891497" style="color: #0077B6; text-decoration: none; font-weight: 500;">📱 (11) 95089-1497</a>
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
  } else if (segment === "aviso") {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🔔 Lembrete importante, ${primeiroNome}!</h1>
                    <p style="color: rgba(255,255,255,0.95); margin: 10px 0 0 0; font-size: 16px;">
                      Faltam ${diasRestantes} dias do seu período de teste
                    </p>
                  </td>
                </tr>
                
                <!-- Conteúdo -->
                <tr>
                  <td style="padding: 35px 30px;">
                    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.7; margin: 0 0 20px 0;">
                      Oi ${primeiroNome}! Vi que você começou a usar o sistema na <strong>${oficina}</strong>. Como está sendo a experiência?
                    </p>
                    
                    <div style="background: #EFF6FF; border-left: 4px solid #3B82F6; padding: 20px; border-radius: 8px; margin: 25px 0;">
                      <p style="color: #1E40AF; font-size: 15px; margin: 0;">
                        <strong>Você sabia?</strong> ${tipoPainPoint}
                      </p>
                    </div>
                    
                    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.7; margin: 20px 0;">
                      Aproveite os próximos <strong>${diasRestantes} dias</strong> para:
                    </p>
                    
                    <ul style="color: #374151; font-size: 15px; line-height: 2; padding-left: 20px; margin: 0 0 25px 0;">
                      <li>📋 Cadastrar seus principais clientes</li>
                      <li>🚗 Registrar os veículos em atendimento</li>
                      <li>💰 Lançar entradas e saídas no financeiro</li>
                      <li>📊 Ver como o dashboard mostra seu lucro real</li>
                    </ul>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="https://mechanicraizpro.com.br/auth"
                         style="display: inline-block; background: linear-gradient(135deg, #0077B6 0%, #00A8E8 100%); color: #ffffff; text-decoration: none; padding: 16px 45px; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 12px rgba(0, 119, 182, 0.3);">
                        Continuar usando o sistema →
                      </a>
                    </div>
                    
                    <p style="color: #059669; font-size: 16px; text-align: center; margin: 20px 0; font-weight: 500;">
                      Planos a partir de ${valorPlano}/mês 💪
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
                    <p style="color: #6B7280; font-size: 13px; margin: 0;">
                      Alguma dúvida? Estou aqui pra ajudar!
                    </p>
                    <p style="margin: 10px 0 0 0;">
                      <a href="https://wa.me/5511950891497?text=Oi! Tenho uma dúvida sobre o Mechanic Raiz Pro" style="color: #0077B6; text-decoration: none; font-weight: 500;">📱 Chamar no WhatsApp</a>
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
  
  // Engajamento
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #0077B6 0%, #00A8E8 100%); padding: 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 22px;">💡 Dica do dia, ${primeiroNome}!</h1>
                </td>
              </tr>
              
              <!-- Conteúdo -->
              <tr>
                <td style="padding: 35px 30px;">
                  <p style="color: #1a1a1a; font-size: 16px; line-height: 1.7; margin: 0 0 20px 0;">
                    Você sabia que oficinas que usam sistema de gestão <strong>faturam em média 30% a mais</strong>?
                  </p>
                  
                  <p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
                    O segredo é simples: quando você tem controle dos números, identifica:
                  </p>
                  
                  <ul style="color: #374151; font-size: 15px; line-height: 2; padding-left: 20px; margin: 0 0 25px 0;">
                    <li>🎯 Quais serviços dão mais lucro</li>
                    <li>🔄 Clientes que precisam de manutenção</li>
                    <li>💸 Onde está perdendo dinheiro</li>
                    <li>📈 Oportunidades de crescimento</li>
                  </ul>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://mechanicraizpro.com.br/auth"
                       style="display: inline-block; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold;">
                      Ver meus relatórios →
                    </a>
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
                  <p style="color: #888; font-size: 12px; margin: 0;">
                    © 2026 Mechanic Raiz Pro - Sistema de Gestão para Oficinas
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

function getTipoPainPoint(tipo: string): string {
  switch (tipo) {
    case "moto":
      return "Oficinas de moto perdem até R$ 500/mês por serviços não cobrados ou peças esquecidas. O Mechanic Raiz Pro evita isso!";
    case "carro":
      return "Clientes de carro gastam mais e voltam se você mantém o histórico organizado. Eles confiam em quem tem controle!";
    case "ambos":
      return "Gerenciar moto e carro exige organização extra. Com tudo no sistema, você nunca confunde serviços ou valores!";
    case "auto_eletrica":
      return "Diagnósticos elétricos são complexos. Com código OBD registrado, você mostra profissionalismo e cobra o justo!";
    default:
      return "Oficinas organizadas faturam mais. Clientes confiam em quem tem tudo registrado!";
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
