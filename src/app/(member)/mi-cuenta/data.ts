import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { MemberDashboardData, MemberPayment, SubscriptionStatus } from './types'

export async function getMemberDashboard(): Promise<MemberDashboardData | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('members')
    .select(
      `
      id, gym_id, first_name, last_name, email, phone, status,
      current_tariff_id, stripe_customer_id, stripe_subscription_id,
      subscription_status, subscription_current_period_end
    `
    )
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!member) return null

  const { data: gym } = await supabase
    .from('gyms')
    .select('id, name, payment_mode, stripe_onboarded_at')
    .eq('id', member.gym_id)
    .maybeSingle()

  let tariffName: string | null = null
  let tariffAmount: number | null = null
  let tariffType: string | null = null
  let stripePriceId: string | null = null

  if (member.current_tariff_id) {
    const { data: tariff } = await supabase
      .from('tariffs')
      .select('name, price, type, stripe_price_id')
      .eq('id', member.current_tariff_id)
      .maybeSingle()
    if (tariff) {
      tariffName = tariff.name
      tariffAmount = Number(tariff.price ?? 0)
      tariffType = tariff.type
      stripePriceId = tariff.stripe_price_id
    }
  }

  const { data: payments } = await supabase
    .from('payments')
    .select(
      'id, amount, currency, status, paid_at, created_at, description, payment_source, stripe_invoice_id'
    )
    .eq('member_id', member.id)
    .order('created_at', { ascending: false })
    .limit(12)

  const recentPayments: MemberPayment[] = (payments ?? []).map((p) => ({
    id: p.id,
    amount: Number(p.amount ?? 0),
    currency: p.currency ?? 'EUR',
    status: p.status,
    paidAt: p.paid_at,
    createdAt: p.created_at,
    description: p.description,
    paymentSource: p.payment_source,
    stripeInvoiceId: p.stripe_invoice_id,
  }))

  const fullName = `${member.first_name} ${member.last_name}`.trim()

  return {
    memberId: member.id,
    gymId: member.gym_id,
    fullName,
    email: member.email ?? '',
    phone: member.phone,
    memberStatus: member.status,
    tariffName,
    tariffAmount,
    tariffType,
    stripePriceId,
    stripeCustomerId: member.stripe_customer_id,
    stripeSubscriptionId: member.stripe_subscription_id,
    subscriptionStatus: (member.subscription_status ?? null) as SubscriptionStatus,
    subscriptionCurrentPeriodEnd: member.subscription_current_period_end,
    gymName: gym?.name ?? '',
    gymPaymentMode: gym?.payment_mode ?? 'manual',
    stripeOnboarded: Boolean(gym?.stripe_onboarded_at),
    recentPayments,
  }
}
