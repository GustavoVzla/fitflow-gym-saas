'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'
import type { Json } from '@/types/database'
import type { DbPaymentMethod, DbPaymentStatus } from './types'
import {
  getStripeClientForGym,
  getGymPaymentConfig,
  createCheckoutSessionForPayment,
} from '@/lib/stripe/gym-stripe'
import { headers } from 'next/headers'

export type PaymentActionState = {
  error?: string
  success?: string
}

async function resolveActiveGymId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('current_user_gyms')
  return data && data.length > 0 ? data[0].gym_id : null
}

const VALID_METHODS: DbPaymentMethod[] = [
  'manual',
  'sepa',
  'card',
  'stripe',
  'cash',
  'bank_transfer',
]

const isoDateOrEmpty = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (formato YYYY-MM-DD)')
  .or(z.literal(''))

const createPaymentSchema = z.object({
  memberId: z.string().trim().uuid('Selecciona un socio'),
  tariffId: z.string().trim().uuid('Tarifa inválida').or(z.literal('')).optional(),
  description: z.string().trim().min(1, 'La descripción es obligatoria').max(500),
  concept: z.string().trim().max(200).or(z.literal('')).optional(),
  amount: z
    .string()
    .trim()
    .refine((v) => {
      const n = Number(v.replace(',', '.'))
      return Number.isFinite(n) && n >= 0 && n <= 1_000_000
    }, 'Importe inválido'),
  method: z.string().refine(
    (v) => (VALID_METHODS as readonly string[]).includes(v.trim()),
    'Método de pago inválido'
  ),
  dueDate: isoDateOrEmpty.optional(),
  periodStart: isoDateOrEmpty.optional(),
  periodEnd: isoDateOrEmpty.optional(),
  markPaidNow: z.string().optional(),
})

const markPaymentPaidSchema = z.object({
  paymentId: z.string().trim().uuid('ID de pago inválido'),
  method: z.string().refine(
    (v) => (VALID_METHODS as readonly string[]).includes(v),
    'Método de pago inválido'
  ).optional(),
  externalReference: z.string().trim().max(100).optional(),
})

export async function createPaymentAction(
  _prev: PaymentActionState,
  formData: FormData
): Promise<PaymentActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const parsed = createPaymentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const memberId = parsed.data.memberId
  const tariffId = parsed.data.tariffId?.trim() ? parsed.data.tariffId.trim() : null
  const description = parsed.data.description
  const concept = parsed.data.concept?.trim() ? parsed.data.concept.trim() : null
  const method = parsed.data.method.trim() as DbPaymentMethod
  const dueDate = parsed.data.dueDate?.trim() ? parsed.data.dueDate.trim() : null
  const periodStart = parsed.data.periodStart?.trim() ? parsed.data.periodStart.trim() : null
  const periodEnd = parsed.data.periodEnd?.trim() ? parsed.data.periodEnd.trim() : null
  const markPaidNow = parsed.data.markPaidNow === 'true'
  const amount = Number(parsed.data.amount.replace(',', '.'))

  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo en la sesion' }

  const supabase = await createClient()

  // ═══════════════════════════════════════════════════════════════════
  // SNAPSHOTS: crítico para integridad histórica. Pagos son inmutables
  // tras paid_at → aunque cambien tarifas/socios después, el histórico
  // refleja el estado exacto del momento del pago.
  // ═══════════════════════════════════════════════════════════════════

  // Snapshot del socio (facturación)
  const { data: memberData } = await supabase
    .from('members')
    .select('first_name, last_name, email, phone, tax_id, address, city, postal_code')
    .eq('id', memberId)
    .single()

  if (!memberData) return { error: 'Socio no encontrado' }

  const memberSnapshot: Json = {
    id: memberId,
    first_name: memberData.first_name,
    last_name: memberData.last_name,
    full_name: `${memberData.first_name} ${memberData.last_name}`.trim(),
    email: memberData.email,
    phone: memberData.phone,
    tax_id: memberData.tax_id,
    address: memberData.address,
    city: memberData.city,
    postal_code: memberData.postal_code,
    snapshotted_at: new Date().toISOString(),
  }

  // Snapshot de la tarifa (si aplica)
  let tariffSnapshot: Json | null = null
  if (tariffId) {
    const { data: tariffData } = await supabase
      .from('tariffs')
      .select('id, name, "group", price, type, sessions_per_week, total_sessions, duration_months')
      .eq('id', tariffId)
      .single()

    if (tariffData) {
      tariffSnapshot = {
        id: tariffData.id,
        name: tariffData.name,
        group: tariffData.group,
        price: tariffData.price,
        type: tariffData.type,
        sessions_per_week: tariffData.sessions_per_week,
        total_sessions: tariffData.total_sessions,
        duration_months: tariffData.duration_months,
        snapshotted_at: new Date().toISOString(),
      }
    }
  }

  const status: DbPaymentStatus = markPaidNow ? 'completed' : 'pending'
  const paidAt = markPaidNow ? new Date().toISOString() : null

  const { data: inserted, error } = await supabase
    .from('payments')
    .insert({
      gym_id: gymId,
      member_id: memberId,
      amount,
      currency: 'EUR',
      description,
      concept,
      method,
      status,
      due_date: dueDate,
      period_start: periodStart,
      period_end: periodEnd,
      paid_at: paidAt,
      tariff_snapshot: tariffSnapshot,
      member_snapshot: memberSnapshot,
    })
    .select('id')
    .single()

  if (error || !inserted) return { error: sanitizeServerError(error, 'Error al crear el pago') }

  // ═══════════════════════════════════════════════════════════════════
  // STRIPE INTEGRATION (Decision #102 · Phase 1)
  // Crea PaymentIntent en la cuenta Stripe del gym si modo=direct_keys
  // y tiene keys configuradas. Fallback silencioso a modo manual si falla.
  // Modos connect_*/managed: TODO Fases 2-4.
  // ═══════════════════════════════════════════════════════════════════
  if (!markPaidNow && method !== 'cash' && method !== 'manual') {
    const paymentConfig = await getGymPaymentConfig(gymId)
    if (paymentConfig?.mode === 'direct_keys' && paymentConfig.stripeOnboarded) {
      try {
        const stripe = await getStripeClientForGym(gymId)
        if (stripe) {
          const amountCents = Math.round(amount * 100)
          const intent = await stripe.paymentIntents.create({
            amount: amountCents,
            currency: 'eur',
            description: description.slice(0, 500),
            metadata: {
              fitflow_payment_id: inserted.id,
              fitflow_gym_id: gymId,
              fitflow_member_id: memberId,
            },
          })
          // Guardar el intent id en la row
          await supabase
            .from('payments')
            .update({ stripe_payment_intent_id: intent.id })
            .eq('id', inserted.id)
        }
      } catch (stripeErr) {
        // Fallback silencioso: el pago queda en DB como pendiente sin Stripe.
        // Se loggea para debug pero no bloquea el flow (Decision #102 acuerdo UX).
        console.error('[createPaymentAction] Stripe PaymentIntent failed (fallback to manual):', stripeErr)
      }
    }
  }

  revalidatePath('/pagos')
  return {
    success: markPaidNow ? 'Pago registrado y marcado como cobrado' : 'Pago creado como pendiente',
  }
}

export async function markPaymentPaidAction(
  paymentId: string,
  method?: DbPaymentMethod,
  externalReference?: string
): Promise<PaymentActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const parsed = markPaymentPaidSchema.safeParse({ paymentId, method, externalReference })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()

  const updateData: {
    status: DbPaymentStatus
    paid_at: string
    method?: DbPaymentMethod
    external_reference?: string | null
  } = {
    status: 'completed',
    paid_at: new Date().toISOString(),
  }
  const parsedMethod = parsed.data.method as DbPaymentMethod | undefined
  if (parsedMethod) updateData.method = parsedMethod
  // Solo persistimos referencia externa si viene con transfer (evita pisar
  // referencias Stripe/SEPA existentes cuando el metodo es otro).
  if (parsedMethod === 'bank_transfer') {
    const ref = (parsed.data.externalReference ?? '').trim()
    updateData.external_reference = ref.length > 0 ? ref.slice(0, 100) : null
  }

  const { error } = await supabase
    .from('payments')
    .update(updateData)
    .eq('id', parsed.data.paymentId)
    .eq('status', 'pending') // Solo pendientes — no tocar ya cobrados

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/pagos')
  return { success: 'Pago marcado como cobrado' }
}

export async function cancelPaymentAction(
  paymentId: string
): Promise<PaymentActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const parsed = z.string().trim().uuid('ID de pago inválido').safeParse(paymentId)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'ID de pago inválido' }
  }

  const supabase = await createClient()

  // Solo se puede cancelar si está pendiente. Los completed NO se tocan (inmutables).
  const { error } = await supabase
    .from('payments')
    .update({ status: 'cancelled' })
    .eq('id', parsed.data)
    .in('status', ['pending', 'processing'])

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/pagos')
  return { success: 'Pago cancelado' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fase 1C: generar link Stripe Checkout one-off para un pago pendiente
// El gym copia el link y lo envia al socio (WhatsApp / email). El socio paga
// sin necesidad de cuenta FitFlow. Webhook checkout.session.completed
// marca el pago como completado.
// ─────────────────────────────────────────────────────────────────────────────
export async function createPaymentCheckoutLinkAction(
  paymentId: string
): Promise<{ error?: string; url?: string }> {
  if (!paymentId) return { error: 'ID de pago requerido' }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verificar pago existente y estado valido
  const { data: payment } = await supabase
    .from('payments')
    .select('id, gym_id, member_id, amount, currency, description, status, stripe_checkout_session_id')
    .eq('id', paymentId)
    .maybeSingle()

  if (!payment) return { error: 'Pago no encontrado' }
  if (payment.status !== 'pending' && payment.status !== 'processing') {
    return { error: 'Solo puedes generar link para pagos pendientes' }
  }

  // Si ya tiene checkout session abierta, devolver la URL existente (no crear duplicada)
  if (payment.stripe_checkout_session_id) {
    const { data: existing } = await supabase
      .from('checkout_sessions')
      .select('stripe_url, status')
      .eq('stripe_session_id', payment.stripe_checkout_session_id)
      .maybeSingle()
    if (existing && existing.status === 'open') {
      return { url: existing.stripe_url }
    }
  }

  const paymentConfig = await getGymPaymentConfig(payment.gym_id)
  if (paymentConfig?.mode !== 'direct_keys' || !paymentConfig.stripeOnboarded) {
    return { error: 'El gym no tiene Stripe configurado' }
  }

  // Resolver email del member si existe
  let memberEmail: string | null = null
  if (payment.member_id) {
    const { data: m } = await supabase
      .from('members')
      .select('email')
      .eq('id', payment.member_id)
      .maybeSingle()
    memberEmail = m?.email ?? null
  }

  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'https'
  // Canonical post-D-PM2: panel.example.com. Compat app.* dual 7d.
  const host = h.get('host') ?? 'panel.example.com'
  const base = `${proto}://${host}`

  const result = await createCheckoutSessionForPayment(payment.gym_id, {
    amountCents: Math.round(Number(payment.amount) * 100),
    currency: payment.currency ?? 'EUR',
    paymentId: payment.id,
    memberId: payment.member_id,
    customerEmail: memberEmail,
    successUrl: `${base}/pagos?session_success=${payment.id}`,
    cancelUrl: `${base}/pagos?session_canceled=${payment.id}`,
    description: payment.description,
  })

  if (!result.ok) return { error: result.error }

  // Persistir checkout_session + actualizar payments row
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h default Stripe
  await supabase.from('checkout_sessions').insert({
    gym_id: payment.gym_id,
    member_id: payment.member_id,
    payment_id: payment.id,
    stripe_session_id: result.sessionId,
    stripe_url: result.url,
    amount_cents: Math.round(Number(payment.amount) * 100),
    currency: (payment.currency ?? 'EUR').toLowerCase(),
    status: 'open',
    expires_at: expiresAt,
    description: payment.description,
    created_by: user.id,
  })

  await supabase
    .from('payments')
    .update({
      stripe_checkout_session_id: result.sessionId,
      payment_source: 'checkout_one_off',
    })
    .eq('id', payment.id)

  revalidatePath('/pagos')
  return { url: result.url }
}
