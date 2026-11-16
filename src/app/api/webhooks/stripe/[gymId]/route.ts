import 'server-only'
import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import type { Json } from '@/types/database'
import { createServiceRoleClient } from '@/lib/supabase/service'
import {
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleInvoiceFailed,
  handleSubscriptionChanged,
  handlePaymentIntentSucceeded,
} from '@/lib/stripe/webhook-handlers'

// Next.js 16 App Router: runtime nodejs obligatorio para Stripe SDK (no edge)
export const runtime = 'nodejs'

const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2025-02-24.acacia'

/**
 * Webhook Stripe per-gym: `/api/webhooks/stripe/[gymId]`
 *
 * - Cada gym configura su propio endpoint en Stripe Dashboard con esta URL.
 * - El signing secret del gym (whsec_...) se guarda cifrado en Supabase Vault.
 * - Firma Stripe verificada con ese secret antes de procesar.
 * - Idempotencia via tabla `stripe_webhook_events` (PK=event_id).
 * - Handlers fan-out por tipo de evento.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
): Promise<Response> {
  const { gymId } = await params

  if (!gymId) {
    return new Response('missing gymId', { status: 400 })
  }

  // Body raw (NO parsear JSON antes de verificar firma)
  const body = await req.text()

  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('missing stripe-signature', { status: 400 })

  const supabase = createServiceRoleClient()

  // Obtener webhook secret del gym via RPC
  const { data: webhookSecret, error: secretErr } = await supabase.rpc(
    'get_gym_stripe_webhook_secret',
    { p_gym_id: gymId }
  )
  if (secretErr || !webhookSecret) {
    return new Response('gym has no webhook secret configured', { status: 400 })
  }

  // Obtener stripe secret key del gym (para inicializar cliente y verificar event)
  const { data: stripeSecret } = await supabase.rpc('get_gym_stripe_secret', {
    p_gym_id: gymId,
  })
  if (!stripeSecret) {
    return new Response('gym has no stripe secret key', { status: 400 })
  }

  const stripe = new Stripe(stripeSecret, { apiVersion: STRIPE_API_VERSION })

  // Verificar firma
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'signature verification failed'
    return new Response(`signature verification failed: ${msg}`, { status: 400 })
  }

  // Idempotencia: si ya procesamos este event_id, devolver 200 sin re-procesar
  const { data: existing } = await supabase
    .from('stripe_webhook_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle()

  if (existing) {
    return new Response('already processed', { status: 200 })
  }

  // Fan-out por tipo
  let processingError: string | null = null
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(supabase, gymId, event.data.object as Stripe.Checkout.Session)
        break
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
        await handleInvoicePaid(supabase, gymId, event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handleInvoiceFailed(supabase, gymId, event.data.object as Stripe.Invoice)
        break
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionChanged(supabase, gymId, event.data.object as Stripe.Subscription)
        break
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(
          supabase,
          gymId,
          event.data.object as Stripe.PaymentIntent
        )
        break
      default:
        // Ignored event types — log them anyway in stripe_webhook_events for auditing
        break
    }
  } catch (e) {
    processingError = e instanceof Error ? e.message : 'unknown handler error'
  }

  // Guardar event (incluido si proceso con error — importante para auditoria)
  await supabase.from('stripe_webhook_events').insert({
    id: event.id,
    gym_id: gymId,
    event_type: event.type,
    api_version: event.api_version,
    payload: event as unknown as Json,
    processing_error: processingError,
  })

  if (processingError) {
    // 500 -> Stripe reintenta el webhook
    return new Response(`handler error: ${processingError}`, { status: 500 })
  }

  return new Response('ok', { status: 200 })
}
