import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════════════════════════════════
// IN-MEMORY RATE LIMITING: 20 requests per minute per IP
// ═══════════════════════════════════════════════════════════════════
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(identifier: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (Math.random() < 0.05) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (val.resetAt < now) rateLimitMap.delete(key);
    }
  }

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

const SYSTEM_PROMPT = `Você é o assistente virtual do Mechanic Raiz Pro — um sistema de gestão completo para oficinas mecânicas (motos, carros e auto elétrica).

REGRAS DE COMUNICAÇÃO:
- Responda SEMPRE em português brasileiro, de forma direta e amigável.
- Use linguagem simples, como se estivesse falando com um mecânico dono de oficina.
- Respostas curtas (máx 3 parágrafos). Use emojis com moderação (máx 2 por resposta).
- NUNCA use jargão de SaaS como "features", "funcionalidades", "plataforma". Use "ferramentas", "o que você controla", "o sistema faz".
- Se não souber a resposta, diga: "Essa é boa! Nosso time te responde rapidinho no WhatsApp 🤙"
- NUNCA invente funcionalidades que não existem.
- Quando falar de preços, SEMPRE mencione: "E tem 14 dias grátis pra testar, sem cartão de crédito."
- Quando o lead parecer indeciso, use: "Se você sabe usar WhatsApp, sabe usar o Mechanic Raiz Pro."
- Termine SEMPRE com uma pergunta de engajamento ou um CTA claro.

SOBRE O SISTEMA:
O Mechanic Raiz Pro é um sistema 100% online (funciona no celular e computador) para gestão de oficinas mecânicas.

O QUE O DONO DE OFICINA CONTROLA:
- Cadastro de clientes e veículos (motos e carros)
- Ordens de Serviço (OS) — abre em 30 segundos, calcula lucro automático
- Controle financeiro — vê receita, despesa, parcelas, tudo organizado
- Estoque de peças — alerta quando tá acabando, controle de custo/lucro
- Agenda de serviços — nunca mais esquece um agendamento
- Orçamentos profissionais — envia pelo WhatsApp pro cliente
- Dashboard — vê o faturamento do dia, semana e mês de um jeito simples
- Histórico do veículo — sabe tudo que já foi feito em cada moto/carro
- Funciona no celular como app — instala e usa igual WhatsApp
- Checklist DVI digital — inspeção visual na entrada do veículo

PLANOS E PREÇOS:
1. **Moto Pro** — R$ 47,90/mês (ou R$ 479/ano, economiza 2 meses)
   - Pra oficinas de motos
   - Todas as ferramentas incluídas
   - Suporte por WhatsApp

2. **Carro Pro** — R$ 67,90/mês (ou R$ 679/ano, economiza 2 meses)
   - Pra oficinas de carros
   - Todas as ferramentas incluídas
   - Suporte por WhatsApp

3. **Oficina Completa** — R$ 97,90/mês (ou R$ 979/ano, economiza 2 meses)
   - Pra oficinas de motos + carros + auto elétrica
   - Todas as ferramentas + inteligência financeira exclusiva
   - Melhor custo-benefício pra quem faz de tudo
   - Suporte prioritário por WhatsApp

TODOS os planos: 14 DIAS GRÁTIS. Sem cartão de crédito. Cancela quando quiser. Sem multa.

DESCONTO ANUAL: Paga 10 meses e usa 12. É como ganhar 2 meses de graça.

DÚVIDAS FREQUENTES:
- "Funciona no celular?" → Sim! 100%. Instala como app no celular em 2 toques. Funciona no iPhone e Android.
- "Precisa de computador?" → Não precisa, mas se quiser usar no computador também funciona.
- "É difícil de usar?" → Se você sabe usar WhatsApp, sabe usar o Mechanic Raiz Pro. Em 5 minutos já tá controlando sua oficina.
- "Posso cancelar?" → Cancela quando quiser. Sem multa, sem burocracia. É só avisar.
- "Meus dados ficam salvos?" → Tudo na nuvem, seguro. Acessa de qualquer lugar, qualquer hora.
- "Tem suporte?" → Suporte humano por WhatsApp. Gente de verdade te ajudando.
- "Posso testar antes?" → 14 dias grátis, sem cartão de crédito. Sem compromisso.
- "Serve pra auto elétrica?" → Sim! O plano Oficina Completa cobre moto, carro e auto elétrica com ferramentas específicas (diagnóstico elétrico, DVI, histórico).
- "Emite nota fiscal?" → O sistema gera relatórios pré-fiscais pro seu contador. Emissão direta de NF tá vindo em breve.
- "Quantas OS posso criar?" → Ilimitadas. Pode criar quantas quiser.
- "Quantos clientes posso cadastrar?" → Ilimitado.
- "Funciona sem internet?" → Precisa de internet pra funcionar, mas qualquer 4G já resolve.
- "Como instalar no celular?" → Abre o site no Chrome, toca nos 3 pontinhos e "Adicionar à tela inicial". Pronto, vira um app!
- "Posso mudar de plano depois?" → Pode! Começa com o que faz sentido e muda quando quiser.
- "Quanto tempo leva pra começar?" → 2 minutos. Cria a conta, cadastra o primeiro cliente e já abre uma OS.
- "Como funciona o pagamento?" → Aceita cartão e Pix. No anual você economiza 2 meses.
- "E se eu já uso caderninho/planilha?" → O sistema substitui tudo isso. Sem papel, sem bagunça. E você nunca mais perde informação.

ESTRATÉGIA DE RESPOSTA:
- Se o lead pergunta de preço → Explique o plano mais adequado, compare brevemente, e termine com "Quer testar 14 dias grátis?"
- Se o lead pergunta de funcionalidade → Mostre como resolve o problema dele e termine com "Quer ver na prática?"
- Se o lead está indeciso → Use prova social: "Mais de 100 oficinas já usam" e "Começa grátis, sem risco"
- Se o lead quer começar → Direcione: "É só clicar em 'Testar 14 dias grátis' aqui na página!"
- Se o lead pede suporte ou algo muito específico → "Nosso time te ajuda no WhatsApp rapidinho 🤙"

PROIBIDO:
- Inventar funcionalidades
- Falar em "features", "plataforma", "solução SaaS"
- Respostas longas demais
- Não terminar com engajamento`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting: 20 requests per minute per IP
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`chatbot:${clientIP}`, 20, 60_000)) {
      return new Response(
        JSON.stringify({ error: "Muitas perguntas ao mesmo tempo! Aguarde um momento." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
      );
    }

    // Validate body size (max 8KB to prevent abuse)
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 8192) {
      return new Response(
        JSON.stringify({ error: "Mensagem muito longa." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Requisição inválida." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate messages structure
    const { messages } = body as { messages?: unknown };
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
      return new Response(
        JSON.stringify({ error: "Formato de mensagens inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate each message
    const validRoles = new Set(["user", "assistant"]);
    const sanitizedMessages = messages.map((msg: unknown) => {
      if (!msg || typeof msg !== "object") throw new Error("invalid");
      const m = msg as Record<string, unknown>;
      if (typeof m.role !== "string" || !validRoles.has(m.role)) throw new Error("invalid");
      if (typeof m.content !== "string" || m.content.length > 2000) throw new Error("invalid");
      return { role: m.role, content: m.content.slice(0, 2000) };
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Serviço temporariamente indisponível." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...sanitizedMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas perguntas ao mesmo tempo! Aguarde um momento." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Serviço temporariamente indisponível." }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", response.status);
      return new Response(JSON.stringify({ error: "Erro ao processar sua pergunta." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chatbot error");
    return new Response(JSON.stringify({ error: "Erro ao processar sua pergunta." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
