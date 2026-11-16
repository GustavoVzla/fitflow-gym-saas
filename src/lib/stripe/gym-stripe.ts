import 'server-only'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

export type PaymentMode =
  | 'manual'
  | 'direct_keys'
  | 'connect_express'
  | 'connect_standard'
  | 'managed'

export interface GymPaymentConfig {
  gymId: string
  mode: PaymentMode
  stripePublishableKey: string | null
  stripeOnboarded: boolean
  feePercentSepa: number
  feePercentCard: number
}

const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2025-02-24.acacia'

/**
 * Devuelve un cliente Stripe configurado segun el modo del gym.
 * Fase 1: solo 'direct_keys' (claves del gym) devuelve cliente real.
 * 'manual' -> null. Connect_* y 'managed' -> null hasta Fases 2-4.
 */
export async function getStripeClientForGym(gymId: string): Promise<Stripe | null> {
  const supabase = await createClient()
  const { data: gym } = await supabase
    .from('gyms')
    .select('payment_mode, stripe_key_vault_id')
    .eq('id', gymId)
    .maybeSingle()

  if (!gym) return null
  if (gym.payment_mode === 'manual') return null
  if (gym.payment_mode === 'direct_keys') {
    if (!gym.stripe_key_vault_id) return null
    const { data: secretKey, error } = await supabase.rpc('get_gym_stripe_secret', {
      p_gym_id: gymId,
    })
    if (error || !secretKey) return null
    return new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION })
  }
  // connect_* y managed se implementan en Fases 2-4
  return null
}

/**
 * Config de pago del gym para UI y logica de negocio. No incluye la secret key.
 */
export async function getGymPaymentConfig(
  gymId: string
): Promise<GymPaymentConfig | null> {
  const supabase = await createClient()
  const { data: gym } = await supabase
    .from('gyms')
    .select(
      'id, payment_mode, stripe_publishable_key, stripe_onboarded_at, fee_percent_sepa, fee_percent_card'
    )
    .eq('id', gymId)
    .maybeSingle()
  if (!gym) return null
  return {
    gymId: gym.id,
    mode: gym.payment_mode as PaymentMode,
    stripePublishableKey: gym.stripe_publishable_key,
    stripeOnboarded: gym.stripe_onboarded_at !== null,
    feePercentSepa: Number(gym.fee_percent_sepa ?? 0),
    feePercentCard: Number(gym.fee_percent_card ?? 0),
  }
}

export type StripeAccountValidation =
  | {
      ok: true
      accountId: string
      email: string | null
      country: string | null
      businessName: string | null
      chargesEnabled: boolean
      payoutsEnabled: boolean
      isLiveMode: boolean
    }
  | { ok: false; error: string }

/**
 * Valida contra Stripe en tiempo real una secret key arbitraria.
 * Se usa al conectar una cuenta (modo direct_keys): si la key es valida,
 * stripe.accounts.retrieve() devuelve info minima de la cuenta.
 */
export async function validateStripeSecretKey(
  secretKey: string
): Promise<StripeAccountValidation> {
  if (!secretKey || secretKey.length < 10) {
    return { ok: false, error: 'Secret key vacia o invalida' }
  }
  if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
    return { ok: false, error: 'Formato invalido (debe empezar por sk_test_ o sk_live_)' }
  }

  try {
    const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION })
    const account = await stripe.accounts.retrieve()
    return {
      ok: true,
      accountId: account.id,
      email: account.email ?? null,
      country: account.country ?? null,
      businessName: account.business_profile?.name ?? null,
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      isLiveMode: secretKey.startsWith('sk_live_'),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido al validar con Stripe'
    return { ok: false, error: msg }
  }
}

// =============================================================================
// Fase 1C — Subscriptions + Checkout + Customer Portal
// =============================================================================

export type StripeSyncResult =
  | { ok: true; productId: string; priceId: string }
  | { ok: false; error: string }

/**
 * Sincroniza una tarifa FitFlow con Stripe.
 * - Si no existe Product: crea `stripe.products.create` + Price (recurring o one-time).
 * - Si existe Product pero cambia precio: crea Price nuevo (Prices son inmutables en Stripe).
 * - Si existe Product+Price y nada cambia: no-op.
 * - Llama RPC `mark_tariff_stripe_synced` para persistir los IDs en la tabla tariffs.
 *
 * Si el gym no tiene Stripe configurado -> marca status='disabled' y retorna ok:false.
 * Si hay error comunicacion con Stripe -> marca status='error' + guarda mensaje.
 */
export async function syncTariffToStripe(
  gymId: string,
  tariffId: string,
  input: {
    name: string
    description?: string | null
    amountCents: number
    currency?: string
    recurring: boolean
    intervalMonths?: number
    existingProductId?: string | null
    existingPriceId?: string | null
    existingPriceAmountCents?: number | null
  }
): Promise<StripeSyncResult> {
  const supabase = await createClient()
  const stripe = await getStripeClientForGym(gymId)

  if (!stripe) {
    // Gym en modo manual o sin keys -> marcar disabled silenciosamente
    await supabase.rpc('mark_tariff_stripe_synced', {
      p_tariff_id: tariffId,
      p_product_id: '',
      p_price_id: '',
      p_sync_status: 'disabled',
    })
    return { ok: false, error: 'Gym sin Stripe configurado (modo manual o keys no introducidas)' }
  }

  const currency = (input.currency ?? 'eur').toLowerCase()
  const intervalCount = input.intervalMonths ?? 1

  try {
    let productId = input.existingProductId ?? null

    // Crear product si no existe, o actualizar nombre/descripcion si ya existe
    if (!productId) {
      const product = await stripe.products.create({
        name: input.name,
        description: input.description || undefined,
        metadata: { fitflow_tariff_id: tariffId, fitflow_gym_id: gymId },
      })
      productId = product.id
    } else {
      await stripe.products.update(productId, {
        name: input.name,
        description: input.description || undefined,
      })
    }

    // Crear Price nuevo si:
    // - No hay priceId previo
    // - Cambio el amount
    // - Cambio entre recurring y one-off (por defecto lo re-creamos en cualquier edit con importe)
    const priceChanged =
      !input.existingPriceId ||
      input.existingPriceAmountCents == null ||
      input.existingPriceAmountCents !== input.amountCents

    let priceId: string
    if (priceChanged) {
      const priceParams: Stripe.PriceCreateParams = {
        product: productId,
        currency,
        unit_amount: input.amountCents,
        metadata: { fitflow_tariff_id: tariffId },
      }
      if (input.recurring) {
        priceParams.recurring = { interval: 'month', interval_count: intervalCount }
      }
      const price = await stripe.prices.create(priceParams)
      priceId = price.id

      // Desactivar el price antiguo para que no se siga pudiendo suscribir a el
      if (input.existingPriceId && input.existingPriceId !== priceId) {
        try {
          await stripe.prices.update(input.existingPriceId, { active: false })
        } catch {
          // si falla, no bloquear. Seguimos con el nuevo price.
        }
      }
    } else {
      priceId = input.existingPriceId as string
    }

    // Persistir IDs en tariffs via RPC
    const { error: rpcErr } = await supabase.rpc('mark_tariff_stripe_synced', {
      p_tariff_id: tariffId,
      p_product_id: productId,
      p_price_id: priceId,
      p_sync_status: 'synced',
    })

    if (rpcErr) {
      return { ok: false, error: `RPC mark_tariff_stripe_synced: ${rpcErr.message}` }
    }

    return { ok: true, productId, priceId }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido sincronizando tarifa con Stripe'
    // Marcar como error en DB para que UI pueda mostrar badge
    await supabase.rpc('mark_tariff_stripe_synced', {
      p_tariff_id: tariffId,
      p_product_id: input.existingProductId ?? '',
      p_price_id: input.existingPriceId ?? '',
      p_sync_status: 'error',
      p_error: msg,
    })
    return { ok: false, error: msg }
  }
}

export type CheckoutSessionResult =
  | { ok: true; sessionId: string; url: string }
  | { ok: false; error: string }

/**
 * Crea una sesion Stripe Checkout (mode='payment') para un pago one-off.
 * Retorna URL hosted de Stripe -> se comparte por WhatsApp/email al socio.
 * El socio paga sin login. Webhook `checkout.session.completed` marca el pago como completado.
 */
export async function createCheckoutSessionForPayment(
  gymId: string,
  params: {
    amountCents: number
    currency?: string
    paymentId: string
    memberId?: string | null
    customerEmail?: string | null
    successUrl: string
    cancelUrl: string
    description?: string | null
  }
): Promise<CheckoutSessionResult> {
  const stripe = await getStripeClientForGym(gymId)
  if (!stripe) return { ok: false, error: 'Gym sin Stripe configurado' }

  const currency = (params.currency ?? 'eur').toLowerCase()

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: params.customerEmail || undefined,
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: params.amountCents,
            product_data: {
              name: params.description || 'Pago FitFlow',
            },
          },
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        fitflow_payment_id: params.paymentId,
        fitflow_gym_id: gymId,
        ...(params.memberId ? { fitflow_member_id: params.memberId } : {}),
      },
      // Expiracion por defecto Stripe: 24h
    })

    if (!session.url) {
      return { ok: false, error: 'Stripe no devolvio URL de checkout' }
    }

    return { ok: true, sessionId: session.id, url: session.url }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error creando Checkout session'
    return { ok: false, error: msg }
  }
}

/**
 * Crea sesion Stripe Checkout (mode='subscription') para activar domiciliacion mensual.
 * Usada desde el area socio /mi-cuenta cuando el socio pulsa "Activar domiciliacion".
 */
export async function createSubscriptionCheckoutSession(
  gymId: string,
  params: {
    memberId: string
    stripePriceId: string
    stripeCustomerId?: string | null
    customerEmail: string
    successUrl: string
    cancelUrl: string
    trialDays?: number | null
  }
): Promise<CheckoutSessionResult> {
  const stripe = await getStripeClientForGym(gymId)
  if (!stripe) return { ok: false, error: 'Gym sin Stripe configurado' }

  try {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: params.stripePriceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        fitflow_member_id: params.memberId,
        fitflow_gym_id: gymId,
      },
      subscription_data: {
        metadata: {
          fitflow_member_id: params.memberId,
          fitflow_gym_id: gymId,
        },
        ...(params.trialDays && params.trialDays > 0
          ? { trial_period_days: params.trialDays }
          : {}),
      },
    }

    if (params.stripeCustomerId) {
      sessionParams.customer = params.stripeCustomerId
    } else {
      sessionParams.customer_email = params.customerEmail
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    if (!session.url) {
      return { ok: false, error: 'Stripe no devolvio URL de checkout' }
    }

    return { ok: true, sessionId: session.id, url: session.url }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error creando Subscription Checkout session'
    return { ok: false, error: msg }
  }
}

export type CustomerPortalResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

/**
 * Crea sesion del Customer Portal hosted de Stripe.
 * El socio puede: cambiar tarjeta, descargar facturas, cancelar subscription.
 * Requiere config previa en Stripe Dashboard -> Settings -> Billing -> Customer Portal.
 */
export async function createCustomerPortalSession(
  gymId: string,
  params: {
    stripeCustomerId: string
    returnUrl: string
  }
): Promise<CustomerPortalResult> {
  const stripe = await getStripeClientForGym(gymId)
  if (!stripe) return { ok: false, error: 'Gym sin Stripe configurado' }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: params.stripeCustomerId,
      return_url: params.returnUrl,
    })
    return { ok: true, url: session.url }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error creando Customer Portal session'
    return { ok: false, error: msg }
  }
}

/**
 * Obtiene el webhook signing secret del gym desde Supabase Vault.
 * Usado por el webhook handler /api/webhooks/stripe/[gymId] para verificar firma.
 */
export async function getGymWebhookSecret(gymId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: secret, error } = await supabase.rpc('get_gym_stripe_webhook_secret', {
    p_gym_id: gymId,
  })
  if (error || !secret) return null
  return secret as string
}
