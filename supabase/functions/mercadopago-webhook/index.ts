import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { createHmac } from "https://deno.land/std@0.224.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ═══════════════════════════════════════════════════════════════════
// SCHEMA VALIDATION - Validate incoming webhook payloads
// ═══════════════════════════════════════════════════════════════════
const WebhookPayloadSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  live_mode: z.boolean().optional(),
  type: z.string(),
  date_created: z.string().optional(),
  user_id: z.union([z.string(), z.number()]).optional(),
  api_version: z.string().optional(),
  action: z.string().optional(),
  data: z.object({
    id: z.union([z.string(), z.number()]).transform(val => String(val)),
  }),
})

type WebhookPayload = z.infer<typeof WebhookPayloadSchema>

interface PaymentDetails {
  id: number
  status: string
  status_detail: string
  external_reference: string | null
  transaction_amount: number
  payment_method_id: string
  payment_type_id: string
  payer: {
    email: string
    first_name?: string
    last_name?: string
  }
  preference_id?: string
  additional_info?: {
    items?: Array<{
      id: string
      title: string
    }>
  }
  metadata?: {
    tipo?: string
    oficina_id?: string
    orcamento_id?: string
    plan_type?: string
    billing_cycle?: string
  }
}

// Payment types
type PaymentType = 'subscription' | 'orcamento' | 'payment' | 'unknown'

interface ParsedReference {
  tipo: PaymentType
  oficinaId: string | null
  orcamentoId: string | null
  planType: string | null
  billingCycle: string | null
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str)
}

function sanitizeString(str: string): string {
  return str.replace(/[<>\"'\\]/g, '').trim().slice(0, 255)
}

// ═══════════════════════════════════════════════════════════════════
// P0-1: SIGNATURE VALIDATION - Verify Mercado Pago x-signature
// ═══════════════════════════════════════════════════════════════════
async function validateMPSignature(req: Request, dataId: string): Promise<boolean> {
  const mpWebhookSecret = Deno.env.get('MP_WEBHOOK_SECRET')
  
  // SECURITY: Reject ALL webhooks if secret is not configured
  if (!mpWebhookSecret) {
    console.error('🚨 CRITICAL: MP_WEBHOOK_SECRET not configured - rejecting webhook for security!')
    return false
  }

  // 🔍 DIAGNÓSTICO TEMPORÁRIO: hash dos últimos 4 chars para confirmar match (sem expor secret)
  {
    const last4 = mpWebhookSecret.slice(-4)
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(last4))
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    console.log(`🔑 [DIAG] secret_len=${mpWebhookSecret.length} sha256_of_last4_first16=${hex.slice(0, 16)}`)
  }

  const xSignature = req.headers.get('x-signature')
  const xRequestId = req.headers.get('x-request-id')

  if (!xSignature || !xRequestId) {
    console.error('❌ Missing x-signature or x-request-id headers')
    return false
  }

  // Parse x-signature header: "ts=TIMESTAMP,v1=HASH"
  const parts: Record<string, string> = {}
  for (const part of xSignature.split(',')) {
    const [key, value] = part.split('=', 2)
    if (key && value) {
      parts[key.trim()] = value.trim()
    }
  }

  const ts = parts['ts']
  const v1 = parts['v1']

  if (!ts || !v1) {
    console.error('❌ Invalid x-signature format:', xSignature)
    return false
  }

  // Build the manifest string per MP docs:
  // id:{data.id};request-id:{x-request-id};ts:{ts};
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`

  // HMAC-SHA256 with the webhook secret
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(mpWebhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(manifest))
  const computedHash = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  if (computedHash !== v1) {
    console.error('❌ Signature mismatch! Expected:', v1, 'Got:', computedHash)
    return false
  }

  console.log('✅ Webhook signature validated successfully')
  return true
}

function parseExternalReference(ref: string | null, metadata?: PaymentDetails['metadata']): ParsedReference {
  // First try to get from metadata
  if (metadata?.tipo) {
    const oficinaId = metadata.oficina_id && isValidUUID(metadata.oficina_id) ? metadata.oficina_id : null
    const orcamentoId = metadata.orcamento_id && isValidUUID(metadata.orcamento_id) ? metadata.orcamento_id : null
    
    return {
      tipo: metadata.tipo as PaymentType,
      oficinaId,
      orcamentoId,
      planType: metadata.plan_type ? sanitizeString(metadata.plan_type) : null,
      billingCycle: metadata.billing_cycle ? sanitizeString(metadata.billing_cycle) : null,
    }
  }

  if (!ref) {
    return { tipo: 'unknown', oficinaId: null, orcamentoId: null, planType: null, billingCycle: null }
  }

  const sanitizedRef = sanitizeString(ref)
  const parts = sanitizedRef.split(':')
  
  if (parts[0] === 'subscription' && parts.length >= 3) {
    return {
      tipo: 'subscription',
      oficinaId: isValidUUID(parts[1]) ? parts[1] : null,
      orcamentoId: null,
      planType: parts[2] || null,
      billingCycle: null, // Will be determined from payment amount
    }
  }
  
  if (parts[0] === 'orcamento' && parts.length >= 3) {
    return {
      tipo: 'orcamento',
      oficinaId: isValidUUID(parts[1]) ? parts[1] : null,
      orcamentoId: isValidUUID(parts[2]) ? parts[2] : null,
      planType: null,
      billingCycle: null,
    }
  }

  if (parts[0] === 'payment' && parts.length >= 2) {
    return {
      tipo: 'payment',
      oficinaId: isValidUUID(parts[1]) ? parts[1] : null,
      orcamentoId: null,
      planType: null,
      billingCycle: null,
    }
  }
  
  if (parts.length >= 2 && isValidUUID(parts[0]) && isValidUUID(parts[1])) {
    return {
      tipo: 'orcamento',
      oficinaId: parts[0],
      orcamentoId: parts[1],
      planType: null,
      billingCycle: null,
    }
  }

  return {
    tipo: 'unknown',
    oficinaId: isValidUUID(parts[0]) ? parts[0] : null,
    orcamentoId: null,
    planType: null,
    billingCycle: null,
  }
}

// ═══════════════════════════════════════════════════════════════════
// P0-2: Calculate correct expiry based on billing cycle
// Monthly plans: 30 days, Annual plans: 365 days
// ═══════════════════════════════════════════════════════════════════
function calculateExpiryDate(billingCycle: string | null, transactionAmount: number, planType: string | null): Date {
  // Known annual price thresholds per plan
  const ANNUAL_PRICE_THRESHOLD = 200 // Any payment above R$200 is likely annual
  
  const isAnnual = billingCycle === 'annual' || transactionAmount >= ANNUAL_PRICE_THRESHOLD
  
  const now = new Date()
  if (isAnnual) {
    // 365 days for annual plans
    return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
  }
  // 30 days for monthly plans
  return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')

  if (!mpAccessToken) {
    console.error('❌ MP_ACCESS_TOKEN not configured')
    return new Response(
      JSON.stringify({ error: 'Payment service not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // ═══════════════════════════════════════════════════════════════════
    // PARSE AND VALIDATE WEBHOOK PAYLOAD
    // ═══════════════════════════════════════════════════════════════════
    let rawPayload: unknown
    try {
      rawPayload = await req.json()
    } catch {
      console.error('❌ Invalid JSON in request body')
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const parseResult = WebhookPayloadSchema.safeParse(rawPayload)
    
    if (!parseResult.success) {
      console.error('❌ Invalid webhook payload structure:', parseResult.error.errors)
      return new Response(
        JSON.stringify({ error: 'Invalid payload structure', details: parseResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payload: WebhookPayload = parseResult.data

    // ═══════════════════════════════════════════════════════════════════
    // P0-1: VALIDATE SIGNATURE BEFORE PROCESSING
    // ═══════════════════════════════════════════════════════════════════
    const signatureValid = await validateMPSignature(req, payload.data.id)
    if (!signatureValid) {
      console.error('🚨 SECURITY: Invalid webhook signature rejected!')
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('📥 Webhook received:', JSON.stringify({
      type: payload.type,
      action: payload.action,
      data_id: payload.data?.id,
      date: payload.date_created
    }))

    // Only process payment notifications
    if (payload.type !== 'payment') {
      console.log(`⏭️ Ignoring non-payment event: ${payload.type}`)
      return new Response(
        JSON.stringify({ received: true, processed: false, reason: 'Not a payment event' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const paymentId = payload.data.id

    // ═══════════════════════════════════════════════════════════════════
    // IDEMPOTENCY CHECK
    // ═══════════════════════════════════════════════════════════════════
    const { data: existingPayment } = await supabase
      .from('pagamentos')
      .select('id, status, processed_at')
      .eq('mp_payment_id', paymentId)
      .maybeSingle()

    if (existingPayment?.processed_at && existingPayment.status === 'approved') {
      console.log(`⚠️ Payment ${paymentId} already processed at ${existingPayment.processed_at}`)
      return new Response(
        JSON.stringify({ received: true, processed: false, reason: 'Already processed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ═══════════════════════════════════════════════════════════════════
    // FETCH REAL PAYMENT STATUS FROM MERCADO PAGO
    // ═══════════════════════════════════════════════════════════════════
    console.log(`🔍 Fetching payment details for ID: ${paymentId}`)
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
      },
    })

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text()
      console.error(`❌ Failed to fetch payment from MP: ${mpResponse.status} - ${errorText}`)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch payment details' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const paymentDetails: PaymentDetails = await mpResponse.json()
    
    // ═══════════════════════════════════════════════════════════════════
    // VALIDATE PAYMENT AMOUNT
    // ═══════════════════════════════════════════════════════════════════
    if (typeof paymentDetails.transaction_amount !== 'number' || 
        paymentDetails.transaction_amount < 0 || 
        paymentDetails.transaction_amount > 1000000) {
      console.error(`❌ Invalid transaction amount: ${paymentDetails.transaction_amount}`)
      return new Response(
        JSON.stringify({ error: 'Invalid transaction amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('💳 Payment details:', JSON.stringify({
      id: paymentDetails.id,
      status: paymentDetails.status,
      status_detail: paymentDetails.status_detail,
      amount: paymentDetails.transaction_amount,
      external_reference: paymentDetails.external_reference,
      payer_email: paymentDetails.payer?.email,
      metadata: paymentDetails.metadata
    }))

    const statusMap: Record<string, string> = {
      approved: 'approved',
      pending: 'pending',
      authorized: 'pending',
      in_process: 'pending',
      in_mediation: 'pending',
      rejected: 'rejected',
      cancelled: 'cancelled',
      refunded: 'refunded',
      charged_back: 'charged_back',
    }

    const mappedStatus = statusMap[paymentDetails.status] || 'unknown'

    const refData = parseExternalReference(paymentDetails.external_reference, paymentDetails.metadata)
    console.log('📋 Parsed reference:', JSON.stringify(refData))

    // ═══════════════════════════════════════════════════════════════════
    // SAVE PAYMENT RECORD
    // ═══════════════════════════════════════════════════════════════════
    const paymentRecord = {
      mp_payment_id: paymentId,
      mp_preference_id: paymentDetails.preference_id || null,
      external_reference: paymentDetails.external_reference,
      status: mappedStatus,
      status_detail: paymentDetails.status_detail,
      valor: paymentDetails.transaction_amount,
      metodo_pagamento: `${paymentDetails.payment_type_id}:${paymentDetails.payment_method_id}`,
      payer_email: paymentDetails.payer?.email,
      payer_name: [paymentDetails.payer?.first_name, paymentDetails.payer?.last_name].filter(Boolean).join(' ') || null,
      raw_data: paymentDetails,
      processed_at: mappedStatus === 'approved' ? new Date().toISOString() : null,
      oficina_id: refData.oficinaId,
      orcamento_id: refData.tipo === 'orcamento' ? refData.orcamentoId : null,
    }

    let result
    if (existingPayment) {
      console.log(`📝 Updating existing payment record: ${existingPayment.id}`)
      result = await supabase
        .from('pagamentos')
        .update(paymentRecord)
        .eq('id', existingPayment.id)
        .select()
        .single()
    } else {
      console.log('📝 Creating new payment record')
      result = await supabase
        .from('pagamentos')
        .insert(paymentRecord)
        .select()
        .single()
    }

    if (result.error) {
      console.error('❌ Database error:', result.error)
      return new Response(
        JSON.stringify({ error: 'Failed to save payment', details: result.error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Payment ${paymentId} saved with status: ${mappedStatus}`)

    // ═══════════════════════════════════════════════════════════════════
    // PROCESS APPROVED PAYMENTS
    // ═══════════════════════════════════════════════════════════════════
    if (mappedStatus === 'approved') {
      
      // ─────────────────────────────────────────────────────────────────
      // SUBSCRIPTION UPGRADE
      // ─────────────────────────────────────────────────────────────────
      if (refData.tipo === 'subscription' && refData.oficinaId && refData.planType) {
        console.log(`🔄 Processing subscription upgrade for oficina ${refData.oficinaId} to ${refData.planType}`)
        
        // P0-2: Calculate correct expiry based on billing cycle and amount
        const expiryDate = calculateExpiryDate(
          refData.billingCycle,
          paymentDetails.transaction_amount,
          refData.planType
        )
        const isAnnual = expiryDate.getTime() - Date.now() > 60 * 24 * 60 * 60 * 1000 // > 60 days = annual
        
        console.log(`📅 Plan expiry: ${expiryDate.toISOString()} (${isAnnual ? 'ANNUAL' : 'MONTHLY'} cycle, amount: R$ ${paymentDetails.transaction_amount})`)
        
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('oficina_id', refData.oficinaId)
          .maybeSingle()

        const subscriptionData = {
          plan_type: refData.planType,
          status: 'active',
          started_at: new Date().toISOString(),
          expires_at: expiryDate.toISOString(),
          canceled_at: null,
          trial_ends_at: null,
        }

        if (existingSub) {
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update(subscriptionData)
            .eq('oficina_id', refData.oficinaId)

          if (updateError) {
            console.error('⚠️ Failed to update subscription:', updateError)
          } else {
            console.log(`✅ Subscription upgraded to ${refData.planType} (expires: ${expiryDate.toISOString()})`)
          }
        } else {
          const { error: insertError } = await supabase
            .from('subscriptions')
            .insert({
              oficina_id: refData.oficinaId,
              ...subscriptionData,
            })

          if (insertError) {
            console.error('⚠️ Failed to create subscription:', insertError)
          } else {
            console.log(`✅ Subscription created with plan ${refData.planType} (expires: ${expiryDate.toISOString()})`)
          }
        }

        // Create success notification with correct period info
        const periodLabel = isAnnual ? '12 meses' : '30 dias'
        const planLabel = refData.planType === 'oficina_pro' ? 'Oficina Pro' : 'Moto Pro'
        
        await supabase
          .from('notificacoes')
          .insert({
            oficina_id: refData.oficinaId,
            tipo: 'assinatura',
            titulo: '🎉 Upgrade Realizado com Sucesso!',
            mensagem: `Seu plano foi atualizado para ${planLabel} por ${periodLabel}. Aproveite todos os recursos!`,
            referencia_id: result.data?.id,
            referencia_tipo: 'pagamento',
          })

        // Track checkout_completed server-side (most reliable source)
        const { data: oficinaOwner } = await supabase
          .from('oficinas')
          .select('user_id')
          .eq('id', refData.oficinaId)
          .maybeSingle()

        if (oficinaOwner?.user_id) {
          await supabase
            .from('funnel_events')
            .upsert({
              event: 'checkout_completed',
              oficina_id: refData.oficinaId,
              user_id: oficinaOwner.user_id,
              plan_type: refData.planType,
              source: 'webhook',
              session_id: `webhook-${paymentId}`,
              metadata: {
                payment_id: paymentId,
                amount: paymentDetails.transaction_amount,
                billing_cycle: isAnnual ? 'annual' : 'monthly',
              },
            }, { onConflict: 'event,oficina_id,session_id' })
        }
      }

      // ─────────────────────────────────────────────────────────────────
      // ORCAMENTO PAYMENT
      // ─────────────────────────────────────────────────────────────────
      if (refData.tipo === 'orcamento' && refData.orcamentoId) {
        console.log(`🔄 Updating orcamento ${refData.orcamentoId} status to 'aprovado'`)
        
        const { error: updateError } = await supabase
          .from('orcamentos')
          .update({ status: 'aprovado' })
          .eq('id', refData.orcamentoId)

        if (updateError) {
          console.error('⚠️ Failed to update orcamento status:', updateError)
        } else {
          console.log(`✅ Orcamento ${refData.orcamentoId} marked as approved/paid`)
          
          if (refData.oficinaId) {
            await supabase
              .from('notificacoes')
              .insert({
                oficina_id: refData.oficinaId,
                tipo: 'pagamento',
                titulo: '💰 Orçamento Pago!',
                mensagem: `Cliente realizou o pagamento do orçamento. Valor: R$ ${paymentDetails.transaction_amount.toFixed(2)}`,
                referencia_id: refData.orcamentoId,
                referencia_tipo: 'orcamento',
              })
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // HANDLE FAILED/REJECTED PAYMENTS
    // ═══════════════════════════════════════════════════════════════════
    if (mappedStatus === 'rejected' || mappedStatus === 'cancelled') {
      if (refData.tipo === 'subscription' && refData.oficinaId) {
        console.log(`⚠️ Subscription payment failed for oficina ${refData.oficinaId}`)
        
        await supabase
          .from('notificacoes')
          .insert({
            oficina_id: refData.oficinaId,
            tipo: 'assinatura',
            titulo: '⚠️ Pagamento não Aprovado',
            mensagem: `O pagamento da assinatura não foi aprovado: ${paymentDetails.status_detail}. Por favor, tente novamente.`,
            referencia_id: result.data?.id,
            referencia_tipo: 'pagamento',
          })
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // GENERAL PAYMENT NOTIFICATIONS
    // ═══════════════════════════════════════════════════════════════════
    if (refData.oficinaId && refData.tipo !== 'subscription' && refData.tipo !== 'orcamento') {
      const notificationTitles: Record<string, string> = {
        approved: '✅ Pagamento Aprovado',
        pending: '⏳ Pagamento Pendente',
        rejected: '❌ Pagamento Rejeitado',
        cancelled: '❌ Pagamento Cancelado',
        refunded: '↩️ Pagamento Estornado',
      }

      if (notificationTitles[mappedStatus]) {
        await supabase
          .from('notificacoes')
          .insert({
            oficina_id: refData.oficinaId,
            tipo: 'pagamento',
            titulo: notificationTitles[mappedStatus],
            mensagem: `Pagamento de R$ ${paymentDetails.transaction_amount.toFixed(2)} - ${paymentDetails.status_detail}`,
            referencia_id: result.data?.id,
            referencia_tipo: 'pagamento',
          })
      }
    }

    return new Response(
      JSON.stringify({ 
        received: true, 
        processed: true, 
        payment_id: paymentId,
        payment_type: refData.tipo,
        status: mappedStatus 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Webhook error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
