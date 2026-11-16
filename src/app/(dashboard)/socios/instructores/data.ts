import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { InstructorDetail, InstructorListRow } from './types'

export const getInstructorsList = cache(
  async (): Promise<InstructorListRow[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('instructors')
      .select('id, name, email, phone, is_active, created_at, user_id')
      .order('name', { ascending: true })

    if (error) {
      console.error('[getInstructorsList] error:', error)
      return []
    }

    return (data ?? []).map((i): InstructorListRow => ({
      id: i.id,
      name: i.name,
      email: i.email,
      phone: i.phone,
      isActive: i.is_active,
      createdAt: i.created_at,
      hasAuthAccount: !!i.user_id,
    }))
  }
)

export const getInstructorDetail = cache(
  async (id: string): Promise<InstructorDetail | null> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('instructors')
      .select(
        'id, gym_id, name, email, phone, bio, specialties, color, is_active, user_id, created_at'
      )
      .eq('id', id)
      .maybeSingle()

    if (error || !data) {
      if (error) console.error('[getInstructorDetail] error:', error)
      return null
    }

    return {
      id: data.id,
      gymId: data.gym_id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      bio: data.bio,
      specialties: data.specialties ?? [],
      color: data.color ?? '#3b8bea',
      isActive: data.is_active,
      hasAuthAccount: !!data.user_id,
      createdAt: data.created_at,
    }
  }
)

export const getInstructorPermissions = cache(
  async (instructorId: string): Promise<Record<string, number>> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('instructor_permissions')
      .select('permission_key, level')
      .eq('instructor_id', instructorId)

    if (error) {
      console.error('[getInstructorPermissions] error:', error)
      return {}
    }

    const map: Record<string, number> = {}
    for (const row of data ?? []) {
      map[row.permission_key] = row.level
    }
    return map
  }
)

export type NotifDelivery = 'none' | 'email' | 'push' | 'both'

export const getInstructorNotificationPrefs = cache(
  async (instructorId: string): Promise<Record<string, NotifDelivery>> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('instructor_notification_prefs')
      .select('category, delivery')
      .eq('instructor_id', instructorId)

    if (error) {
      console.error('[getInstructorNotificationPrefs] error:', error)
      return {}
    }

    const map: Record<string, NotifDelivery> = {}
    for (const row of data ?? []) {
      map[row.category] = row.delivery as NotifDelivery
    }
    return map
  }
)

// =============================================================================
// instructor_check_ins (registro horario RD-ley 8/2019) — migración 0066
// =============================================================================

export interface CheckInEntry {
  id: string
  checkedInAt: string
  checkedOutAt: string | null
  durationMinutes: number | null
  source: 'webapp' | 'pwa' | 'manual'
  cancelled: boolean
}

export interface CheckInMonthSummary {
  totalMinutes: number
  totalSessions: number
}

export const getInstructorCheckInsCurrentMonth = cache(
  async (instructorId: string): Promise<CheckInEntry[]> => {
    const supabase = await createClient()
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const { data, error } = await sb
      .from('instructor_check_ins')
      .select('id, checked_in_at, checked_out_at, duration_minutes, source, cancelled')
      .eq('instructor_id', instructorId)
      .eq('cancelled', false)
      .gte('checked_in_at', monthStart)
      .lt('checked_in_at', monthEnd)
      .order('checked_in_at', { ascending: false })
      .limit(100)

    if (error) {
      if (error.code === '42P01' || String(error.message ?? '').includes('does not exist')) {
        return []
      }
      console.error('[getInstructorCheckInsCurrentMonth] error:', error)
      return []
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((r: any): CheckInEntry => ({
      id: String(r.id),
      checkedInAt: String(r.checked_in_at),
      checkedOutAt: r.checked_out_at ? String(r.checked_out_at) : null,
      durationMinutes: r.duration_minutes,
      source: r.source,
      cancelled: r.cancelled,
    }))
  }
)

export const getInstructorMonthTotal = cache(
  async (instructorId: string): Promise<CheckInMonthSummary> => {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const { data, error } = await sb.rpc('instructor_check_ins_month_total', {
      p_instructor_id: instructorId,
    })

    if (error) {
      if (error.code === '42P01' || String(error.message ?? '').includes('does not exist')) {
        return { totalMinutes: 0, totalSessions: 0 }
      }
      console.error('[getInstructorMonthTotal] error:', error)
      return { totalMinutes: 0, totalSessions: 0 }
    }

    const row = Array.isArray(data) ? data[0] : data
    return {
      totalMinutes: Number(row?.total_minutes ?? 0),
      totalSessions: Number(row?.total_sessions ?? 0),
    }
  }
)
