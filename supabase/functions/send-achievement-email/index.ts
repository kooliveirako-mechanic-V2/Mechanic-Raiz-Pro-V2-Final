import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Marcos de conquista
const ACHIEVEMENT_MILESTONES = [10, 25, 50, 100, 250, 500, 1000];

interface AchievementRequest {
  oficina_id: string;
  tipo: 'estoque' | 'clientes' | 'veiculos' | 'ordens_servico';
  quantidade_atual: number;
}

const getAchievementConfig = (tipo: string, quantidade: number) => {
  const configs: Record<string, { emoji: string; titulo: string; descricao: string; proximo_desafio: string }> = {
    estoque: {
      emoji: "📦",
      titulo: "PRODUTOS",
      descricao: `Isso significa que quando você criar uma OS ou orçamento, vai ter <strong>${quantidade} peças prontas</strong> pra selecionar — sem digitar nada, sem erro de preço, com lucro calculado automaticamente.`,
      proximo_desafio: "Cadastre mais clientes + veículos e crie suas primeiras OS!\nAssim você libera o Dashboard de Lucro completo 📊"
    },
    clientes: {
      emoji: "👥",
      titulo: "CLIENTES",
      descricao: `Sua base de clientes está crescendo! Com <strong>${quantidade} clientes</strong> cadastrados, você tem um potencial enorme de fidelização e retorno.`,
      proximo_desafio: "Cadastre os veículos de cada cliente e crie lembretes de manutenção!\nAssim você nunca perde uma oportunidade de serviço 🔧"
    },
    veiculos: {
      emoji: "🏍️",
      titulo: "VEÍCULOS",
      descricao: `Com <strong>${quantidade} veículos</strong> cadastrados, você tem um histórico completo de cada máquina que passa pela sua oficina.`,
      proximo_desafio: "Configure lembretes de manutenção preventiva!\nAssim os clientes voltam automaticamente 🔄"
    },
    ordens_servico: {
      emoji: "🔧",
      titulo: "ORDENS DE SERVIÇO",
      descricao: `Você já completou <strong>${quantidade} OS</strong>! Isso mostra que sua oficina está produzindo e faturando.`,
      proximo_desafio: "Confira seu Dashboard de Lucro para ver onde você mais ganha!\nOtimize seus serviços mais rentáveis 💰"
    }
  };
  return configs[tipo] || configs.estoque;
};

const getPercentileMessage = (quantidade: number): string => {
  if (quantidade >= 500) return "à frente de 99% das oficinas";
  if (quantidade >= 250) return "à frente de 98% das oficinas";
  if (quantidade >= 100) return "à frente de 95% das oficinas";
  if (quantidade >= 50) return "à frente de 90% das oficinas";
  if (quantidade >= 25) return "à frente de 80% das oficinas";
  if (quantidade >= 10) return "à frente de 70% das oficinas";
  return "no caminho certo";
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { oficina_id, tipo, quantidade_atual }: AchievementRequest = await req.json();

    console.log(`Verificando conquista: oficina=${oficina_id}, tipo=${tipo}, quantidade=${quantidade_atual}`);

    // Verificar se bateu algum marco
    const marco_atingido = ACHIEVEMENT_MILESTONES.find(m => m === quantidade_atual);
    
    if (!marco_atingido) {
      console.log(`Quantidade ${quantidade_atual} não é um marco de conquista`);
      return new Response(
        JSON.stringify({ success: true, message: "Não é um marco de conquista" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`🎉 Marco atingido: ${marco_atingido} ${tipo}!`);

    // Buscar dados da oficina e usuário
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const { data: oficina, error: oficinaError } = await supabase
      .from('oficinas')
      .select('id, nome, user_id')
      .eq('id', oficina_id)
      .single();

    if (oficinaError || !oficina) {
      console.error("Erro ao buscar oficina:", oficinaError);
      throw new Error("Oficina não encontrada");
    }

    // Buscar email do usuário
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(oficina.user_id);

    if (userError || !userData?.user?.email) {
      console.error("Erro ao buscar usuário:", userError);
      throw new Error("Email do usuário não encontrado");
    }

    const userEmail = userData.user.email;
    const userName = oficina.nome.split(' ')[0]; // Primeiro nome da oficina
    
    const config = getAchievementConfig(tipo, quantidade_atual);
    const percentileMsg = getPercentileMessage(quantidade_atual);

    console.log(`Enviando email de conquista para: ${userEmail}`);

    // Montar HTML do email
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0E1B2A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0E1B2A; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px;">
          
          <!-- Header com gradiente -->
          <tr>
            <td style="background: linear-gradient(135deg, #FF7A18 0%, #FF9A3D 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
                🏆 CONQUISTA DESBLOQUEADA!
              </h1>
            </td>
          </tr>
          
          <!-- Corpo do email -->
          <tr>
            <td style="background-color: #1A2D42; padding: 40px 30px; border-radius: 0 0 16px 16px;">
              
              <!-- Saudação -->
              <p style="color: #E5E7EB; font-size: 18px; margin: 0 0 20px 0;">
                E aí, <strong style="color: #FF7A18;">${userName}!</strong> 👊
              </p>
              
              <p style="color: #9CA3AF; font-size: 16px; margin: 0 0 30px 0;">
                Cara, eu precisava te mandar essa mensagem pessoalmente...
              </p>
              
              <!-- Card de conquista -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #0077B6 0%, #00A8E8 100%); border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 30px; text-align: center;">
                    <h2 style="color: white; margin: 0; font-size: 48px; font-weight: bold;">
                      +${quantidade_atual} ${config.titulo}
                    </h2>
                    <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0; font-size: 16px;">
                      cadastrados no seu ${tipo === 'estoque' ? 'estoque' : 'sistema'} ${config.emoji}
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Mensagem de percentil -->
              <p style="color: #E5E7EB; font-size: 16px; margin: 0 0 20px 0;">
                Você tá <strong style="color: #10B981;">${percentileMsg}</strong> que usam o sistema! 🚀
              </p>
              
              <!-- Descrição -->
              <p style="color: #9CA3AF; font-size: 15px; line-height: 1.6; margin: 0 0 30px 0;">
                ${config.descricao}
              </p>
              
              <!-- Card próximo desafio -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: rgba(255, 122, 24, 0.1); border: 1px solid rgba(255, 122, 24, 0.3); border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="color: #FF7A18; font-size: 14px; font-weight: bold; margin: 0 0 10px 0;">
                      🎯 PRÓXIMO DESAFIO:
                    </p>
                    <p style="color: #E5E7EB; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-line;">
                      ${config.proximo_desafio}
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Mensagem motivacional -->
              <p style="color: #E5E7EB; font-size: 16px; margin: 0 0 30px 0;">
                Continue assim que a <strong style="color: #FF7A18;">${oficina.nome}</strong> vai dominar! 💪
              </p>
              
              <!-- Footer -->
              <p style="color: #6B7280; font-size: 14px; margin: 0 0 5px 0;">
                Qualquer dúvida, é só chamar no WhatsApp.
              </p>
              <p style="color: #6B7280; font-size: 14px; margin: 0 0 20px 0;">
                Tamo junto!
              </p>
              
              <p style="color: #9CA3AF; font-size: 14px; margin: 0; font-weight: bold;">
                — Equipe Mechanic Raiz Pro 🔧
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

    // Enviar email via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Mechanic Raiz Pro <suporte@mechanicraizpro.com.br>",
        to: [userEmail],
        subject: `🏆 Conquista Desbloqueada: +${quantidade_atual} ${config.titulo}!`,
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Erro da API Resend:", errorText);
      throw new Error(`Erro ao enviar email: ${errorText}`);
    }

    const data = await res.json();
    console.log(`✅ Email de conquista enviado com sucesso para ${userEmail}:`, data);

    // Criar notificação no sistema também
    await supabase.from('notificacoes').insert({
      oficina_id,
      tipo: 'conquista',
      titulo: `🏆 ${quantidade_atual} ${config.titulo}!`,
      mensagem: `Parabéns! Você atingiu ${quantidade_atual} ${tipo.replace('_', ' ')} cadastrados!`
    });

    return new Response(
      JSON.stringify({ success: true, marco: marco_atingido, email_enviado: userEmail }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Erro ao processar conquista:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
