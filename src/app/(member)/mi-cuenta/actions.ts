'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import {
  createSubscriptionCheckoutSession,
  createCustomerPortalSession,
} from '@/lib/stripe/gym-stripe'

type ActionState = { error?: string; url?: string }

async function resolveMember() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('members')
    .select(
      'id, gym_id, email, first_name, last_name, stripe_customer_id, current_tariff_id, stripe_subscription_id'
    )
    .eq('auth_user_id', user.id)
    .maybeSingle()

  return member
}

async function baseUrl(): Promise<string> {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'https'
  // Canonical post-D-PM2: panel.example.com. Compat app.* dual 7d.
  const host = h.get('host') ?? 'panel.example.com'
  return `${proto}://${host}`
}

export async function activateSubscriptionAction(): Promise<ActionState> {
  const supabase = await createClient()
  const member = await resolveMember()
  if (!member) return { error: 'No autenticado' }

  if (member.stripe_subscription_id) {
    return { error: 'Ya tienes una domiciliacion activa. Usa "Gestionar pago" para cambiarla.' }
  }

  if (!member.current_tariff_id) {
    return { error: 'No tienes una tarifa asignada. Contacta con tu gimnasio.' }
  }

  // Resolver stripe_price_id de la tarifa
  const { data: tariff } = await supabase
    .from('tariffs')
    .select('stripe_price_id, stripe_sync_status, type')
    .eq('id', member.current_tariff_id)
    .maybeSingle()

  if (!tariff?.stripe_price_id) {
    return {
      error: 'La tarifa no esta sincronizada con Stripe. Contacta con tu gimnasio.',
    }
  }

  if (tariff.type !== 'monthly') {
    return { error: 'Solo las tarifas mensuales soportan domiciliacion' }
  }

  const base = await baseUrl()
  const result = await createSubscriptionCheckoutSession(member.gym_id, {
    memberId: member.id,
    stripePriceId: tariff.stripe_price_id,
    stripeCustomerId: member.stripe_customer_id,
    customerEmail: member.email ?? '',
    successUrl: `${base}/mi-cuenta?success=subscribed`,
    cancelUrl: `${base}/mi-cuenta?canceled=true`,
  })

  if (!result.ok) return { error: result.error }
  return { url: result.url }
}

export async function openCustomerPortalAction(): Promise<ActionState> {
  const member = await resolveMember()
  if (!member) return { error: 'No autenticado' }
  if (!member.stripe_customer_id) {
    return { error: 'No tienes cuenta Stripe asociada todavia' }
  }

  const base = await baseUrl()
  const result = await createCustomerPortalSession(member.gym_id, {
    stripeCustomerId: member.stripe_customer_id,
    returnUrl: `${base}/mi-cuenta`,
  })

  if (!result.ok) return { error: result.error }
  return { url: result.url }
}

// Welcome action: linkea member tras magic link, llama RPC link_member_auth_user
export async function linkMemberAction(memberId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('link_member_auth_user', { p_member_id: memberId })
  if (error) return { error: error.message }
  return {}
}
