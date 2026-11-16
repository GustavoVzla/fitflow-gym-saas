import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type {
  DashboardData,
  DashboardKPIs,
  DashboardUpcomingClass,
  DashboardRecentPayment,
  DashboardRevenueMonth,
  DashboardTariffDistribution,
  OnboardingProgress,
} from './dashboard-types'
import { METHOD_LABEL, GROUP_COLORS, DEFAULT_COLOR } from './dashboard-types'

function extractLocalTime(timestamptz: string): string {
  try {
    const d = new Date(timestamptz)
    const parts = new Intl.DateTimeFormat('es-ES', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d)
    const h = parts.find((p) => p.type === 'hour')?.value ?? '00'
    const m = parts.find((p) => p.type === 'minute')?.value ?? '00'
    return `${h}:${m}`
  } catch {
    return '--:--'
  }
}

const MONTH_LABELS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export const getDashboardData = cache(async (): Promise<DashboardData> => {
  const supabase = await createClient()

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const firstOfMonthIso = firstOfMonth.toISOString()
  const nowIso = now.toISOString()

  // ── KPIs ─────────────────────────────────────────────────────────────

  // 1. Miembros por status (1 query, agrupamos en JS)
  const { data: allMembers } = await supabase
    .from('members')
    .select('id, status, leave_date')

  const activeMembers = (allMembers ?? []).filter((m) => m.status === 'active').length
  const totalMembers = (allMembers ?? []).length
  const leftThisMonth = (allMembers ?? []).filter(
    (m) =>
      m.leave_date &&
      m.leave_date >= firstOfMonthIso.slice(0, 10)
  ).length

  // Churn: bajas este mes / total activos al inicio del mes (aproximado: activos actuales + bajas)
  const denominator = activeMembers + leftThisMonth
  const churnRate = denominator > 0 ? (leftThisMonth / denominator) * 100 : 0

  // 2. Ingresos mes + ticket medio (solo pagos completed del mes actual)
  const { data: monthPayments } = await supabase
    .from('payments')
    .select('amount, paid_at')
    .eq('status', 'completed')
    .gte('paid_at', firstOfMonthIso)
    .lte('paid_at', nowIso)

  const monthRevenue = (monthPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)
  const averageTicket =
    (monthPayments ?? []).length > 0 ? monthRevenue / (monthPayments ?? []).length : 0

  const kpis: DashboardKPIs = {
    activeMembers,
    totalMembers,
    monthRevenue,
    averageTicket,
    churnRate,
    leftThisMonth,
  }

  // ── Próximas clases (3 más cercanas desde ahora) ──────────────────────

  const { data: upcomingRaw } = await supabase
    .from('class_instances')
    .select(`
      id, scheduled_date, start_at, end_at,
      booked_count, max_spots, instructor_id,
      class:class_id (name, type, max_spots, instructor_id),
      instance_instructor:instructor_id (name)
    `)
    .eq('status', 'scheduled')
    .gte('end_at', nowIso)
    .order('start_at', { ascending: true })
    .limit(3)

  // Buscar nombres de instructor desde la plantilla si la instancia no tiene
  const classInstructorIds = (upcomingRaw ?? [])
    .map((i) => {
      const c = Array.isArray(i.class) ? i.class[0] : i.class
      return c?.instructor_id
    })
    .filter(Boolean) as string[]

  const instIdsUnique = Array.from(
    new Set([
      ...(upcomingRaw ?? []).filter((i) => i.instructor_id).map((i) => i.instructor_id!),
      ...classInstructorIds,
    ])
  )

  const instructorNamesMap = new Map<string, string>()
  if (instIdsUnique.length > 0) {
    const { data: insData } = await supabase
      .from('instructors')
      .select('id, name')
      .in('id', instIdsUnique)
    for (const ins of insData ?? []) {
      instructorNamesMap.set(ins.id, ins.name)
    }
  }

  const upcomingClasses: DashboardUpcomingClass[] = (upcomingRaw ?? []).map((i) => {
    const c = Array.isArray(i.class) ? i.class[0] : i.class
    const effInstructorId = i.instructor_id ?? c?.instructor_id ?? null
    return {
      id: i.id,
      className: c?.name ?? 'Clase',
      classType: c?.type ?? 'grupal',
      instructorName: effInstructorId
        ? instructorNamesMap.get(effInstructorId) ?? null
        : null,
      startTime: extractLocalTime(i.start_at),
      endTime: extractLocalTime(i.end_at),
      scheduledDate: i.scheduled_date,
      bookedCount: i.booked_count ?? 0,
      maxSpots: i.max_spots ?? c?.max_spots ?? 0,
    }
  })

  // ── Últimos 5 pagos completados ─────────────────────────────────────

  const { data: recentPaymentsRaw } = await supabase
    .from('payments')
    .select(`
      id, description, amount, method, paid_at,
      member:member_id (first_name, last_name)
    `)
    .eq('status', 'completed')
    .order('paid_at', { ascending: false })
    .limit(5)

  const recentPayments: DashboardRecentPayment[] = (recentPaymentsRaw ?? []).map((p) => {
    const member = Array.isArray(p.member) ? p.member[0] : p.member
    const memberName = member
      ? `${member.first_name} ${member.last_name}`.trim()
      : 'Socio eliminado'
    return {
      id: p.id,
      memberName,
      description: p.description,
      amount: Number(p.amount),
      paidAt: p.paid_at!,
      method: p.method,
      methodLabel: METHOD_LABEL[p.method] ?? p.method,
    }
  })

  // ── Ingresos últimos 4 meses ─────────────────────────────────────────

  const fourMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  const fourMonthsAgoIso = fourMonthsAgo.toISOString()

  const { data: revenueRaw } = await supabase
    .from('payments')
    .select('amount, paid_at')
    .eq('status', 'completed')
    .gte('paid_at', fourMonthsAgoIso)

  // Agrupar por mes en JS
  const revenueByMonthMap = new Map<string, number>()
  for (let i = 3; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
    revenueByMonthMap.set(key, 0)
  }
  for (const p of revenueRaw ?? []) {
    if (!p.paid_at) continue
    const d = new Date(p.paid_at)
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
    if (revenueByMonthMap.has(key)) {
      revenueByMonthMap.set(key, (revenueByMonthMap.get(key) ?? 0) + Number(p.amount))
    }
  }

  const revenueByMonth: DashboardRevenueMonth[] = Array.from(revenueByMonthMap.entries()).map(
    ([key, amount]) => {
      const [yearStr, monthStr] = key.split('-')
      const monthIdx = Number(monthStr)
      return {
        month: MONTH_LABELS_ES[monthIdx] ?? '?',
        year: Number(yearStr),
        amount,
      }
    }
  )

  // ── Distribución por grupo de tarifa (socios activos) ────────────────

  const { data: activeWithTariff } = await supabase
    .from('members')
    .select(`
      id, status,
      tariff:current_tariff_id ("group")
    `)
    .eq('status', 'active')

  const groupCounts = new Map<string, number>()
  let withTariffTotal = 0
  for (const m of activeWithTariff ?? []) {
    const t = Array.isArray(m.tariff) ? m.tariff[0] : m.tariff
    const group = t?.group ?? 'Sin tarifa'
    groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1)
    if (t?.group) withTariffTotal++
  }

  const totalForPercent = withTariffTotal || 1
  const tariffDistribution: DashboardTariffDistribution[] = Array.from(groupCounts.entries())
    .filter(([group]) => group !== 'Sin tarifa')
    .map(([group, count]) => ({
      group,
      count,
      percentage: Math.round((count / totalForPercent) * 100),
      color: GROUP_COLORS[group] ?? DEFAULT_COLOR,
    }))
    .sort((a, b) => b.count - a.count)

  // ── Onboarding progress (derivado de datos reales, sin columna extra) ───

  const { data: gyms } = await supabase.rpc('current_user_gyms')
  const gymId = gyms?.[0]?.gym_id

  let onboarding: OnboardingProgress = {
    profileComplete: false,
    hasInstructors: false,
    hasTariffs: false,
    hasClasses: false,
    hasInstances: false,
    hasMembers: false,
    completedCount: 0,
    totalCount: 6,
    allDone: false,
    dismissedAt: null,
    stepOverrides: {},
  }

  if (gymId) {
    // Moved to RPC get_onboarding_state (migration 0024, extended 0027) —
    // merges 6 data-derived booleans + dismissed_at + step_overrides JSONB.
    const { data: stateJson } = await supabase.rpc('get_onboarding_state', { p_gym_id: gymId })
    if (stateJson && typeof stateJson === 'object') {
      const s = stateJson as Record<string, unknown>
      onboarding = {
        profileComplete: Boolean(s.profile_complete),
        hasInstructors: Boolean(s.has_instructors),
        hasTariffs: Boolean(s.has_tariffs),
        hasClasses: Boolean(s.has_classes),
        hasInstances: Boolean(s.has_instances),
        hasMembers: Boolean(s.has_members),
        completedCount: Number(s.completed_count ?? 0),
        totalCount: Number(s.total_count ?? 6),
        allDone: Boolean(s.all_done),
        dismissedAt: (s.dismissed_at as string | null) ?? null,
        stepOverrides:
          (s.step_overrides as import('./dashboard-types').StepOverrides) ?? {},
      }
    }
  }

  return {
    gymId: gymId ?? null,
    kpis,
    upcomingClasses,
    recentPayments,
    revenueByMonth,
    tariffDistribution,
    onboarding,
  }
})
