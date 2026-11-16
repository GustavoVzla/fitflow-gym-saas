import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type {
  ClassInstanceRow,
  ClassType,
  BookedMember,
  MemberOption,
} from './types'

export type { ClassInstanceRow, ClassType, BookedMember, MemberOption } from './types'

function timeToHHMM(t: string | null | undefined): string {
  return t?.slice(0, 5) ?? ''
}

function extractTime(timestamptz: string): string {
  // Supabase devuelve timestamptz como "2026-04-20T08:00:00+00:00" o ISO.
  // Convertimos a hora local del gym (Europe/Madrid).
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

export const getInstancesForDay = cache(
  async (date: string): Promise<ClassInstanceRow[]> => {
    const supabase = await createClient()

    const { data: instances, error } = await supabase
      .from('class_instances')
      .select(`
        id, class_id, scheduled_date, start_at, end_at,
        booked_count, waitlist_count, max_spots, room, status,
        instructor_id,
        class:class_id (name, type, max_spots, waitlist_size, instructor_id),
        instance_instructor:instructor_id (name)
      `)
      .eq('scheduled_date', date)
      .order('start_at', { ascending: true })

    if (error) {
      console.error('[getInstancesForDay] error:', error)
      return []
    }

    if (!instances || instances.length === 0) return []

    // Obtener bookings + member info para estas instancias en una sola query
    const instanceIds = instances.map((i) => i.id)
    const { data: bookings } = await supabase
      .from('bookings')
      .select(`
        id, class_instance_id, member_id, status, position_in_waitlist,
        member:member_id (first_name, last_name)
      `)
      .in('class_instance_id', instanceIds)
      .in('status', ['confirmed', 'waitlist'])
      .order('position_in_waitlist', { ascending: true, nullsFirst: true })

    // También sacamos el instructor "efectivo" de la plantilla si la instancia no lo tiene
    const classInstructorIds = instances
      .map((i) => {
        const cls = Array.isArray(i.class) ? i.class[0] : i.class
        return cls?.instructor_id
      })
      .filter(Boolean) as string[]

    const instructorIds = [
      ...new Set([
        ...instances.filter((i) => i.instructor_id).map((i) => i.instructor_id!),
        ...classInstructorIds,
      ]),
    ]

    let instructorNames = new Map<string, string>()
    if (instructorIds.length > 0) {
      const { data: insData } = await supabase
        .from('instructors')
        .select('id, name')
        .in('id', instructorIds)
      for (const ins of insData ?? []) {
        instructorNames.set(ins.id, ins.name)
      }
    }

    // Agrupar bookings por instance_id
    const bookingsByInstance = new Map<string, BookedMember[]>()
    for (const b of bookings ?? []) {
      const member = Array.isArray(b.member) ? b.member[0] : b.member
      const name = member
        ? `${member.first_name} ${member.last_name}`.trim()
        : 'Socio eliminado'
      const entry: BookedMember = {
        bookingId: b.id,
        memberId: b.member_id,
        name,
        status: b.status as 'confirmed' | 'waitlist',
        positionInWaitlist: b.position_in_waitlist,
      }
      const arr = bookingsByInstance.get(b.class_instance_id) ?? []
      arr.push(entry)
      bookingsByInstance.set(b.class_instance_id, arr)
    }

    return instances.map((i): ClassInstanceRow => {
      const cls = Array.isArray(i.class) ? i.class[0] : i.class
      const effInstructorId = i.instructor_id ?? cls?.instructor_id ?? null
      const effInstructorName = effInstructorId
        ? instructorNames.get(effInstructorId) ?? null
        : null

      return {
        id: i.id,
        classId: i.class_id,
        className: cls?.name ?? 'Clase',
        type: (cls?.type ?? 'grupal') as ClassType,
        instructorId: effInstructorId,
        instructorName: effInstructorName,
        scheduledDate: i.scheduled_date,
        startTime: extractTime(i.start_at),
        endTime: extractTime(i.end_at),
        bookedCount: i.booked_count ?? 0,
        waitlistCount: i.waitlist_count ?? 0,
        maxSpots: i.max_spots ?? cls?.max_spots ?? 0,
        waitlistSize: cls?.waitlist_size ?? 0,
        room: i.room,
        status: i.status as 'scheduled' | 'cancelled' | 'completed',
        bookedMembers: bookingsByInstance.get(i.id) ?? [],
      }
    })
  }
)

export const getActiveMembersForBooking = cache(
  async (): Promise<MemberOption[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('members')
      .select('id, first_name, last_name, email')
      .eq('status', 'active')
      .order('last_name', { ascending: true })

    if (error) {
      console.error('[getActiveMembersForBooking] error:', error)
      return []
    }

    return (data ?? []).map((m) => ({
      id: m.id,
      name: `${m.first_name} ${m.last_name}`.trim(),
      email: m.email,
    }))
  }
)

export const getInstructorsList = cache(
  async (): Promise<Array<{ id: string; name: string }>> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('instructors')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true })
    return data ?? []
  }
)
