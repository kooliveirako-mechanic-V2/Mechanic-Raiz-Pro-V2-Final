import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { resolveSubscription, buildResolvedSubscription } from "./resolver.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface PlanItem {
  id?: string;
  title: string;
  description: string;
  unit_price: number;
  quantity: number;
  category_id?: string;
}

interface PreferenceRequest {
  items: PlanItem[];
  payer?: {
    email?: string;
    name?: string;
  };
  external_reference?: string;
  oficina_id?: string;
  orcamento_id?: string;
  metadata?: Record<string, unknown>;
  type?: 'subscription' | 'orcamento' | 'payment';
  plan_type?: string;
}

// ═══════════════════════════════════════════════════════════════════
// IN-MEMORY RATE LIMITING
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

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ═══════════════════════════════════════════════════════════════════
    // AUTHENTICATION: Verify the user is logged in
    // ═══════════════════════════════════════════════════════════════════
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;

    // ═══════════════════════════════════════════════════════════════════
    // RATE LIMITING: 10 requests per minute per user
    // ═══════════════════════════════════════════════════════════════════
    if (!checkRateLimit(`mp-pref:${userId}`, 10, 60_000)) {
      return new Response(
        JSON.stringify({ error: 'Muitas requisições. Tente novamente em 1 minuto.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } }
      );
    }

    const accessToken = Deno.env.get('MP_ACCESS_TOKEN');
    
    if (!accessToken) {
      console.error('MP_ACCESS_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Serviço de pagamento indisponível' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate body size
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 10240) {
      return new Response(
        JSON.stringify({ error: 'Requisição muito grande' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: PreferenceRequest & { plan_key?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Payload inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > 20) {
      return new Response(
        JSON.stringify({ error: 'Items inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════════════════════════════
    // SUBSCRIPTION SERVER-SIDE CATALOG (Correction 1 / 1.1)
    // Resolver is a pure module (resolver.ts) and has its own unit tests.
    // ═══════════════════════════════════════════════════════════════════
    const paymentType = body.type || 'payment';
    let resolvedPlanKey: string | null = null;

    if (paymentType === 'subscription') {
      const resolved = resolveSubscription({
        plan_key: body.plan_key,
        plan_type: body.plan_type,
        metadata: body.metadata as Record<string, unknown> | undefined,
        items: body.items as Array<{ unit_price?: unknown }>,
      });

      if (!resolved.ok) {
        console.error('Subscription rejected', { code: resolved.code, candidateKey: resolved.candidateKey });
        return new Response(
          JSON.stringify({ error: resolved.message }),
          { status: resolved.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Safe divergence log — no PII, no payload, just price comparison.
      if (resolved.priceDivergent) {
        console.warn('[mp-create-preference] unit_price divergente ignorado', {
          plan_key: resolved.planKey,
          client_unit_price: resolved.clientUnitPrice,
          catalog_unit_price: resolved.entry.unit_price,
        });
      }

      resolvedPlanKey = resolved.planKey;
      const built = buildResolvedSubscription(resolved, (body.metadata || {}) as Record<string, unknown>);
      body.items = [built.item];
      body.plan_type = built.plan_type;
      body.metadata = built.metadata;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ITEM VALIDATION (after subscription override)
    // Non-subscription flows still use client prices (out of scope here),
    // but bounds remain enforced. Subscription items are server-trusted.
    // ═══════════════════════════════════════════════════════════════════
    for (const item of body.items) {
      if (typeof item.unit_price !== 'number' || item.unit_price < 0 || item.unit_price > 100000) {
        return new Response(
          JSON.stringify({ error: 'Valor do item inválido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (typeof item.quantity !== 'number' || item.quantity < 1 || item.quantity > 100) {
        return new Response(
          JSON.stringify({ error: 'Quantidade inválida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (typeof item.title !== 'string' || item.title.length > 255) {
        return new Response(
          JSON.stringify({ error: 'Título do item inválido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate UUIDs if provided
    if (body.oficina_id && !UUID_REGEX.test(body.oficina_id)) {
      return new Response(
        JSON.stringify({ error: 'ID da oficina inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (body.orcamento_id && !UUID_REGEX.test(body.orcamento_id)) {
      return new Response(
        JSON.stringify({ error: 'ID do orçamento inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (paymentType === 'subscription' && !body.oficina_id) {
      return new Response(
        JSON.stringify({ error: 'oficina_id é obrigatório para assinatura' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════════════════════════════
    // AUTHORIZATION: Verify user has access to the oficina
    // ═══════════════════════════════════════════════════════════════════
    if (body.oficina_id) {
      const { data: oficina, error: oficinaError } = await supabaseAuth
        .from('oficinas')
        .select('id')
        .eq('id', body.oficina_id)
        .maybeSingle();

      if (oficinaError || !oficina) {
        return new Response(
          JSON.stringify({ error: 'Oficina não encontrada ou sem permissão' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const origin = 'https://www.mechanicraizpro.com.br';

    let externalReference: string;

    if (paymentType === 'subscription' && body.oficina_id && body.plan_type) {
      // shape preserved for webhook + verify-payment-status compatibility
      externalReference = `subscription:${body.oficina_id}:${body.plan_type}`;
    } else if (paymentType === 'orcamento' && body.oficina_id && body.orcamento_id) {
      externalReference = `orcamento:${body.oficina_id}:${body.orcamento_id}`;
    } else if (body.external_reference && typeof body.external_reference === 'string' && body.external_reference.length <= 255) {
      externalReference = body.external_reference;
    } else {
      externalReference = `payment:${body.oficina_id || 'unknown'}:${Date.now()}`;
    }

    // Get user email from auth claims as fallback (Pix REQUIRES valid payer email)
    const userEmail = (claimsData.claims.email as string | undefined) || body.payer?.email;
    
    if (!userEmail || !userEmail.includes('@')) {
      console.error('No valid payer email — Pix will be disabled');
      return new Response(
        JSON.stringify({ error: 'Email do pagador é obrigatório para gerar pagamento via Pix' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // NÃO enviamos expires/expiration_date_to.
    // Histórico do bug: qualquer manipulação manual do offset (-03:00 vs Z)
    // já fez o MP marcar a preferência como preference_expired=true de forma
    // intermitente — o que desabilita o botão Pix sem mostrar erro ao usuário.
    // Sintoma observado: Pix funcionava no Safari em uma tentativa e ficava
    // cinza na próxima (PWA, segunda tentativa, etc.) dependendo do horário.
    // Deixar o MP usar o default (30 dias) elimina toda essa classe de bug;
    // a janela real do Pix (24h) continua sendo controlada pelo próprio MP.

    // Split payer name into first/last for MP fraud-prevention scoring.
    // MP recomenda payer.first_name e payer.last_name separados (não só "name").
    const fullName = (body.payer?.name || '').trim();
    const nameParts = fullName ? fullName.split(/\s+/) : [];
    const firstName = (nameParts[0] || 'Cliente').slice(0, 100);
    const lastName = (nameParts.slice(1).join(' ') || 'MechanicRaiz').slice(0, 100);

    // Stable item ID — MP prefers a stable product identifier (not random per call)
    // for fraud scoring and reconciliation. Falls back to a deterministic slug.
    const stableItemId = (raw: string) =>
      raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
         .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64) || 'item';

    const preferencePayload: Record<string, unknown> = {
      items: body.items.map(item => ({
        id: (item.id || stableItemId(item.title)).slice(0, 64),
        title: item.title.slice(0, 255),
        description: (item.description || item.title).slice(0, 255),
        category_id: item.category_id || 'services',
        unit_price: Number(item.unit_price.toFixed(2)),
        quantity: item.quantity,
        currency_id: 'BRL',
      })),
      payer: {
        email: userEmail.slice(0, 255),
        first_name: firstName,
        last_name: lastName,
      },
      back_urls: {
        success: `${origin}/pagamento/sucesso`,
        failure: `${origin}/pagamento/falha`,
        pending: `${origin}/pagamento/pendente`,
      },
      // auto_return removido: exige domínio verificado na conta MP;
      // quando não está, o MP desabilita Pix silenciosamente.
      external_reference: externalReference,
      metadata: {
        tipo: paymentType,
        oficina_id: body.oficina_id,
        orcamento_id: body.orcamento_id,
        plan_type: body.plan_type,
        plan_key: resolvedPlanKey ?? undefined,
        original_plan: (body.metadata as any)?.original_plan,
        billing_cycle: (body.metadata as any)?.billing_cycle,
      },
      notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        installments: 12,
        default_installments: 1,
      },
      statement_descriptor: 'MECHANICRAIZ',
      binary_mode: false,
      // Sem `expires`/`expiration_date_to`: MP usa default (30 dias),
      // o que evita o bug de timezone que desabilitava o Pix de forma intermitente.
    };

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferencePayload),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('MP preference creation failed:', mpResponse.status, JSON.stringify(mpData));
      return new Response(
        JSON.stringify({ error: 'Erro ao criar preferência de pagamento', mp_status: mpResponse.status, mp_error: mpData?.message || mpData?.error || 'unknown' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Preference created:', mpData.id);

    return new Response(
      JSON.stringify({
        id: mpData.id,
        init_point: mpData.init_point,
        sandbox_init_point: mpData.sandbox_init_point,
        external_reference: externalReference,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error creating preference');
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
