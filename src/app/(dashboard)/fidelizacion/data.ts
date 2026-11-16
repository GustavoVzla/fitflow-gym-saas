import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

export type TriggerType = 'no_attendance_x_days' | 'birthday' | 'subscription_expires_x_days'
export type Channel = 'email' | 'message'

export interface AlertRow {
  id: string
  name: string
  triggerType: TriggerType
  triggerValue: number | null
  channel: Channel
  messageTemplate: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface VipMember {
  id: string
  name: string
  email: string | null
  totalPaid: number
  bookingsCount: number
}

export interface HistoryRow {
  id: string
  memberName: string
  channel: Channel
  status: 'sent' | 'failed' | 'scheduled'
  alertName: string | null
  sentAt: string
  errorMessage: string | null
}

export const getAlerts = cache(async (): Promise<AlertRow[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('engagement_alerts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getAlerts] error:', error)
    return []
  }

  return (data ?? []).map((a): AlertRow => ({
    id: a.id,
    name: a.name,
    triggerType: a.trigger_type as TriggerType,
    triggerValue: a.trigger_value,
    channel: a.channel as Channel,
    messageTemplate: a.message_template,
    isActive: a.is_active,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  }))
})

export const getVipMembers = cache(async (): Promise<VipMember[]> => {
  const supabase = await createClient()
  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name, email')
    .eq('status', 'active')
    .limit(500)

  if (!members || members.length === 0) return []

  const { data: payments } = await supabase
    .from('payments')
    .select('member_id, amount')
    .eq('status', 'completed')

  const { data: bookings } = await supabase
    .from('bookings')
    .select('member_id')
    .eq('status', 'confirmed')

  const paidMap = new Map<string, number>()
  ;(payments ?? []).forEach((p) => {
    if (!p.member_id) return
    paidMap.set(p.member_id, (paidMap.get(p.member_id) ?? 0) + Number(p.amount))
  })

  const bookMap = new Map<string, number>()
  ;(bookings ?? []).forEach((b) => {
    if (!b.member_id) return
    bookMap.set(b.member_id, (bookMap.get(b.member_id) ?? 0) + 1)
  })

  return members
    .map((m) => ({
      id: m.id,
      name: `${m.first_name} ${m.last_name}`.trim(),
      email: m.email,
      totalPaid: paidMap.get(m.id) ?? 0,
      bookingsCount: bookMap.get(m.id) ?? 0,
    }))
    .filter((m) => m.totalPaid > 0 || m.bookingsCount > 0)
    .sort((a, b) => b.totalPaid - a.totalPaid || b.bookingsCount - a.bookingsCount)
    .slice(0, 20)
})

export const getEngagementHistory = cache(async (): Promise<HistoryRow[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('engagement_history')
    .select(`
      id, channel, status, error_message, sent_at,
      member:member_id (first_name, last_name),
      alert:alert_id (name)
    `)
    .gte('sent_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .order('sent_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[getEngagementHistory] error:', error)
    return []
  }

  return (data ?? []).map((h): HistoryRow => {
    const member = Array.isArray(h.member) ? h.member[0] : h.member
    const alert = Array.isArray(h.alert) ? h.alert[0] : h.alert
    return {
      id: h.id,
      memberName: member ? `${member.first_name} ${member.last_name}`.trim() : 'Socio eliminado',
      channel: h.channel as Channel,
      status: h.status as 'sent' | 'failed' | 'scheduled',
      alertName: alert?.name ?? null,
      sentAt: h.sent_at,
      errorMessage: h.error_message,
    }
  })
})
