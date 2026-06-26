import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';
import {
  parseReference,
  isValidPaymentId,
  decideFromStatus,
  validateAmountAgainstCatalog,
  decideIdempotency,
  decideFromSubscription,
  mask,
  type MpPayment,
} from './verifier.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN');

  if (!mpAccessToken) {
    console.error('[verify-payment-status] MP_ACCESS_TOKEN ausente');
    return jsonResponse(500, { error: 'Payment service not configured' });
  }

  // 1) AUTHN — require valid JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.warn('[verify-payment-status] acesso negado', { reason: 'missing_jwt' });
    return jsonResponse(401, { error: 'Não autorizado' });
  }
  const jwt = authHeader.slice(7);

  const authedClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await authedClient.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    console.warn('[verify-payment-status] acesso negado', { reason: 'invalid_jwt' });
    return jsonResponse(401, { error: 'Não autorizado' });
  }
  const userId = userData.user.id;

  // 2) Body — only payment_id is accepted from client
  let payment_id: unknown = null;
  try {
    const body = await req.json();
    payment_id = body?.payment_id ?? null;
  } catch {
    return jsonResponse(400, { error: 'Body inválido' });
  }
  if (!isValidPaymentId(payment_id)) {
    return jsonResponse(400, { error: 'payment_id inválido' });
  }
  const paymentIdStr = String(payment_id);

  // 3) Fetch payment from Mercado Pago
  const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentIdStr}`, {
    headers: { Authorization: `Bearer ${mpAccessToken}` },
  });
  if (!mpResp.ok) {
    console.warn('[verify-payment-status] MP fetch falhou', {
      payment_id: mask(paymentIdStr),
      http: mpResp.status,
    });
    return jsonResponse(502, { error: 'Falha ao consultar pagamento', status: 'unknown' });
  }
  const payment: MpPayment = await mpResp.json();

  // 4) Parse reference (server-side only — never trust client body)
  const parsed = parseReference(payment);

  if (parsed.tipo !== 'subscription') {
    console.warn('[verify-payment-status] não é assinatura', {
      payment_id: mask(paymentIdStr),
      tipo: parsed.tipo,
    });
    return jsonResponse(400, { error: 'Pagamento não é de assinatura' });
  }
  if (!parsed.oficinaId || !parsed.planType) {
    console.warn('[verify-payment-status] referência inválida', {
      payment_id: mask(paymentIdStr),
    });
    return jsonResponse(400, { error: 'Referência de pagamento inválida' });
  }

  // 5) AUTHZ — user must have access to the oficina from the payment
  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: accessData, error: accessErr } = await adminClient.rpc('has_oficina_access', {
    _user_id: userId,
    _oficina_id: parsed.oficinaId,
  });
  if (accessErr) {
    console.error('[verify-payment-status] erro has_oficina_access', { code: accessErr.code });
    return jsonResponse(500, { error: 'Erro de autorização' });
  }
  if (!accessData) {
    console.warn('[verify-payment-status] acesso negado', {
      reason: 'oficina_mismatch',
      payment_id: mask(paymentIdStr),
      user_id: mask(userId),
      oficina_id: mask(parsed.oficinaId),
    });
    return jsonResponse(403, { error: 'Sem acesso a este pagamento' });
  }

  // 6) Status gating
  const statusDecision = decideFromStatus(payment);
  if (statusDecision.action === 'reject_reversed') {
    console.info('[verify-payment-status] pagamento revertido', {
      payment_id: mask(paymentIdStr),
      status: statusDecision.status,
    });
    return jsonResponse(200, { status: statusDecision.status, activated: false });
  }
  if (statusDecision.action === 'not_approved') {
    return jsonResponse(200, {
      status: statusDecision.status,
      status_detail: payment.status_detail,
      activated: false,
    });
  }

  // 7) Validação de valor contra catálogo (fecha brecha de pagamentos antigos R$1/R$5)
  const catalogDecision = validateAmountAgainstCatalog(parsed, payment.transaction_amount);
  if (!catalogDecision.ok) {
    console.warn('[verify-payment-status] valor fora do catálogo', {
      payment_id: mask(paymentIdStr),
      reason: catalogDecision.reason,
      expected: catalogDecision.expected,
      actual: catalogDecision.actual,
    });
    return jsonResponse(200, {
      status: 'approved',
      activated: false,
      reason: catalogDecision.reason,
    });
  }

  // 8) Idempotência
  const { data: existingPayment } = await adminClient
    .from('pagamentos')
    .select('id, processed_at, oficina_id, status')
    .eq('mp_payment_id', paymentIdStr)
    .maybeSingle();

  if (decideIdempotency(existingPayment).action === 'skip_already_processed') {
    console.info('[verify-payment-status] já processado', { payment_id: mask(paymentIdStr) });
    return jsonResponse(200, {
      status: 'approved',
      activated: false,
      already_processed: true,
      plan_type: parsed.planType,
    });
  }

  // 9) Anti-reativação
  const { data: sub } = await adminClient
    .from('subscriptions')
    .select('id, status, plan_type, expires_at, canceled_at')
    .eq('oficina_id', parsed.oficinaId)
    .maybeSingle();

  const subDecision = decideFromSubscription(sub, parsed.planType);
  if (subDecision.action === 'reject_canceled') {
    console.warn('[verify-payment-status] assinatura cancelada — não reativando via verify', {
      payment_id: mask(paymentIdStr),
      oficina_id: mask(parsed.oficinaId),
    });
    return jsonResponse(200, {
      status: 'approved',
      activated: false,
      reason: 'subscription_canceled',
    });
  }
  if (subDecision.action === 'noop_already_active') {
    return jsonResponse(200, {
      status: 'approved',
      activated: true,
      already_active: true,
      plan_type: parsed.planType,
    });
  }

  // 10) Ativação fallback
  const subscriptionData = {
    plan_type: parsed.planType,
    status: 'active',
    started_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    canceled_at: null,
    trial_ends_at: null,
  };

  if (subDecision.mode === 'update') {
    const { error: updErr } = await adminClient
      .from('subscriptions')
      .update(subscriptionData)
      .eq('oficina_id', parsed.oficinaId);
    if (updErr) console.error('[verify-payment-status] update sub falhou', { code: updErr.code });
  } else {
    const { error: insErr } = await adminClient
      .from('subscriptions')
      .insert({ oficina_id: parsed.oficinaId, ...subscriptionData });
    if (insErr) console.error('[verify-payment-status] insert sub falhou', { code: insErr.code });
  }

  console.info('[verify-payment-status] assinatura ativada via fallback', {
    payment_id: mask(paymentIdStr),
    oficina_id: mask(parsed.oficinaId),
  });

  return jsonResponse(200, {
    status: 'approved',
    activated: true,
    plan_type: parsed.planType,
  });
});
