import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FollowUpRequest {
  email: string;
  nome?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, nome }: FollowUpRequest = await req.json();

    if (!email) {
      throw new Error("Email é obrigatório");
    }

    console.log(`Enviando email de follow-up para: ${email}`);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0077B6 0%, #005F8A 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">🔧 Mechanic Raiz Pro</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Sistema de Gestão para Oficinas</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 22px;">
                      Olá${nome ? `, ${nome}` : ''}! 👋
                    </h2>
                    
                    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Percebemos que você criou uma conta no <strong>Mechanic Raiz Pro</strong>, mas ainda não terminou de configurar sua oficina.
                    </p>
                    
                    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Falta pouco para você ter acesso completo ao sistema! Em apenas <strong>1 minuto</strong> você pode:
                    </p>
                    
                    <ul style="color: #4a4a4a; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0; padding-left: 20px;">
                      <li>✅ Gerenciar ordens de serviço</li>
                      <li>✅ Controlar clientes e veículos</li>
                      <li>✅ Acompanhar o financeiro</li>
                      <li>✅ Controlar estoque de peças</li>
                      <li>✅ Gerar orçamentos profissionais</li>
                    </ul>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="https://mechanicraizpro.com.br/auth"
                         style="display: inline-block; background: linear-gradient(135deg, #FF7A00 0%, #FF9A40 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 12px rgba(255, 122, 0, 0.3);">
                        Completar meu cadastro →
                      </a>
                    </div>
                    
                    <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
                      Lembre-se: você tem <strong>14 dias grátis</strong> para testar todas as funcionalidades!
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #eee;">
                    <p style="color: #888888; font-size: 12px; margin: 0;">
                      © 2026 Mechanic Raiz Pro. Todos os direitos reservados.
                    </p>
                    <p style="color: #aaaaaa; font-size: 11px; margin: 10px 0 0 0;">
                      Se você não criou esta conta, pode ignorar este email.
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

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Mechanic Raiz Pro <suporte@mechanicraizpro.com.br>",
        to: [email],
        subject: "🔧 Você ainda não terminou seu cadastro no Mechanic Raiz Pro!",
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Erro da API Resend:", errorText);
      throw new Error(`Erro ao enviar email: ${errorText}`);
    }

    const data = await res.json();
    console.log("Email de follow-up enviado com sucesso:", data);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Erro ao enviar email de follow-up:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
