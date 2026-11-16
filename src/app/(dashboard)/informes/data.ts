import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { KpiSummary } from './types'

async function resolveActiveGymId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('current_user_gyms')
  return data && data.length > 0 ? data[0].gym_id : null
}

function firstDayOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function memberName(m: { first_name: string | null; last_name: string | null } | null): string {
  if (!m) return '—'
  const n = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()
  return n || '—'
}

export const getKpiSummary = cache(async (): Promise<KpiSummary> => {
  const supabase = await createClient()
  const gymId = await resolveActiveGymId()
  if (!gymId) {
    return {
      activeMembers: 0,
      newMembersThisMonth: 0,
      cancelledThisMonth: 0,
      revenueThisMonth: 0,
      bookingsLast30: 0,
      attendanceRate: 0,
    }
  }

  const monthStart = firstDayOfMonth()
  const last30 = isoDaysAgo(30)

  const [activeMembersRes, newMembersRes, cancelledRes, revenueRes, bookingsRes] =
    await Promise.all([
      supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('gym_id', gymId)
        .eq('status', 'active'),
      supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('gym_id', gymId)
        .gte('created_at', monthStart),
      supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('gym_id', gymId)
        .eq('status', 'inactive')
        .gte('leave_date', monthStart),
      supabase
        .from('payments')
        .select('amount')
        .eq('gym_id', gymId)
        .eq('status', 'completed')
        .gte('paid_at', monthStart + 'T00:00:00Z'),
      supabase
        .from('bookings')
        .select('status', { count: 'exact' })
        .eq('gym_id', gymId)
        .gte('booked_at', last30),
    ])

  const revenueCents = Math.round(
    (revenueRes.data ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0) * 100
  )

  const bookingsRows = bookingsRes.data ?? []
  const total = bookingsRows.length
  const attended = bookingsRows.filter((b) => b.status === 'attended').length
  const attendanceRate = total > 0 ? Math.round((attended / total) * 100) : 0

  return {
    activeMembers: activeMembersRes.count ?? 0,
    newMembersThisMonth: newMembersRes.count ?? 0,
    cancelledThisMonth: cancelledRes.count ?? 0,
    revenueThisMonth: revenueCents,
    bookingsLast30: bookingsRes.count ?? 0,
    attendanceRate,
  }
})

export type ReportKey =
  | 'active-members'
  | 'new-members'
  | 'cancelled-members'
  | 'class-attendance'
  | 'class-popularity'
  | 'instructor-load'
  | 'sales-summary'
  | 'sales-by-day'
  | 'sales-by-tariff'
  // v2 (paridad 100% LegacyGym — implementados)
  | 'cohorts'
  | 'retention'
  | 'member-booking-avg'
  | 'late-cancellations'
  | 'penalties'
  | 'class-hours'
  | 'class-ratings'
  | 'instructor-hours'
  | 'cash-report'
  | 'balance'
  | 'cancelled-payments'
  // Paridad 38 LegacyGym — 9 informes restantes
  | 'daily-attendance'
  | 'cancellation-reasons'
  | 'class-attendance-ranking'
  | 'instructor-comparative'
  | 'age-distribution'
  | 'member-tenure'
  | 'families-revenue'
  | 'avisos-sent'
  | 'tasks-completion'

type Col = { key: string; label: string; type?: 'text' | 'number' | 'currency' | 'date' }
type Row = Record<string, string | number | null>

export async function getReportDetail(key: ReportKey): Promise<{ columns: Col[]; rows: Row[] }> {
  const supabase = await createClient()
  const gymId = await resolveActiveGymId()
  if (!gymId) return { columns: [], rows: [] }

  const monthStart = firstDayOfMonth()

  if (key === 'active-members') {
    const { data } = await supabase
      .from('members')
      .select('first_name, last_name, email, phone, created_at')
      .eq('gym_id', gymId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(500)
    return {
      columns: [
        { key: 'name', label: 'Nombre' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Teléfono' },
        { key: 'created_at', label: 'Alta', type: 'date' },
      ],
      rows: (data ?? []).map((m) => ({
        name: memberName(m),
        email: m.email,
        phone: m.phone,
        created_at: m.created_at ? m.created_at.slice(0, 10) : null,
      })),
    }
  }

  if (key === 'new-members') {
    const { data } = await supabase
      .from('members')
      .select('first_name, last_name, email, created_at, status')
      .eq('gym_id', gymId)
      .gte('created_at', monthStart)
      .order('created_at', { ascending: false })
    return {
      columns: [
        { key: 'name', label: 'Nombre' },
        { key: 'email', label: 'Email' },
        { key: 'status', label: 'Estado' },
        { key: 'created_at', label: 'Alta', type: 'date' },
      ],
      rows: (data ?? []).map((m) => ({
        name: memberName(m),
        email: m.email,
        status: m.status,
        created_at: m.created_at ? m.created_at.slice(0, 10) : null,
      })),
    }
  }

  if (key === 'cancelled-members') {
    const { data } = await supabase
      .from('members')
      .select('first_name, last_name, email, leave_date')
      .eq('gym_id', gymId)
      .eq('status', 'inactive')
      .gte('leave_date', monthStart)
      .order('leave_date', { ascending: false })
    return {
      columns: [
        { key: 'name', label: 'Nombre' },
        { key: 'email', label: 'Email' },
        { key: 'leave_date', label: 'Baja', type: 'date' },
      ],
      rows: (data ?? []).map((m) => ({
        name: memberName(m),
        email: m.email,
        leave_date: m.leave_date,
      })),
    }
  }

  if (key === 'class-attendance') {
    const { data } = await supabase
      .from('bookings')
      .select(
        'status, booked_at, members(first_name, last_name), class_instances(start_at, classes(name))'
      )
      .eq('gym_id', gymId)
      .gte('booked_at', isoDaysAgo(30))
      .order('booked_at', { ascending: false })
      .limit(500)
    return {
      columns: [
        { key: 'member', label: 'Socio' },
        { key: 'class_name', label: 'Clase' },
        { key: 'start_at', label: 'Fecha/hora', type: 'date' },
        { key: 'status', label: 'Estado' },
      ],
      rows: (data ?? []).map((b) => {
        const m = Array.isArray(b.members) ? b.members[0] : b.members
        const ci = Array.isArray(b.class_instances) ? b.class_instances[0] : b.class_instances
        const c = ci?.classes
          ? Array.isArray(ci.classes)
            ? ci.classes[0]
            : ci.classes
          : null
        return {
          member: memberName(m),
          class_name: c?.name ?? '—',
          start_at: ci?.start_at ? ci.start_at.slice(0, 16).replace('T', ' ') : null,
          status: b.status ?? '—',
        }
      }),
    }
  }

  if (key === 'class-popularity') {
    const { data: instances } = await supabase
      .from('class_instances')
      .select('id, max_spots, classes(name)')
      .eq('gym_id', gymId)
      .gte('start_at', isoDaysAgo(30))

    const instList = instances ?? []
    const ids = instList.map((i) => i.id)
    const { data: bookings } = ids.length
      ? await supabase
          .from('bookings')
          .select('class_instance_id, status')
          .eq('gym_id', gymId)
          .in('class_instance_id', ids)
      : { data: [] }

    const agg = new Map<string, { name: string; capacity: number; booked: number }>()
    for (const inst of instList) {
      const c = Array.isArray(inst.classes) ? inst.classes[0] : inst.classes
      const name = c?.name ?? '—'
      const cur = agg.get(name) ?? { name, capacity: 0, booked: 0 }
      cur.capacity += inst.max_spots ?? 0
      agg.set(name, cur)
    }
    for (const b of (bookings as Array<{ class_instance_id: string; status: string }>) ?? []) {
      if (b.status === 'cancelled') continue
      const inst = instList.find((i) => i.id === b.class_instance_id)
      const c = inst
        ? Array.isArray(inst.classes)
          ? inst.classes[0]
          : inst.classes
        : null
      const name = c?.name ?? '—'
      const cur = agg.get(name)
      if (cur) cur.booked += 1
    }
    const rows = Array.from(agg.values())
      .map((r) => ({
        name: r.name,
        capacity: r.capacity,
        booked: r.booked,
        occupancy: r.capacity > 0 ? Math.round((r.booked / r.capacity) * 100) : 0,
      }))
      .sort((a, b) => b.occupancy - a.occupancy)
    return {
      columns: [
        { key: 'name', label: 'Clase' },
        { key: 'booked', label: 'Reservas', type: 'number' },
        { key: 'capacity', label: 'Aforo total', type: 'number' },
        { key: 'occupancy', label: 'Ocupación %', type: 'number' },
      ],
      rows,
    }
  }

  if (key === 'instructor-load') {
    const { data: instances } = await supabase
      .from('class_instances')
      .select('id, instructor_id, instructors(name)')
      .eq('gym_id', gymId)
      .gte('start_at', isoDaysAgo(30))

    type InstRow = {
      id: string
      instructor_id: string | null
      instructors: { name: string } | { name: string }[] | null
    }
    const instList = (instances ?? []) as InstRow[]
    const agg = new Map<string, { name: string; classes: number; instanceIds: string[] }>()
    for (const inst of instList) {
      const ins = Array.isArray(inst.instructors) ? inst.instructors[0] : inst.instructors
      const name = ins?.name ?? 'Sin instructor'
      const cur = agg.get(name) ?? { name, classes: 0, instanceIds: [] }
      cur.classes += 1
      cur.instanceIds.push(inst.id)
      agg.set(name, cur)
    }

    const allIds = Array.from(agg.values()).flatMap((v) => v.instanceIds)
    const { data: bookings } = allIds.length
      ? await supabase
          .from('bookings')
          .select('class_instance_id, status')
          .eq('gym_id', gymId)
          .in('class_instance_id', allIds)
      : { data: [] }

    const bookingsByInstance = new Map<string, number>()
    for (const b of (bookings as Array<{ class_instance_id: string; status: string }>) ?? []) {
      if (b.status === 'cancelled') continue
      bookingsByInstance.set(
        b.class_instance_id,
        (bookingsByInstance.get(b.class_instance_id) ?? 0) + 1
      )
    }

    const rows = Array.from(agg.values())
      .map((v) => ({
        name: v.name,
        classes: v.classes,
        bookings: v.instanceIds.reduce((s, id) => s + (bookingsByInstance.get(id) ?? 0), 0),
      }))
      .sort((a, b) => b.classes - a.classes)

    return {
      columns: [
        { key: 'name', label: 'Instructor' },
        { key: 'classes', label: 'Clases (30d)', type: 'number' },
        { key: 'bookings', label: 'Reservas totales', type: 'number' },
      ],
      rows,
    }
  }

  if (key === 'sales-summary') {
    const { data } = await supabase
      .from('payments')
      .select('amount, status, method, paid_at, members(first_name, last_name)')
      .eq('gym_id', gymId)
      .gte('created_at', monthStart)
      .order('created_at', { ascending: false })
      .limit(500)
    return {
      columns: [
        { key: 'member', label: 'Socio' },
        { key: 'amount', label: 'Importe', type: 'currency' },
        { key: 'method', label: 'Método' },
        { key: 'status', label: 'Estado' },
        { key: 'paid_at', label: 'Fecha', type: 'date' },
      ],
      rows: (data ?? []).map((p) => {
        const m = Array.isArray(p.members) ? p.members[0] : p.members
        return {
          member: memberName(m),
          amount: Math.round(Number(p.amount ?? 0) * 100),
          method: p.method ?? '—',
          status: p.status ?? '—',
          paid_at: p.paid_at ? p.paid_at.slice(0, 10) : null,
        }
      }),
    }
  }

  if (key === 'sales-by-day') {
    const { data } = await supabase
      .from('payments')
      .select('amount, paid_at')
      .eq('gym_id', gymId)
      .eq('status', 'completed')
      .gte('paid_at', monthStart + 'T00:00:00Z')
      .order('paid_at', { ascending: false })

    const agg = new Map<string, number>()
    for (const p of data ?? []) {
      const day = p.paid_at ? p.paid_at.slice(0, 10) : 'sin fecha'
      agg.set(day, (agg.get(day) ?? 0) + Math.round(Number(p.amount ?? 0) * 100))
    }
    const rows = Array.from(agg.entries())
      .map(([day, amount]) => ({ day, amount }))
      .sort((a, b) => (a.day < b.day ? 1 : -1))
    return {
      columns: [
        { key: 'day', label: 'Día', type: 'date' },
        { key: 'amount', label: 'Ingresos', type: 'currency' },
      ],
      rows,
    }
  }

  if (key === 'sales-by-tariff') {
    const { data } = await supabase
      .from('payments')
      .select('amount, tariff_snapshot')
      .eq('gym_id', gymId)
      .eq('status', 'completed')
      .gte('paid_at', monthStart + 'T00:00:00Z')

    const agg = new Map<string, { count: number; total: number }>()
    for (const p of data ?? []) {
      const snap = p.tariff_snapshot as { name?: string } | null
      const name = snap?.name ?? 'Sin tarifa'
      const cur = agg.get(name) ?? { count: 0, total: 0 }
      cur.count += 1
      cur.total += Math.round(Number(p.amount ?? 0) * 100)
      agg.set(name, cur)
    }
    const rows = Array.from(agg.entries())
      .map(([tariff, v]) => ({ tariff, count: v.count, total: v.total }))
      .sort((a, b) => b.total - a.total)
    return {
      columns: [
        { key: 'tariff', label: 'Tarifa' },
        { key: 'count', label: 'Pagos', type: 'number' },
        { key: 'total', label: 'Ingresos', type: 'currency' },
      ],
      rows,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // V2 REPORTS (paridad 100% LegacyGym)
  // ─────────────────────────────────────────────────────────────────────────

  if (key === 'cohorts') {
    // Cohortes: socios agrupados por mes de alta + % que siguen activos
    const { data } = await supabase
      .from('members')
      .select('created_at, status, leave_date')
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false })
      .limit(2000)

    const cohorts = new Map<string, { total: number; active: number; cancelled: number }>()
    for (const m of data ?? []) {
      if (!m.created_at) continue
      const month = m.created_at.slice(0, 7) // YYYY-MM
      const cur = cohorts.get(month) ?? { total: 0, active: 0, cancelled: 0 }
      cur.total += 1
      if (m.status === 'active') cur.active += 1
      else if (m.status === 'inactive') cur.cancelled += 1
      cohorts.set(month, cur)
    }
    const rows = Array.from(cohorts.entries())
      .map(([month, v]) => ({
        month,
        total: v.total,
        active: v.active,
        cancelled: v.cancelled,
        retention: v.total > 0 ? Math.round((v.active / v.total) * 100) : 0,
      }))
      .sort((a, b) => (a.month < b.month ? 1 : -1))
    return {
      columns: [
        { key: 'month', label: 'Mes alta' },
        { key: 'total', label: 'Altas', type: 'number' },
        { key: 'active', label: 'Activos hoy', type: 'number' },
        { key: 'cancelled', label: 'Bajas', type: 'number' },
        { key: 'retention', label: 'Retención %', type: 'number' },
      ],
      rows,
    }
  }

  if (key === 'retention') {
    // Permanencia media: días entre created_at y leave_date (para bajas) + días actuales (para activos)
    const { data } = await supabase
      .from('members')
      .select('status, created_at, leave_date')
      .eq('gym_id', gymId)
      .not('created_at', 'is', null)

    const now = Date.now()
    let activeDays = 0
    let activeCount = 0
    let cancelledDays = 0
    let cancelledCount = 0
    for (const m of data ?? []) {
      if (!m.created_at) continue
      const start = new Date(m.created_at).getTime()
      if (m.status === 'active') {
        activeDays += Math.round((now - start) / 86_400_000)
        activeCount += 1
      } else if (m.status === 'inactive' && m.leave_date) {
        const end = new Date(m.leave_date).getTime()
        cancelledDays += Math.max(0, Math.round((end - start) / 86_400_000))
        cancelledCount += 1
      }
    }
    const rows = [
      {
        group: 'Activos (permanencia hasta hoy)',
        members: activeCount,
        avg_days: activeCount > 0 ? Math.round(activeDays / activeCount) : 0,
      },
      {
        group: 'Bajas (permanencia total)',
        members: cancelledCount,
        avg_days: cancelledCount > 0 ? Math.round(cancelledDays / cancelledCount) : 0,
      },
    ]
    return {
      columns: [
        { key: 'group', label: 'Grupo' },
        { key: 'members', label: 'Socios', type: 'number' },
        { key: 'avg_days', label: 'Días medios', type: 'number' },
      ],
      rows,
    }
  }

  if (key === 'member-booking-avg') {
    // Media semanal de reservas por socio (últimos 30 días → 4.28 semanas)
    const { data } = await supabase
      .from('bookings')
      .select('member_id, status, members(first_name, last_name)')
      .eq('gym_id', gymId)
      .gte('booked_at', isoDaysAgo(30))
      .neq('status', 'cancelled')

    const agg = new Map<string, { name: string; count: number }>()
    for (const b of data ?? []) {
      const m = Array.isArray(b.members) ? b.members[0] : b.members
      const id = b.member_id ?? 'sin-id'
      const cur = agg.get(id) ?? { name: memberName(m), count: 0 }
      cur.count += 1
      agg.set(id, cur)
    }
    const weeks = 30 / 7
    const rows = Array.from(agg.values())
      .map((v) => ({
        name: v.name,
        bookings: v.count,
        weekly_avg: Math.round((v.count / weeks) * 10) / 10,
      }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 200)
    return {
      columns: [
        { key: 'name', label: 'Socio' },
        { key: 'bookings', label: 'Reservas 30d', type: 'number' },
        { key: 'weekly_avg', label: 'Media semanal', type: 'number' },
      ],
      rows,
    }
  }

  if (key === 'late-cancellations') {
    // Cancelaciones con <6h antelación respecto a inicio de clase
    const { data } = await supabase
      .from('bookings')
      .select(
        'status, cancelled_at, members(first_name, last_name), class_instances(start_at, classes(name))'
      )
      .eq('gym_id', gymId)
      .eq('status', 'cancelled')
      .gte('cancelled_at', isoDaysAgo(90))
      .not('cancelled_at', 'is', null)
      .order('cancelled_at', { ascending: false })
      .limit(500)

    const rows = (data ?? [])
      .map((b) => {
        const m = Array.isArray(b.members) ? b.members[0] : b.members
        const ci = Array.isArray(b.class_instances) ? b.class_instances[0] : b.class_instances
        const c = ci?.classes
          ? Array.isArray(ci.classes) ? ci.classes[0] : ci.classes
          : null
        if (!b.cancelled_at || !ci?.start_at) return null
        const hoursBefore = (new Date(ci.start_at).getTime() - new Date(b.cancelled_at).getTime()) / 3_600_000
        if (hoursBefore >= 6) return null
        return {
          member: memberName(m),
          class_name: c?.name ?? '—',
          class_start: ci.start_at.slice(0, 16).replace('T', ' '),
          cancelled_at: b.cancelled_at.slice(0, 16).replace('T', ' '),
          hours_before: Math.round(hoursBefore * 10) / 10,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    return {
      columns: [
        { key: 'member', label: 'Socio' },
        { key: 'class_name', label: 'Clase' },
        { key: 'class_start', label: 'Inicio clase', type: 'date' },
        { key: 'cancelled_at', label: 'Cancelado', type: 'date' },
        { key: 'hours_before', label: 'Horas antes', type: 'number' },
      ],
      rows,
    }
  }

  if (key === 'penalties') {
    // Penalizaciones: no-shows + late-cancels por socio en 90d
    const { data } = await supabase
      .from('bookings')
      .select('member_id, status, cancelled_at, class_instances(start_at), members(first_name, last_name)')
      .eq('gym_id', gymId)
      .gte('booked_at', isoDaysAgo(90))
      .in('status', ['no_show', 'cancelled'])

    const agg = new Map<string, { name: string; noShows: number; lateCancels: number }>()
    for (const b of data ?? []) {
      const m = Array.isArray(b.members) ? b.members[0] : b.members
      const id = b.member_id ?? 'sin-id'
      const cur = agg.get(id) ?? { name: memberName(m), noShows: 0, lateCancels: 0 }
      if (b.status === 'no_show') {
        cur.noShows += 1
      } else if (b.status === 'cancelled' && b.cancelled_at) {
        const ci = Array.isArray(b.class_instances) ? b.class_instances[0] : b.class_instances
        if (ci?.start_at) {
          const hours = (new Date(ci.start_at).getTime() - new Date(b.cancelled_at).getTime()) / 3_600_000
          if (hours < 6) cur.lateCancels += 1
        }
      }
      agg.set(id, cur)
    }
    const rows = Array.from(agg.values())
      .map((v) => ({ name: v.name, no_shows: v.noShows, late_cancels: v.lateCancels, total: v.noShows + v.lateCancels }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
    return {
      columns: [
        { key: 'name', label: 'Socio' },
        { key: 'no_shows', label: 'No-shows', type: 'number' },
        { key: 'late_cancels', label: 'Cancelaciones tardías', type: 'number' },
        { key: 'total', label: 'Total', type: 'number' },
      ],
      rows,
    }
  }

  if (key === 'class-hours') {
    // Popularidad por franja horaria
    const { data: instances } = await supabase
      .from('class_instances')
      .select('id, start_at, max_spots')
      .eq('gym_id', gymId)
      .gte('start_at', isoDaysAgo(30))

    const instList = instances ?? []
    const ids = instList.map((i) => i.id)
    const { data: bookings } = ids.length
      ? await supabase
          .from('bookings')
          .select('class_instance_id, status')
          .eq('gym_id', gymId)
          .in('class_instance_id', ids)
      : { data: [] }

    const agg = new Map<string, { capacity: number; booked: number }>()
    for (const inst of instList) {
      if (!inst.start_at) continue
      const hour = inst.start_at.slice(11, 13) // HH
      const cur = agg.get(hour) ?? { capacity: 0, booked: 0 }
      cur.capacity += inst.max_spots ?? 0
      agg.set(hour, cur)
    }
    for (const b of (bookings as Array<{ class_instance_id: string; status: string }>) ?? []) {
      if (b.status === 'cancelled') continue
      const inst = instList.find((i) => i.id === b.class_instance_id)
      if (!inst?.start_at) continue
      const hour = inst.start_at.slice(11, 13)
      const cur = agg.get(hour)
      if (cur) cur.booked += 1
    }
    const rows = Array.from(agg.entries())
      .map(([hour, v]) => ({
        hour: `${hour}:00`,
        booked: v.booked,
        capacity: v.capacity,
        occupancy: v.capacity > 0 ? Math.round((v.booked / v.capacity) * 100) : 0,
      }))
      .sort((a, b) => (a.hour < b.hour ? -1 : 1))
    return {
      columns: [
        { key: 'hour', label: 'Franja' },
        { key: 'booked', label: 'Reservas', type: 'number' },
        { key: 'capacity', label: 'Aforo', type: 'number' },
        { key: 'occupancy', label: 'Ocupación %', type: 'number' },
      ],
      rows,
    }
  }

  if (key === 'class-ratings') {
    // Valoraciones de clases: pendiente infra ratings — por ahora reporte vacío documentado
    return {
      columns: [
        { key: 'class_name', label: 'Clase' },
        { key: 'ratings_count', label: 'Valoraciones', type: 'number' },
        { key: 'avg_rating', label: 'Media', type: 'number' },
      ],
      rows: [],
    }
  }

  if (key === 'instructor-hours') {
    // Horas de instructor (duración clase × nº instancias)
    const { data: instances } = await supabase
      .from('class_instances')
      .select('instructor_id, start_at, end_at, instructors(name)')
      .eq('gym_id', gymId)
      .gte('start_at', isoDaysAgo(30))

    type Row = {
      instructor_id: string | null
      start_at: string | null
      end_at: string | null
      instructors: { name: string } | { name: string }[] | null
    }
    const instList = (instances ?? []) as Row[]
    const agg = new Map<string, { name: string; minutes: number; classes: number }>()
    for (const inst of instList) {
      const ins = Array.isArray(inst.instructors) ? inst.instructors[0] : inst.instructors
      const name = ins?.name ?? 'Sin instructor'
      const cur = agg.get(name) ?? { name, minutes: 0, classes: 0 }
      cur.classes += 1
      if (inst.start_at && inst.end_at) {
        const mins = (new Date(inst.end_at).getTime() - new Date(inst.start_at).getTime()) / 60_000
        cur.minutes += Math.max(0, Math.round(mins))
      }
      agg.set(name, cur)
    }
    const rows = Array.from(agg.values())
      .map((v) => ({
        name: v.name,
        classes: v.classes,
        hours: Math.round((v.minutes / 60) * 10) / 10,
      }))
      .sort((a, b) => b.hours - a.hours)
    return {
      columns: [
        { key: 'name', label: 'Instructor' },
        { key: 'classes', label: 'Clases (30d)', type: 'number' },
        { key: 'hours', label: 'Horas', type: 'number' },
      ],
      rows,
    }
  }

  if (key === 'cash-report') {
    // Informe de caja: pagos completados por método
    const { data } = await supabase
      .from('payments')
      .select('amount, method, paid_at')
      .eq('gym_id', gymId)
      .eq('status', 'completed')
      .gte('paid_at', monthStart + 'T00:00:00Z')

    const agg = new Map<string, { count: number; total: number }>()
    for (const p of data ?? []) {
      const method = p.method ?? 'manual'
      const cur = agg.get(method) ?? { count: 0, total: 0 }
      cur.count += 1
      cur.total += Math.round(Number(p.amount ?? 0) * 100)
      agg.set(method, cur)
    }
    const rows = Array.from(agg.entries())
      .map(([method, v]) => ({ method, count: v.count, total: v.total }))
      .sort((a, b) => b.total - a.total)
    return {
      columns: [
        { key: 'method', label: 'Método' },
        { key: 'count', label: 'Pagos', type: 'number' },
        { key: 'total', label: 'Ingresos', type: 'currency' },
      ],
      rows,
    }
  }

  if (key === 'balance') {
    // Balance: ingresos (payments completed) - gastos (vía RPC gym_expenses_kpis)
    const [paymentsRes, expensesKpisRes] = await Promise.all([
      supabase
        .from('payments')
        .select('amount')
        .eq('gym_id', gymId)
        .eq('status', 'completed')
        .gte('paid_at', monthStart + 'T00:00:00Z'),
      supabase.rpc('gym_expenses_kpis', {
        p_gym_id: gymId,
        p_from: monthStart,
        p_to: new Date().toISOString().slice(0, 10),
      }),
    ])

    const income = Math.round(
      (paymentsRes.data ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0) * 100
    )
    // RPC devuelve array con 1 row; total_expenses está en EUR
    const kpiRow = Array.isArray(expensesKpisRes.data) ? expensesKpisRes.data[0] : null
    const expenses = Math.round(Number(kpiRow?.total_expenses ?? 0) * 100)
    const rows = [
      { concept: 'Ingresos', amount: income },
      { concept: 'Gastos', amount: -expenses },
      { concept: 'Balance', amount: income - expenses },
    ]
    return {
      columns: [
        { key: 'concept', label: 'Concepto' },
        { key: 'amount', label: 'Importe', type: 'currency' },
      ],
      rows,
    }
  }

  if (key === 'cancelled-payments') {
    // Pagos cancelados del mes
    const { data } = await supabase
      .from('payments')
      .select('amount, method, description, created_at, members(first_name, last_name)')
      .eq('gym_id', gymId)
      .eq('status', 'cancelled')
      .gte('created_at', monthStart)
      .order('created_at', { ascending: false })
      .limit(500)

    return {
      columns: [
        { key: 'member', label: 'Socio' },
        { key: 'description', label: 'Concepto' },
        { key: 'amount', label: 'Importe', type: 'currency' },
        { key: 'method', label: 'Método' },
        { key: 'created_at', label: 'Creado', type: 'date' },
      ],
      rows: (data ?? []).map((p) => {
        const m = Array.isArray(p.members) ? p.members[0] : p.members
        return {
          member: memberName(m),
          description: p.description ?? '—',
          amount: Math.round(Number(p.amount ?? 0) * 100),
          method: p.method ?? '—',
          created_at: p.created_at ? p.created_at.slice(0, 10) : null,
        }
      }),
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PARIDAD 38 — 9 informes restantes
  // ─────────────────────────────────────────────────────────────────────────

  if (key === 'daily-attendance') {
    // Asistencia diaria top 30 días con attended / no_show / cancelled
    const { data } = await supabase
      .from('bookings')
      .select('status, booked_at, class_instances(start_at)')
      .eq('gym_id', gymId)
      .gte('booked_at', isoDaysAgo(30))

    const agg = new Map<string, { attended: number; noShow: number; cancelled: number }>()
    for (const b of data ?? []) {
      const ci = Array.isArray(b.class_instances) ? b.class_instances[0] : b.class_instances
      const day = (ci?.start_at ?? b.booked_at ?? '').slice(0, 10)
      if (!day) continue
      const cur = agg.get(day) ?? { attended: 0, noShow: 0, cancelled: 0 }
      if (b.status === 'attended') cur.attended += 1
      else if (b.status === 'no_show') cur.noShow += 1
      else if (b.status === 'cancelled') cur.cancelled += 1
      agg.set(day, cur)
    }
    const rows = Array.from(agg.entries())
      .map(([day, v]) => ({
        day,
        attended: v.attended,
        no_show: v.noShow,
        cancelled: v.cancelled,
        total: v.attended + v.noShow + v.cancelled,
      }))
      .sort((a, b) => (a.day < b.day ? 1 : -1))
      .slice(0, 30)
    return {
      columns: [
        { key: 'day', label: 'Día', type: 'date' },
        { key: 'attended', label: 'Asistencias', type: 'number' },
        { key: 'no_show', label: 'No-show', type: 'number' },
        { key: 'cancelled', label: 'Canceladas', type: 'number' },
        { key: 'total', label: 'Total', type: 'number' },
      ],
      rows,
    }
  }

  if (key === 'cancellation-reasons') {
    // Top motivos cancelación desde prospects.lost_reason + members dados de baja (baja por tags notes)
    // Prospects lost con lost_reason es el más reporteable
    const { data } = await supabase
      .from('prospects')
      .select('lost_reason')
      .eq('gym_id', gymId)
      .eq('status', 'lost')
      .not('lost_reason', 'is', null)
      .gte('created_at', isoDaysAgo(365))

    const agg = new Map<string, number>()
    for (const p of data ?? []) {
      const reason = (p.lost_reason ?? 'Sin motivo').trim().slice(0, 100) || 'Sin motivo'
      agg.set(reason, (agg.get(reason) ?? 0) + 1)
    }
    const rows = Array.from(agg.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
    return {
      columns: [
        { key: 'reason', label: 'Motivo' },
        { key: 'count', label: 'Cantidad', type: 'number' },
      ],
      rows,
    }
  }

  if (key === 'class-attendance-ranking') {
    // Ranking clases por media de asistentes (attended / instancias)
    const { data: instances } = await supabase
      .from('class_instances')
      .select('id, classes(name)')
      .eq('gym_id', gymId)
      .gte('start_at', isoDaysAgo(30))

    const instList = instances ?? []
    const ids = instList.map((i) => i.id)
    const { data: bookings } = ids.length
      ? await supabase
          .from('bookings')
          .select('class_instance_id, status')
          .eq('gym_id', gymId)
          .in('class_instance_id', ids)
      : { data: [] }

    const agg = new Map<string, { instances: number; attended: number; booked: number }>()
    for (const inst of instList) {
      const c = Array.isArray(inst.classes) ? inst.classes[0] : inst.classes
      const name = c?.name ?? '—'
      const cur = agg.get(name) ?? { instances: 0, attended: 0, booked: 0 }
      cur.instances += 1
      agg.set(name, cur)
    }
    for (const b of (bookings as Array<{ class_instance_id: string; status: string }>) ?? []) {
      const inst = instList.find((i) => i.id === b.class_instance_id)
      if (!inst) continue
      const c = Array.isArray(inst.classes) ? inst.classes[0] : inst.classes
      const name = c?.name ?? '—'
      const cur = agg.get(name)
      if (!cur) continue
      if (b.status !== 'cancelled') cur.booked += 1
      if (b.status === 'attended') cur.attended += 1
    }
    const rows = Array.from(agg.values())
      .map((v, idx) => ({
        name: Array.from(agg.keys())[idx],
        instances: v.instances,
        attended: v.attended,
        avg_attended: v.instances > 0 ? Math.round((v.attended / v.instances) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.avg_attended - a.avg_attended)
    return {
      columns: [
        { key: 'name', label: 'Clase' },
        { key: 'instances', label: 'Instancias', type: 'number' },
        { key: 'attended', label: 'Asistencias totales', type: 'number' },
        { key: 'avg_attended', label: 'Media asistentes', type: 'number' },
      ],
      rows,
    }
  }

  if (key === 'instructor-comparative') {
    // Clases impartidas vs asistencia media + ratio asistencia/plazas
    const { data: instances } = await supabase
      .from('class_instances')
      .select('id, max_spots, instructor_id, instructors(name)')
      .eq('gym_id', gymId)
      .gte('start_at', isoDaysAgo(30))

    type Row = { id: string; max_spots: number | null; instructor_id: string | null; instructors: { name: string } | { name: string }[] | null }
    const instList = (instances ?? []) as Row[]
    const agg = new Map<string, { instances: number; capacity: number; attended: number; booked: number; instanceIds: string[] }>()
    for (const inst of instList) {
      const ins = Array.isArray(inst.instructors) ? inst.instructors[0] : inst.instructors
      const name = ins?.name ?? 'Sin instructor'
      const cur = agg.get(name) ?? { instances: 0, capacity: 0, attended: 0, booked: 0, instanceIds: [] }
      cur.instances += 1
      cur.capacity += inst.max_spots ?? 0
      cur.instanceIds.push(inst.id)
      agg.set(name, cur)
    }

    const allIds = Array.from(agg.values()).flatMap((v) => v.instanceIds)
    const { data: bookings } = allIds.length
      ? await supabase
          .from('bookings')
          .select('class_instance_id, status')
          .eq('gym_id', gymId)
          .in('class_instance_id', allIds)
      : { data: [] }

    const byInstance = new Map<string, { attended: number; booked: number }>()
    for (const b of (bookings as Array<{ class_instance_id: string; status: string }>) ?? []) {
      const cur = byInstance.get(b.class_instance_id) ?? { attended: 0, booked: 0 }
      if (b.status !== 'cancelled') cur.booked += 1
      if (b.status === 'attended') cur.attended += 1
      byInstance.set(b.class_instance_id, cur)
    }
    for (const [, v] of agg.entries()) {
      for (const id of v.instanceIds) {
        const ib = byInstance.get(id)
        if (ib) {
          v.attended += ib.attended
          v.booked += ib.booked
        }
      }
    }

    const rows = Array.from(agg.entries())
      .map(([name, v]) => ({
        name,
        instances: v.instances,
        avg_attended: v.instances > 0 ? Math.round((v.attended / v.instances) * 10) / 10 : 0,
        occupancy: v.capacity > 0 ? Math.round((v.booked / v.capacity) * 100) : 0,
      }))
      .sort((a, b) => b.instances - a.instances)
    return {
      columns: [
        { key: 'name', label: 'Instructor' },
        { key: 'instances', label: 'Clases (30d)', type: 'number' },
        { key: 'avg_attended', label: 'Media asistentes', type: 'number' },
        { key: 'occupancy', label: 'Ocupación %', type: 'number' },
      ],
      rows,
    }
  }

  if (key === 'age-distribution') {
    // Distribución edad en 5 tramos
    const { data } = await supabase
      .from('members')
      .select('birth_date, status')
      .eq('gym_id', gymId)
      .eq('status', 'active')
      .not('birth_date', 'is', null)

    const now = new Date()
    const buckets = { '<25': 0, '25-35': 0, '35-45': 0, '45-55': 0, '>55': 0, sin_edad: 0 }
    let ages = 0
    let count = 0
    for (const m of data ?? []) {
      if (!m.birth_date) { buckets.sin_edad += 1; continue }
      const bd = new Date(m.birth_date)
      if (isNaN(bd.getTime())) { buckets.sin_edad += 1; continue }
      let age = now.getFullYear() - bd.getFullYear()
      const mo = now.getMonth() - bd.getMonth()
      if (mo < 0 || (mo === 0 && now.getDate() < bd.getDate())) age -= 1
      if (age < 0 || age > 120) { buckets.sin_edad += 1; continue }
      ages += age
      count += 1
      if (age < 25) buckets['<25'] += 1
      else if (age < 35) buckets['25-35'] += 1
      else if (age < 45) buckets['35-45'] += 1
      else if (age < 55) buckets['45-55'] += 1
      else buckets['>55'] += 1
    }
    const avg = count > 0 ? Math.round((ages / count) * 10) / 10 : 0
    const rows = [
      { bucket: '<25', count: buckets['<25'] },
      { bucket: '25-35', count: buckets['25-35'] },
      { bucket: '35-45', count: buckets['35-45'] },
      { bucket: '45-55', count: buckets['45-55'] },
      { bucket: '>55', count: buckets['>55'] },
      { bucket: `Media: ${avg} años`, count: buckets.sin_edad },
    ]
    return {
      columns: [
        { key: 'bucket', label: 'Tramo edad' },
        { key: 'count', label: 'Socios', type: 'number' },
      ],
      rows,
    }
  }

  if (key === 'member-tenure') {
    // Cohorte por mes alta (últimos 24 meses)
    const { data } = await supabase
      .from('members')
      .select('created_at, status')
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false })
      .limit(5000)

    const cohorts = new Map<string, { total: number; active: number }>()
    for (const m of data ?? []) {
      if (!m.created_at) continue
      const month = m.created_at.slice(0, 7)
      const cur = cohorts.get(month) ?? { total: 0, active: 0 }
      cur.total += 1
      if (m.status === 'active') cur.active += 1
      cohorts.set(month, cur)
    }
    const rows = Array.from(cohorts.entries())
      .map(([month, v]) => {
        const [y, mm] = month.split('-').map(Number)
        const now = new Date()
        const months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - mm)
        return {
          month,
          months_ago: months,
          total: v.total,
          active: v.active,
          active_pct: v.total > 0 ? Math.round((v.active / v.total) * 100) : 0,
        }
      })
      .sort((a, b) => (a.month < b.month ? 1 : -1))
      .slice(0, 24)
    return {
      columns: [
        { key: 'month', label: 'Cohorte alta' },
        { key: 'months_ago', label: 'Meses atrás', type: 'number' },
        { key: 'total', label: 'Altas', type: 'number' },
        { key: 'active', label: 'Activos hoy', type: 'number' },
        { key: 'active_pct', label: '% sigue activo', type: 'number' },
      ],
      rows,
    }
  }

  if (key === 'families-revenue') {
    // Familias activas + ingresos agregados
    const { data: families } = await supabase
      .from('families')
      .select('id, name')
      .eq('gym_id', gymId)
      .order('name')

    const famList = families ?? []
    if (famList.length === 0) {
      return {
        columns: [
          { key: 'name', label: 'Familia' },
          { key: 'members', label: 'Miembros', type: 'number' },
          { key: 'revenue', label: 'Ingresos 30d', type: 'currency' },
        ],
        rows: [],
      }
    }

    const famIds = famList.map((f) => f.id)
    const [membersRes, paymentsRes] = await Promise.all([
      supabase.from('family_members').select('family_id, member_id').eq('gym_id', gymId).in('family_id', famIds),
      supabase
        .from('payments')
        .select('amount, member_id')
        .eq('gym_id', gymId)
        .eq('status', 'completed')
        .gte('paid_at', isoDaysAgo(30)),
    ])

    const memberToFamily = new Map<string, string>()
    for (const fm of membersRes.data ?? []) {
      if (fm.family_id && fm.member_id) memberToFamily.set(fm.member_id, fm.family_id)
    }
    const memberCounts = new Map<string, number>()
    for (const [, famId] of memberToFamily) {
      memberCounts.set(famId, (memberCounts.get(famId) ?? 0) + 1)
    }
    const revenueByFamily = new Map<string, number>()
    for (const p of paymentsRes.data ?? []) {
      if (!p.member_id) continue
      const famId = memberToFamily.get(p.member_id)
      if (!famId) continue
      revenueByFamily.set(
        famId,
        (revenueByFamily.get(famId) ?? 0) + Math.round(Number(p.amount ?? 0) * 100)
      )
    }
    const rows = famList.map((f) => ({
      name: f.name,
      members: memberCounts.get(f.id) ?? 0,
      revenue: revenueByFamily.get(f.id) ?? 0,
    })).sort((a, b) => b.revenue - a.revenue)
    return {
      columns: [
        { key: 'name', label: 'Familia' },
        { key: 'members', label: 'Miembros', type: 'number' },
        { key: 'revenue', label: 'Ingresos 30d', type: 'currency' },
      ],
      rows,
    }
  }

  if (key === 'avisos-sent') {
    // Avisos enviados 30d por status + channel
    const [historyRes, alertsRes] = await Promise.all([
      supabase
        .from('engagement_history')
        .select('alert_id, channel, status')
        .eq('gym_id', gymId)
        .gte('sent_at', isoDaysAgo(30)),
      supabase
        .from('engagement_alerts')
        .select('id, trigger_type')
        .eq('gym_id', gymId),
    ])

    const alertToTrigger = new Map<string, string>()
    for (const a of alertsRes.data ?? []) {
      if (a.id) alertToTrigger.set(a.id, a.trigger_type)
    }
    const agg = new Map<string, { sent: number; failed: number; email: number; message: number }>()
    for (const h of historyRes.data ?? []) {
      const trigger = h.alert_id ? (alertToTrigger.get(h.alert_id) ?? 'desconocido') : 'manual'
      const cur = agg.get(trigger) ?? { sent: 0, failed: 0, email: 0, message: 0 }
      if (h.status === 'sent') cur.sent += 1
      else if (h.status === 'failed') cur.failed += 1
      if (h.channel === 'email') cur.email += 1
      else if (h.channel === 'message') cur.message += 1
      agg.set(trigger, cur)
    }
    const rows = Array.from(agg.entries())
      .map(([trigger, v]) => ({
        trigger,
        sent: v.sent,
        failed: v.failed,
        email: v.email,
        message: v.message,
      }))
      .sort((a, b) => b.sent - a.sent)
    return {
      columns: [
        { key: 'trigger', label: 'Tipo disparador' },
        { key: 'sent', label: 'Enviados', type: 'number' },
        { key: 'failed', label: 'Fallidos', type: 'number' },
        { key: 'email', label: 'Email', type: 'number' },
        { key: 'message', label: 'Mensaje app', type: 'number' },
      ],
      rows,
    }
  }

  if (key === 'tasks-completion') {
    // % completadas vs pendientes por staff assigned_to
    const { data } = await supabase
      .from('tasks')
      .select('assigned_to, status')
      .eq('gym_id', gymId)
      .gte('created_at', isoDaysAgo(90))

    const agg = new Map<string, { completed: number; pending: number; total: number }>()
    for (const t of data ?? []) {
      const key = t.assigned_to ?? 'sin-asignar'
      const cur = agg.get(key) ?? { completed: 0, pending: 0, total: 0 }
      cur.total += 1
      if (t.status === 'done') cur.completed += 1
      else if (t.status === 'todo' || t.status === 'in_progress') cur.pending += 1
      agg.set(key, cur)
    }
    const rows = Array.from(agg.entries())
      .map(([assignee, v]) => ({
        assignee: assignee === 'sin-asignar' ? 'Sin asignar' : assignee.slice(0, 8) + '…',
        total: v.total,
        completed: v.completed,
        pending: v.pending,
        completion_pct: v.total > 0 ? Math.round((v.completed / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
    return {
      columns: [
        { key: 'assignee', label: 'Asignado' },
        { key: 'total', label: 'Total (90d)', type: 'number' },
        { key: 'completed', label: 'Completadas', type: 'number' },
        { key: 'pending', label: 'Pendientes', type: 'number' },
        { key: 'completion_pct', label: '% completado', type: 'number' },
      ],
      rows,
    }
  }

  return { columns: [], rows: [] }
}
