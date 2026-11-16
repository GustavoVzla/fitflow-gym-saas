import 'server-only'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'

type DB = SupabaseClient<Database>
type MemberUpdate = Database['public']['Tables']['members']['Update']

// =============================================================================
// handleCheckoutCompleted — sesion Checkout one-off completada
// =============================================================================
export async function handleCheckoutCompleted(
  supabase: DB,
  gymId: string,
  session: Stripe.Checkout.Session
): Promise<void> {
  if (session.mode === 'payment') {
    // Marcar checkout_sessions.status='complete' y actualizar el payment asociado
    const { data: cs } = await supabase
      .from('checkout_sessions')
      .update({ status: 'complete', completed_at: new Date().toISOString() })
      .eq('stripe_session_id', session.id)
      .select('payment_id')
      .maybeSingle()

    const paymentId = cs?.payment_id ?? (session.metadata?.fitflow_payment_id ?? null)
    if (paymentId) {
      await supabase
        .from('payments')
        .update({
          status: 'completed',
          paid_at: new Date().toISOString(),
          payment_source: 'checkout_one_off',
          stripe_checkout_session_id: session.id,
        })
        .eq('id', paymentId)
        .eq('gym_id', gymId)
    }
  } else if (session.mode === 'subscription') {
    // Link subscription al member
    const memberId = session.metadata?.fitflow_member_id
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id

    if (memberId && subscriptionId) {
      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer?.id

      const updates: MemberUpdate = {
        stripe_subscription_id: subscriptionId,
        subscription_status: 'active',
      }
      if (customerId) updates.stripe_customer_id = customerId

      await supabase.from('members').update(updates).eq('id', memberId).eq('gym_id', gymId)
    }
  }
}

// =============================================================================
// handleInvoicePaid — renovacion subscription OK -> crear row payments
// =============================================================================
export async function handleInvoicePaid(
  supabase: DB,
  gymId: string,
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
  if (!subscriptionId) return // Solo subscriptions (skip invoices one-off)

  // Buscar member via stripe_subscription_id
  const { data: member } = await supabase
    .from('members')
    .select('id, gym_id, first_name, last_name, email, phone, current_tariff_id')
    .eq('stripe_subscription_id', subscriptionId)
    .eq('gym_id', gymId)
    .maybeSingle()

  if (!member) {
    throw new Error(`Invoice ${invoice.id} sin member (subscription ${subscriptionId})`)
  }

  // Idempotencia
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('stripe_invoice_id', invoice.id)
    .maybeSingle()

  if (existing) return

  // Snapshot tarifa
  let tariffSnapshot: Json = null
  if (member.current_tariff_id) {
    const { data: tariff } = await supabase
      .from('tariffs')
      .select('id, name, price, type, group, stripe_price_id')
      .eq('id', member.current_tariff_id)
      .maybeSingle()
    if (tariff) {
      tariffSnapshot = {
        id: tariff.id,
        name: tariff.name,
        price: tariff.price,
        type: tariff.type,
        group: tariff.group,
        stripe_price_id: tariff.stripe_price_id,
      } as Json
    }
  }

  const memberSnapshot: Json = {
    first_name: member.first_name,
    last_name: member.last_name,
    email: member.email,
    phone: member.phone,
  }

  const amountEur = (invoice.amount_paid ?? 0) / 100
  const paidAt = invoice.status_transitions?.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
    : new Date().toISOString()

  await supabase.from('payments').insert({
    gym_id: gymId,
    member_id: member.id,
    amount: amountEur,
    currency: (invoice.currency ?? 'eur').toUpperCase(),
    method: 'card',
    status: 'completed',
    paid_at: paidAt,
    stripe_invoice_id: invoice.id,
    payment_source: 'subscription',
    tariff_snapshot: tariffSnapshot,
    member_snapshot: memberSnapshot,
    description: `Cobro automatico subscription`,
    member_tariff_id: member.current_tariff_id,
  })

  // Actualizar member period_end si hay line item
  const periodEnd = invoice.lines?.data?.[0]?.period?.end
  const updates: MemberUpdate = { subscription_status: 'active' }
  if (periodEnd) {
    updates.subscription_current_period_end = new Date(periodEnd * 1000).toISOString()
  }
  await supabase.from('members').update(updates).eq('id', member.id)
}

// =============================================================================
// handleInvoiceFailed — cobro recurrente fallido
// =============================================================================
export async function handleInvoiceFailed(
  supabase: DB,
  gymId: string,
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
  if (!subscriptionId) return

  const { data: member } = await supabase
    .from('members')
    .select('id, first_name, last_name')
    .eq('stripe_subscription_id', subscriptionId)
    .eq('gym_id', gymId)
    .maybeSingle()

  if (!member) return

  await supabase
    .from('members')
    .update({ subscription_status: 'past_due' })
    .eq('id', member.id)

  // Notification al gym
  const fullName = `${member.first_name} ${member.last_name}`.trim()
  const amountDue = (invoice.amount_due ?? 0) / 100
  await supabase.from('notifications').insert({
    gym_id: gymId,
    type: 'warning',
    title: 'Cobro recurrente fallido',
    message: `El cobro automatico de ${fullName} (${amountDue.toFixed(2)} EUR) ha fallado. Stripe reintentara; contacta al socio si persiste.`,
    link: `/socios`,
  })
}

// =============================================================================
// handleSubscriptionChanged — customer.subscription.updated|deleted
// =============================================================================
export async function handleSubscriptionChanged(
  supabase: DB,
  gymId: string,
  subscription: Stripe.Subscription
): Promise<void> {
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .eq('gym_id', gymId)
    .maybeSingle()

  if (!member) return

  const updates: MemberUpdate = {
    subscription_status: subscription.status,
  }

  if (subscription.current_period_end) {
    updates.subscription_current_period_end = new Date(
      subscription.current_period_end * 1000
    ).toISOString()
  }

  if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
    updates.stripe_subscription_id = null
  }

  await supabase.from('members').update(updates).eq('id', member.id)
}

// =============================================================================
// handlePaymentIntentSucceeded — PaymentIntent Fase 1 confirmado
// =============================================================================
export async function handlePaymentIntentSucceeded(
  supabase: DB,
  gymId: string,
  pi: Stripe.PaymentIntent
): Promise<void> {
  const fitflowPaymentId = pi.metadata?.fitflow_payment_id

  if (fitflowPaymentId) {
    await supabase
      .from('payments')
      .update({
        status: 'completed',
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: pi.id,
      })
      .eq('id', fitflowPaymentId)
      .eq('gym_id', gymId)
  } else {
    await supabase
      .from('payments')
      .update({
        status: 'completed',
        paid_at: new Date().toISOString(),
      })
      .eq('stripe_payment_intent_id', pi.id)
      .eq('gym_id', gymId)
  }
}
