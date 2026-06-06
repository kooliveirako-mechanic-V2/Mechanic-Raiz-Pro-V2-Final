import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AnnouncementRequest {
  email: string;
  nome?: string;
  oficina_nome?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, nome, oficina_nome }: AnnouncementRequest = await req.json();

    if (!email) {
      throw new Error("Email é obrigatório");
    }

    console.log(`Enviando anúncio auto elétrica para: ${email}`);

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
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">⚡ Mechanic Raiz Pro</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Novidade para Auto Elétricas!</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 22px;">
                      Olá${nome ? `, ${nome}` : ''}! 👋
                    </h2>
                    
                    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      ${oficina_nome ? `Vimos que sua oficina <strong>"${oficina_nome}"</strong> trabalha com serviços elétricos e temos uma ótima notícia!` : 'Temos uma ótima notícia para você!'}
                    </p>
                    
                    <div style="background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%); border-left: 4px solid #FF7A00; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <h3 style="color: #EA580C; margin: 0 0 10px 0; font-size: 18px;">🔌 Suporte Completo para Auto Elétrica!</h3>
                      <p style="color: #9A3412; margin: 0; font-size: 14px; line-height: 1.6;">
                        O Mechanic Raiz Pro agora tem funcionalidades específicas para oficinas de auto elétrica, som automotivo e injeção eletrônica!
                      </p>
                    </div>
                    
                    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                      <strong>O que há de novo para você:</strong>
                    </p>
                    
                    <ul style="color: #4a4a4a; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0; padding-left: 20px;">
                      <li>⚡ <strong>Tipos de serviço específicos:</strong> Leitura OBD, Reparo de ECU, Instalação de Som/Alarme, Diagnóstico Eletrônico</li>
                      <li>🔧 <strong>Campos de diagnóstico:</strong> Códigos de falha OBD, resultado de testes, links para manuais técnicos</li>
                      <li>📦 <strong>Estoque especializado:</strong> Categorias para Componentes Elétricos, Módulos, Sensores, Relés e Fusíveis</li>
                      <li>📊 <strong>Dashboard adaptado:</strong> Lucro por diagnóstico, serviços elétricos do mês</li>
                      <li>🧾 <strong>Status especial:</strong> "Em Diagnóstico" para acompanhar análises técnicas</li>
                    </ul>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="https://mechanicraizpro.com.br/auth"
                         style="display: inline-block; background: linear-gradient(135deg, #FF7A00 0%, #FF9A40 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 12px rgba(255, 122, 0, 0.3);">
                        Acessar minha oficina →
                      </a>
                    </div>
                    
                    <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
                      <strong>Dica:</strong> Nas configurações, você pode alterar o tipo da sua oficina para "Auto Elétrica" e desbloquear todos os recursos!
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
                      Você recebeu este email porque sua oficina está cadastrada no Mechanic Raiz Pro.
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
        subject: "⚡ Novidade! Mechanic Raiz Pro agora com suporte completo para Auto Elétrica",
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Erro da API Resend:", errorText);
      throw new Error(`Erro ao enviar email: ${errorText}`);
    }

    const data = await res.json();
    console.log("Email de anúncio enviado com sucesso:", data);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Erro ao enviar email de anúncio:", error);
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
