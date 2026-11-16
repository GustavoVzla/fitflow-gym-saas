import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type {
  TaskRow,
  DbTaskStatus,
  DbTaskPriority,
  DbTaskRecurrence,
  MemberOption,
  InstructorOption,
  StaffOption,
  PaymentOption,
} from './types'
import { PRIORITY_MAP, computeDueDateLabel } from './types'

export type {
  TaskRow,
  DbTaskStatus,
  DbTaskPriority,
  DbTaskRecurrence,
  MemberOption,
  InstructorOption,
  StaffOption,
  PaymentOption,
} from './types'

export const getTasks = cache(async (): Promise<TaskRow[]> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tasks')
    .select(`
      id, title, description, status, priority,
      assigned_to, member_id, instructor_id, phone,
      related_payment_id, recurrence_type, recurrence_interval, recurrence_end_date,
      due_date, created_at, completed_at, created_by,
      member:member_id ( first_name, last_name ),
      instructor:instructor_id ( name ),
      related_payment:related_payment_id ( amount, currency, description, period_start, created_at )
    `)
    .neq('status', 'archived')
    .order('completed_at', { ascending: true, nullsFirst: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getTasks] error:', error)
    return []
  }

  if (!data || data.length === 0) return []

  // Resolver nombres de staff (assigned_to / created_by) desde gym_users + auth.users
  const userIds = new Set<string>()
  for (const t of data) {
    if (t.assigned_to) userIds.add(t.assigned_to)
    if (t.created_by) userIds.add(t.created_by)
  }

  const userMap = await resolveUserNames(supabase, Array.from(userIds))

  return data.map((t): TaskRow => {
    const dueInfo = computeDueDateLabel(t.due_date)
    const member = Array.isArray(t.member) ? t.member[0] : t.member
    const instructor = Array.isArray(t.instructor) ? t.instructor[0] : t.instructor
    const payment = Array.isArray(t.related_payment) ? t.related_payment[0] : t.related_payment

    let paymentLabel: string | null = null
    if (payment) {
      const currency = (payment.currency as string | null) ?? 'EUR'
      const amount = payment.amount as number | null
      const descr = (payment.description as string | null) ?? ''
      const amountLabel = amount !== null ? `${amount.toFixed(2)} ${currency}` : ''
      paymentLabel = [amountLabel, descr].filter(Boolean).join(' · ')
    }

    return {
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status as DbTaskStatus,
      priority: t.priority as DbTaskPriority,
      uiPriority: PRIORITY_MAP[t.priority as DbTaskPriority] ?? 'Media',
      assignedTo: t.assigned_to,
      assignedToName: t.assigned_to ? userMap.get(t.assigned_to) ?? 'Staff' : null,
      memberId: t.member_id ?? null,
      memberName: member ? `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() : null,
      instructorId: t.instructor_id ?? null,
      instructorName: instructor?.name ?? null,
      phone: t.phone ?? null,
      relatedPaymentId: t.related_payment_id ?? null,
      relatedPaymentLabel: paymentLabel,
      recurrenceType: (t.recurrence_type as DbTaskRecurrence) ?? 'none',
      recurrenceInterval: t.recurrence_interval ?? null,
      recurrenceEndDate: t.recurrence_end_date ?? null,
      dueDate: t.due_date,
      dueDateLabel: dueInfo.label,
      createdAt: t.created_at,
      completedAt: t.completed_at,
      createdBy: t.created_by,
      createdByName: t.created_by ? userMap.get(t.created_by) ?? 'Staff' : null,
    }
  })
})

export const getMemberOptions = cache(async (): Promise<MemberOption[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('members')
    .select('id, first_name, last_name, phone')
    .in('status', ['active', 'pending'])
    .order('last_name', { ascending: true })
    .limit(1000)

  if (error) {
    console.error('[getMemberOptions] error:', error)
    return []
  }

  return (data ?? []).map((m) => ({
    id: m.id,
    name: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim(),
    phone: m.phone ?? null,
  }))
})

export const getInstructorOptions = cache(async (): Promise<InstructorOption[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('instructors')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('[getInstructorOptions] error:', error)
    return []
  }

  return (data ?? []).map((i) => ({ id: i.id, name: i.name }))
})

// Staff del gym activo: rol owner|admin|trainer. FK assigned_to = auth.users.id
export const getStaffOptions = cache(async (): Promise<StaffOption[]> => {
  const supabase = await createClient()
  const { data: gyms } = await supabase.rpc('current_user_gyms')
  if (!gyms || gyms.length === 0) return []
  const gymId = gyms[0].gym_id

  const { data, error } = await supabase
    .from('gym_users')
    .select('user_id, role')
    .eq('gym_id', gymId)
    .in('role', ['owner', 'admin', 'trainer'])

  if (error || !data) {
    console.error('[getStaffOptions] error:', error)
    return []
  }

  const userIds = data.map((r) => r.user_id)
  const userMap = await resolveUserNames(supabase, userIds)

  return data
    .map((r) => ({
      userId: r.user_id,
      label: `${userMap.get(r.user_id) ?? r.user_id.slice(0, 8)} · ${r.role}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

// Últimos pagos (para vincular tarea a factura/pago). Limita a 200 más recientes.
export const getPaymentOptions = cache(async (): Promise<PaymentOption[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payments')
    .select(
      `id, amount, currency, description, created_at, status,
       member:member_id ( first_name, last_name )`,
    )
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error || !data) {
    console.error('[getPaymentOptions] error:', error)
    return []
  }

  return data.map((p) => {
    const member = Array.isArray(p.member) ? p.member[0] : p.member
    const memberLabel = member
      ? `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim()
      : ''
    const date = new Date(p.created_at).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
    })
    const amount = `${Number(p.amount).toFixed(2)} ${p.currency ?? 'EUR'}`
    const parts = [date, amount, memberLabel, p.description].filter(Boolean)
    return { id: p.id, label: parts.join(' · ') }
  })
})

// Resuelve nombres de auth.users consultando raw_user_meta_data via RPC o fallback email.
// Usa gym_users join si encontramos display_name; si no, email from auth.users via service.
// Como no tenemos service_role en runtime server actions, hacemos best-effort con RPC.
async function resolveUserNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (userIds.length === 0) return map

  // RPC existente: `admin_list_gyms` no sirve. Usamos JOIN con auth_users via RPC si disponible.
  // Fallback: mostramos los primeros 8 chars del UUID.
  // TODO-P2: exponer RPC get_staff_display_name(uuid[]) con search_path=''
  try {
    // Por ahora, dejamos el fallback; el trigger de notificación usa user_id para link directo.
    for (const uid of userIds) {
      map.set(uid, uid.slice(0, 8))
    }
  } catch {
    // silent
  }
  return map
}
