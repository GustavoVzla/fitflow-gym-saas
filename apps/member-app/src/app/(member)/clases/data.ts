import 'server-only'

import { createClient } from '@/lib/supabase/server'

export type ClassListItem = {
  instanceId: string
  classId: string
  className: string
  classType: string
  color: string | null
  startAt: string
  endAt: string
  durationMinutes: number | null
  room: string | null
  instructorName: string | null
  bookedCount: number
  maxSpots: number | null
  waitlistCount: number
  myBookingId: string | null
  myBookingStatus: 'confirmed' | 'waitlist' | null
}

/**
 * Trae las clases del gym del socio autenticado, próximas 7 días desde hoy.
 * Marca cuáles ya tienen reserva del socio (myBookingId/myBookingStatus).
 */
export async function getUpcomingClasses(opts?: {
  fromIso?: string
  toIso?: string
  instructorId?: string | null
  classType?: string | null
}): Promise<ClassListItem[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: member } = await supabase
    .from('members')
    .select('id, gym_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!member) return []

  const fromIso = opts?.fromIso ?? new Date().toISOString()
  const toIso =
    opts?.toIso ??
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('class_instances')
    .select(
      `
      id,
      start_at,
      end_at,
      room,
      booked_count,
      max_spots,
      waitlist_count,
      status,
      class:classes!inner ( id, name, type, color, duration_minutes ),
      instructor:instructors ( name )
      `
    )
    .eq('gym_id', member.gym_id)
    .neq('status', 'cancelled')
    .gte('start_at', fromIso)
    .lte('start_at', toIso)
    .order('start_at', { ascending: true })

  if (opts?.instructorId) query = query.eq('instructor_id', opts.instructorId)

  const { data: instances } = await query
  if (!instances) return []

  // Filtro por tipo (post-fetch, schema doesn't expose it via filter on join)
  const filtered = opts?.classType
    ? instances.filter(
        (i) => (i.class as { type: string }).type === opts.classType
      )
    : instances

  // Reservas activas del socio para estas instancias
  const ids = filtered.map((i) => i.id)
  const { data: myBookings } = ids.length
    ? await supabase
        .from('bookings')
        .select('id, class_instance_id, status')
        .eq('member_id', member.id)
        .in('class_instance_id', ids)
        .neq('status', 'cancelled')
    : { data: [] as { id: string; class_instance_id: string; status: string }[] }

  const bookingByInstance = new Map(
    (myBookings ?? []).map((b) => [b.class_instance_id, b])
  )

  return filtered.map((i): ClassListItem => {
    const cls = i.class as {
      id: string
      name: string
      type: string
      color: string | null
      duration_minutes: number | null
    }
    const ins = i.instructor as { name: string } | null
    const myB = bookingByInstance.get(i.id)
    return {
      instanceId: i.id,
      classId: cls.id,
      className: cls.name,
      classType: cls.type,
      color: cls.color,
      startAt: i.start_at,
      endAt: i.end_at,
      durationMinutes: cls.duration_minutes,
      room: i.room,
      instructorName: ins?.name ?? null,
      bookedCount: i.booked_count,
      maxSpots: i.max_spots,
      waitlistCount: i.waitlist_count,
      myBookingId: myB?.id ?? null,
      myBookingStatus:
        myB?.status === 'waitlist'
          ? 'waitlist'
          : myB
            ? 'confirmed'
            : null,
    }
  })
}

export async function getClassFilters(): Promise<{
  instructors: { id: string; name: string }[]
  classTypes: string[]
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { instructors: [], classTypes: [] }

  const { data: member } = await supabase
    .from('members')
    .select('gym_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!member) return { instructors: [], classTypes: [] }

  const [{ data: instructors }, { data: types }] = await Promise.all([
    supabase
      .from('instructors')
      .select('id, name')
      .eq('gym_id', member.gym_id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('classes')
      .select('type')
      .eq('gym_id', member.gym_id)
      .eq('is_active', true),
  ])

  return {
    instructors: (instructors ?? []).map((i) => ({
      id: i.id,
      name: i.name,
    })),
    classTypes: Array.from(new Set((types ?? []).map((t) => t.type))).sort(),
  }
}
