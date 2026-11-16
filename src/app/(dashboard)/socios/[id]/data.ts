import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type {
  MemberDetail,
  TariffOption,
  MemberTariffHistoryRow,
  BookingHistoryRow,
  PaymentHistoryRow,
  RecurringBookingRow,
  AttendanceStats,
  ClassOption,
  InstructorOption,
  MemberClauseRow,
  ClauseTemplateOption,
} from './types'

export const getMemberDetail = cache(
  async (memberId: string): Promise<MemberDetail | null> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('members')
      .select(
        `id, gym_id, first_name, last_name, second_last_name, email, phone,
         birth_date, gender, tax_id, address, city, postal_code,
         join_date, leave_date, status, avatar_url, notes, internal_notes,
         medical_notes, emergency_contact_name, emergency_contact_phone,
         emergency_contact_relation, current_tariff_id, auth_user_id,
         blocked_for_morosos_at,
         tariffs:current_tariff_id (name, price)`
      )
      .eq('id', memberId)
      .maybeSingle()

    if (error || !data) {
      if (error) console.error('[getMemberDetail] error:', error)
      return null
    }

    const tariff = Array.isArray(data.tariffs) ? data.tariffs[0] : data.tariffs

    // Próximo cobro: lookup último member_tariff activo
    let nextChargeAt: string | null = null
    if (data.current_tariff_id) {
      const { data: mt } = await supabase
        .from('member_tariffs')
        .select('end_date')
        .eq('member_id', memberId)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      nextChargeAt = mt?.end_date ?? null
    }

    return {
      id: data.id,
      gymId: data.gym_id,
      firstName: data.first_name,
      lastName: data.last_name,
      secondLastName: data.second_last_name ?? null,
      email: data.email,
      phone: data.phone,
      birthDate: data.birth_date,
      gender: data.gender,
      taxId: data.tax_id,
      address: data.address,
      city: data.city,
      postalCode: data.postal_code,
      joinDate: data.join_date,
      leaveDate: data.leave_date,
      status: data.status,
      avatarUrl: data.avatar_url,
      notes: data.notes,
      internalNotes: data.internal_notes,
      medicalNotes: data.medical_notes,
      emergencyContactName: data.emergency_contact_name,
      emergencyContactPhone: data.emergency_contact_phone,
      emergencyContactRelation: data.emergency_contact_relation,
      currentTariffId: data.current_tariff_id,
      currentTariffName: tariff?.name ?? null,
      currentTariffPrice: tariff?.price != null ? Number(tariff.price) : null,
      currentTariffNextChargeAt: nextChargeAt,
      authUserId: data.auth_user_id,
      blockedForMorososAt: data.blocked_for_morosos_at,
    }
  }
)

export const getMemberTariffHistory = cache(
  async (memberId: string): Promise<MemberTariffHistoryRow[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('member_tariffs')
      .select(
        `id, tariff_id, tariff_snapshot, start_date, end_date, is_active`
      )
      .eq('member_id', memberId)
      .order('start_date', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[getMemberTariffHistory] error:', error)
      return []
    }

    return (data ?? []).map((r): MemberTariffHistoryRow => {
      const snap = (r.tariff_snapshot ?? {}) as { name?: string; price?: number }
      return {
        id: r.id,
        tariffId: r.tariff_id,
        tariffName: snap.name ?? 'Sin nombre',
        startsAt: r.start_date,
        endsAt: r.end_date,
        status: r.is_active ? 'active' : 'inactive',
        amount: snap.price != null ? Number(snap.price) : null,
      }
    })
  }
)

export const getMemberBookings = cache(
  async (memberId: string): Promise<BookingHistoryRow[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('bookings')
      .select(
        `id, class_instance_id, status, attended_at,
         class_instances:class_instance_id (
           start_at,
           classes:class_id (name)
         )`
      )
      .eq('member_id', memberId)
      .order('booked_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[getMemberBookings] error:', error)
      return []
    }

    return (data ?? []).map((b): BookingHistoryRow => {
      const ci = Array.isArray(b.class_instances)
        ? b.class_instances[0]
        : b.class_instances
      const cls = ci ? (Array.isArray(ci.classes) ? ci.classes[0] : ci.classes) : null
      return {
        id: b.id,
        classInstanceId: b.class_instance_id,
        className: cls?.name ?? 'Clase eliminada',
        startAt: ci?.start_at ?? '',
        status: b.status,
        attended: b.attended_at != null,
      }
    })
  }
)

export const getMemberPayments = cache(
  async (memberId: string): Promise<PaymentHistoryRow[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('payments')
      .select(
        `id, description, concept, amount, currency, status, method,
         due_date, paid_at, created_at`
      )
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[getMemberPayments] error:', error)
      return []
    }

    return (data ?? []).map((p): PaymentHistoryRow => ({
      id: p.id,
      description: p.description,
      concept: p.concept,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      method: p.method,
      dueDate: p.due_date,
      paidAt: p.paid_at,
      createdAt: p.created_at,
    }))
  }
)

export const getMemberRecurringBookings = cache(
  async (memberId: string): Promise<RecurringBookingRow[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('recurring_bookings')
      .select(
        `id, type, class_id, instructor_id, room, duration_minutes,
         day_of_week, start_time, starts_on, ends_on, active, notes,
         classes:class_id (name),
         instructors:instructor_id (name)`
      )
      .eq('member_id', memberId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true })

    if (error) {
      console.error('[getMemberRecurringBookings] error:', error)
      return []
    }

    return (data ?? []).map((r): RecurringBookingRow => {
      const cls = Array.isArray(r.classes) ? r.classes[0] : r.classes
      const ins = Array.isArray(r.instructors) ? r.instructors[0] : r.instructors
      return {
        id: r.id,
        type: r.type,
        classId: r.class_id,
        className: cls?.name ?? null,
        instructorId: r.instructor_id,
        instructorName: ins?.name ?? null,
        room: r.room,
        durationMinutes: r.duration_minutes,
        dayOfWeek: r.day_of_week,
        startTime: r.start_time,
        startsOn: r.starts_on,
        endsOn: r.ends_on,
        active: r.active,
        notes: r.notes,
      }
    })
  }
)

export const getMemberAttendance = cache(
  async (memberId: string): Promise<AttendanceStats> => {
    const supabase = await createClient()
    const { data: all } = await supabase
      .from('bookings')
      .select('status, attended_at, booked_at')
      .eq('member_id', memberId)

    const rows = all ?? []
    const reservedTotal = rows.length
    const attendedTotal = rows.filter((r) => r.attended_at != null || r.status === 'attended').length
    const cancelledTotal = rows.filter((r) => r.status === 'cancelled').length
    const noShowTotal = rows.filter((r) => r.status === 'no_show').length

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const last30 = rows.filter((r) => r.booked_at && new Date(r.booked_at) >= cutoff)
    const last30Reserved = last30.length
    const last30Attended = last30.filter((r) => r.attended_at != null || r.status === 'attended').length

    return {
      reservedTotal,
      attendedTotal,
      cancelledTotal,
      noShowTotal,
      attendanceRate: reservedTotal > 0 ? attendedTotal / reservedTotal : 0,
      last30Reserved,
      last30Attended,
    }
  }
)

export const getActiveTariffsForGym = cache(
  async (gymId: string): Promise<TariffOption[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('tariffs')
      .select('id, name, "group"')
      .eq('gym_id', gymId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    return (data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      group: t.group ?? null,
    }))
  }
)

export const getActiveClassesForGym = cache(
  async (gymId: string): Promise<ClassOption[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('classes')
      .select('id, name, duration_minutes')
      .eq('gym_id', gymId)
      .eq('is_active', true)
      .order('name', { ascending: true })
    return (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      defaultDuration: c.duration_minutes != null ? Number(c.duration_minutes) : null,
    }))
  }
)

export const getActiveInstructorsForGym = cache(
  async (gymId: string): Promise<InstructorOption[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('instructors')
      .select('id, name')
      .eq('gym_id', gymId)
      .eq('is_active', true)
      .order('name', { ascending: true })
    return (data ?? []).map((i) => ({ id: i.id, name: i.name }))
  }
)

// =============================================================================
// Cláusulas RGPD (member_clauses + gym_clause_templates) — migración 0059
// =============================================================================

export const getMemberClauses = cache(
  async (memberId: string): Promise<MemberClauseRow[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('member_clauses')
      .select(
        'id, template_id, title_snapshot, body_snapshot, status, signed_at, signed_by_name, assigned_at, expires_at'
      )
      .eq('member_id', memberId)
      .order('assigned_at', { ascending: false })

    if (error) {
      console.error('[getMemberClauses] error:', error)
      return []
    }

    return (data ?? []).map((r): MemberClauseRow => ({
      id: r.id,
      templateId: r.template_id ?? null,
      titleSnapshot: r.title_snapshot,
      bodySnapshot: r.body_snapshot,
      status: r.status as MemberClauseRow['status'],
      signedAt: r.signed_at,
      signedByName: r.signed_by_name,
      assignedAt: r.assigned_at,
      expiresAt: r.expires_at,
    }))
  }
)

export const getClauseTemplatesForGym = cache(
  async (gymId: string): Promise<ClauseTemplateOption[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('gym_clause_templates')
      .select('id, code, title, body, is_required')
      .eq('gym_id', gymId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('[getClauseTemplatesForGym] error:', error)
      return []
    }

    return (data ?? []).map((t): ClauseTemplateOption => ({
      id: t.id,
      code: t.code,
      title: t.title,
      body: t.body,
      isRequired: t.is_required,
    }))
  }
)

// =============================================================================
// member_health_data (datos médicos scoped owner/admin) — migración 0066
// SECURITY HIGH RGPD Art. 9 — solo owner/admin pueden leer/escribir
// =============================================================================

export interface MemberHealthData {
  memberId: string
  medicalNotes: string | null
  medicalInfoJson: string | null  // JSON stringified para textarea
  imageConsent: boolean
  marketingConsent: boolean
  updatedAt: string | null
}

export const getMemberHealthData = cache(
  async (memberId: string): Promise<MemberHealthData | null> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('member_health_data')
      .select('member_id, medical_notes, medical_info, image_consent, marketing_consent, updated_at')
      .eq('member_id', memberId)
      .maybeSingle()

    if (error) {
      // Si no hay permiso (RLS bloquea), devolvemos null sin loguear ruido
      if (error.code === 'PGRST116' || error.code === '42501') return null
      if (error.code === '42P01') return null
      console.error('[getMemberHealthData] error:', error)
      return null
    }

    if (!data) {
      // Sin row aún (no se ha inicializado) — devolvemos defaults
      return {
        memberId,
        medicalNotes: null,
        medicalInfoJson: null,
        imageConsent: false,
        marketingConsent: false,
        updatedAt: null,
      }
    }

    return {
      memberId: data.member_id,
      medicalNotes: data.medical_notes,
      medicalInfoJson: data.medical_info ? JSON.stringify(data.medical_info, null, 2) : null,
      imageConsent: data.image_consent,
      marketingConsent: data.marketing_consent,
      updatedAt: data.updated_at,
    }
  }
)

// =============================================================================
// Heatmap asistencia diario (calendar heatmap)
// =============================================================================

export interface AttendanceDay {
  date: string // YYYY-MM-DD
  count: number
}

export const getMemberAttendanceDaily = cache(
  async (memberId: string, daysBack = 365): Promise<AttendanceDay[]> => {
    const supabase = await createClient()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - daysBack)

    const { data, error } = await supabase
      .from('bookings')
      .select('attended_at, status, booked_at')
      .eq('member_id', memberId)
      .or('status.eq.attended,status.eq.confirmed')
      .gte('booked_at', cutoff.toISOString())

    if (error) {
      console.error('[getMemberAttendanceDaily] error:', error)
      return []
    }

    // Agregamos por día (preferimos attended_at, fallback booked_at)
    const map = new Map<string, number>()
    for (const r of data ?? []) {
      const iso = r.attended_at ?? r.booked_at
      if (!iso) continue
      const day = new Date(iso).toISOString().slice(0, 10)
      // Solo cuenta si attended o confirmed con día pasado
      if (r.attended_at || (r.status === 'attended')) {
        map.set(day, (map.get(day) ?? 0) + 1)
      }
    }

    return Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
  }
)
