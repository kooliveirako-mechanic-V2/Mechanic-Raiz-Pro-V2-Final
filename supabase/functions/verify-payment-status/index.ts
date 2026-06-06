import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  metadata?: {
    tipo?: string
    oficina_id?: string
    plan_type?: string
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str)
}

function sanitizeString(str: string): string {
  return str.replace(/[<>\"'\\]/g, '').trim().slice(0, 255)
}

interface ParsedReference {
  tipo: 'subscription' | 'orcamento' | 'payment' | 'unknown'
  oficinaId: string | null
  planType: string | null
}

function parseExternalReference(ref: string | null, metadata?: PaymentDetails['metadata']): ParsedReference {
  if (metadata?.tipo) {
    const oficinaId = metadata.oficina_id && isValidUUID(metadata.oficina_id) ? metadata.oficina_id : null
    return {
      tipo: metadata.tipo as ParsedReference['tipo'],
      oficinaId,
      planType: metadata.plan_type ? sanitizeString(metadata.plan_type) : null,
    }
  }

  if (!ref) {
    return { tipo: 'unknown', oficinaId: null, planType: null }
  }

  const sanitizedRef = sanitizeString(ref)
  const parts = sanitizedRef.split(':')
  
  if (parts[0] === 'subscription' && parts.length >= 3) {
    return {
      tipo: 'subscription',
      oficinaId: isValidUUID(parts[1]) ? parts[1] : null,
      planType: parts[2] || null
    }
  }
  
  return {
    tipo: 'unknown',
    oficinaId: isValidUUID(parts[0]) ? parts[0] : null,
    planType: null
  }
}

Deno.serve(async (req) => {
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
    const { payment_id } = await req.json()
    
    if (!payment_id) {
      return new Response(
        JSON.stringify({ error: 'payment_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔍 Verifying payment status for ID: ${payment_id}`)

    // Fetch payment details from Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
      },
    })

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text()
      console.error(`❌ Failed to fetch payment from MP: ${mpResponse.status} - ${errorText}`)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch payment details', status: 'unknown' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const paymentDetails: PaymentDetails = await mpResponse.json()
    
    console.log(`💳 Payment ${payment_id} status: ${paymentDetails.status}`)

    // If payment is approved, ensure subscription is activated
    if (paymentDetails.status === 'approved') {
      const refData = parseExternalReference(paymentDetails.external_reference, paymentDetails.metadata)
      
      console.log('📋 Parsed reference:', JSON.stringify(refData))

      if (refData.tipo === 'subscription' && refData.oficinaId && refData.planType) {
        // Check current subscription status
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('id, status, plan_type')
          .eq('oficina_id', refData.oficinaId)
          .maybeSingle()

        // Only update if not already active with correct plan
        if (!existingSub || existingSub.status !== 'active' || existingSub.plan_type !== refData.planType) {
          console.log(`🔄 Activating subscription for oficina ${refData.oficinaId}`)
          
          const subscriptionData = {
            plan_type: refData.planType,
            status: 'active',
            started_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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
              console.log(`✅ Subscription activated via fallback verification`)
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
              console.log(`✅ Subscription created via fallback verification`)
            }
          }

          // Create notification
          await supabase
            .from('notificacoes')
            .insert({
              oficina_id: refData.oficinaId,
              tipo: 'assinatura',
              titulo: '🎉 Upgrade Realizado com Sucesso!',
              mensagem: `Seu plano foi atualizado para ${refData.planType === 'oficina_pro' ? 'Oficina Pro' : 'Moto Pro'}. Aproveite todos os recursos!`,
              referencia_tipo: 'pagamento',
            })

          // Track checkout_completed server-side (fallback verification)
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
                source: 'verify-payment',
                session_id: `verify-${payment_id}`,
                metadata: { payment_id, amount: paymentDetails.transaction_amount },
              }, { onConflict: 'event,oficina_id,session_id' })
          }
        } else {
          console.log(`✅ Subscription already active for oficina ${refData.oficinaId}`)
        }

        return new Response(
          JSON.stringify({ 
            status: 'approved', 
            activated: true,
            plan_type: refData.planType 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ 
        status: paymentDetails.status,
        status_detail: paymentDetails.status_detail
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error verifying payment:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', status: 'error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
