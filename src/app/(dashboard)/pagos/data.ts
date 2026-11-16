import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { PaymentRow, MemberOption, TariffOption } from './types'

export type { PaymentRow, MemberOption, TariffOption } from './types'

export const getPayments = cache(async (): Promise<PaymentRow[]> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('payments')
    .select(`
      id, member_id, description, concept, amount, currency,
      method, status, period_start, period_end, due_date, paid_at, created_at,
      member:member_id (first_name, last_name, email)
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[getPayments] error:', error)
    return []
  }

  return (data ?? []).map((p): PaymentRow => {
    const member = Array.isArray(p.member) ? p.member[0] : p.member
    const memberName = member
      ? `${member.first_name} ${member.last_name}`.trim()
      : 'Socio eliminado'
    return {
      id: p.id,
      memberId: p.member_id,
      memberName,
      memberEmail: member?.email ?? null,
      description: p.description,
      concept: p.concept,
      amount: Number(p.amount),
      currency: p.currency,
      method: p.method,
      status: p.status,
      periodStart: p.period_start,
      periodEnd: p.period_end,
      dueDate: p.due_date,
      paidAt: p.paid_at,
      createdAt: p.created_at,
    }
  })
})

export const getActiveMembers = cache(async (): Promise<MemberOption[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('members')
    .select('id, first_name, last_name, email')
    .eq('status', 'active')
    .order('last_name', { ascending: true })
  return (data ?? []).map((m) => ({
    id: m.id,
    name: `${m.first_name} ${m.last_name}`.trim(),
    email: m.email,
  }))
})

export const getActiveTariffsForPayment = cache(
  async (): Promise<TariffOption[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('tariffs')
      .select('id, name, "group", price, type')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    return (data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      group: t.group,
      price: Number(t.price),
      type: t.type,
    }))
  }
)

export interface MorososState {
  featureEnabled: boolean
  blockAfterDays: number | null
  blockedCount: number
}

export const getMorososState = cache(async (): Promise<MorososState> => {
  const supabase = await createClient()
  const { data: gyms } = await supabase.rpc('current_user_gyms')
  if (!gyms || gyms.length === 0) {
    return { featureEnabled: false, blockAfterDays: null, blockedCount: 0 }
  }
  const gymId = gyms[0].gym_id

  const { data: gym } = await supabase
    .from('gyms')
    .select('block_morosos_after_days')
    .eq('id', gymId)
    .single()

  const blockAfterDays = gym?.block_morosos_after_days ?? null
  const featureEnabled = blockAfterDays !== null

  if (!featureEnabled) {
    return { featureEnabled: false, blockAfterDays: null, blockedCount: 0 }
  }

  const { count } = await supabase
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('gym_id', gymId)
    .not('blocked_for_morosos_at', 'is', null)

  return {
    featureEnabled: true,
    blockAfterDays,
    blockedCount: count ?? 0,
  }
})
