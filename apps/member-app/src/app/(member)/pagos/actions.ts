'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@fitflow/lib/ratelimit'
import { createCheckoutSessionForPayment } from '@fitflow/lib/stripe/gym-stripe'
import { getAppUrl } from '@/lib/config'

const schema = z.object({
  paymentId: z.string().uuid(),
})

type Result =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string }

/**
 * Genera Stripe Checkout one-off para que el socio pague desde la app.
 * Solo aplica a gyms en modo direct_keys (Fase 1, Demo Studio).
 * Si gym es modo manual → no se debe llamar (UI esconde botón).
 */
export async function startPaymentCheckoutAction(
  formData: FormData
): Promise<Result> {
  const parsed = schema.safeParse({ paymentId: formData.get('paymentId') })
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  const rl = await rateLimit('api')
  if (!rl.success) return { ok: false, error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sesión expirada' }

  const { data: member } = await supabase
    .from('members')
    .select('id, gym_id, email')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!member) return { ok: false, error: 'Socio no encontrado' }

  // Validar que el pago pertenece al socio + está pendiente
  const { data: payment } = await supabase
    .from('payments')
    .select('id, amount, currency, description, status, member_id')
    .eq('id', parsed.data.paymentId)
    .maybeSingle()

  if (!payment) return { ok: false, error: 'Pago no encontrado' }
  if (payment.member_id !== member.id)
    return { ok: false, error: 'Acceso denegado' }
  if (payment.status !== 'pending')
    return { ok: false, error: 'Este pago no está pendiente' }

  const baseUrl = getAppUrl()

  const result = await createCheckoutSessionForPayment(member.gym_id, {
    amountCents: Math.round(payment.amount * 100),
    currency: payment.currency,
    paymentId: payment.id,
    memberId: member.id,
    customerEmail: member.email ?? user.email ?? null,
    description: payment.description,
    successUrl: `${baseUrl}/pagos?status=success&paymentId=${payment.id}`,
    cancelUrl: `${baseUrl}/pagos?status=cancelled&paymentId=${payment.id}`,
  })

  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, checkoutUrl: result.url }
}
