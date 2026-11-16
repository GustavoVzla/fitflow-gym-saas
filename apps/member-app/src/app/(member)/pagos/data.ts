import 'server-only'

import { createClient } from '@/lib/supabase/server'

export type PaymentRow = {
  id: string
  description: string
  amount: number
  currency: string
  status: string
  method: string
  dueDate: string | null
  paidAt: string | null
  invoiceUrl: string | null
  invoiceNumber: string | null
}

export type PaymentMode = string | null

export async function getPaymentsForMember(): Promise<{
  pending: PaymentRow[]
  history: PaymentRow[]
  paymentMode: PaymentMode
  gymId: string | null
  memberId: string | null
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return { pending: [], history: [], paymentMode: null, gymId: null, memberId: null }

  const { data: member } = await supabase
    .from('members')
    .select('id, gym_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!member)
    return { pending: [], history: [], paymentMode: null, gymId: null, memberId: null }

  const [{ data: gym }, { data: payments }] = await Promise.all([
    supabase.from('gyms').select('payment_mode').eq('id', member.gym_id).maybeSingle(),
    supabase
      .from('payments')
      .select(
        'id, description, amount, currency, status, method, due_date, paid_at, invoice_url, invoice_number'
      )
      .eq('member_id', member.id)
      .order('due_date', { ascending: false, nullsFirst: false })
      .limit(50),
  ])

  const all = (payments ?? []).map(
    (p): PaymentRow => ({
      id: p.id,
      description: p.description,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      method: p.method,
      dueDate: p.due_date,
      paidAt: p.paid_at,
      invoiceUrl: p.invoice_url,
      invoiceNumber: p.invoice_number,
    })
  )

  return {
    pending: all.filter((p) => p.status === 'pending'),
    history: all.filter((p) => p.status === 'completed' || p.status === 'failed'),
    paymentMode: (gym?.payment_mode as string | null) ?? null,
    gymId: member.gym_id,
    memberId: member.id,
  }
}
