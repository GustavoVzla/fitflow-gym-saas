import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MiCuentaCitasClient from './MiCuentaCitasClient'

export default async function MiCuentaCitasPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user
  if (!user) redirect('/login')

  // Encontrar el member row asociado
  const { data: member } = await supabase
    .from('members')
    .select('id, gym_id, first_name, last_name')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!member) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm">
          <div className="font-semibold text-amber-900">Tu cuenta aún no está vinculada a un gym</div>
          <p className="mt-1 text-amber-800">
            Pide a tu gym que te envíe la invitación. Mientras tanto, no puedes ver tus citas aquí.
          </p>
        </div>
      </div>
    )
  }

  // Leer settings del gym (cancel_hours window)
  const { data: settings } = await supabase
    .from('gym_settings')
    .select('appointment_cancel_hours')
    .eq('gym_id', member.gym_id)
    .maybeSingle()
  const cancelHours = settings?.appointment_cancel_hours ?? 24

  // Leer citas del socio (próximas + últimas 10 pasadas)
  const nowISO = new Date().toISOString()
  const { data: upcomingRaw } = await supabase
    .from('appointments')
    .select('id, starts_at, ends_at, status, appointment_type, title, notes, instructor_id, room_id, cancellation_reason, cancelled_at')
    .eq('member_id', member.id)
    .gte('starts_at', nowISO)
    .order('starts_at', { ascending: true })
    .limit(20)

  const { data: pastRaw } = await supabase
    .from('appointments')
    .select('id, starts_at, ends_at, status, appointment_type, title, notes, instructor_id, room_id')
    .eq('member_id', member.id)
    .lt('starts_at', nowISO)
    .order('starts_at', { ascending: false })
    .limit(10)

  const upcoming = upcomingRaw ?? []
  const past = pastRaw ?? []

  // Enrich con instructor name + room name
  const instructorIds = [...new Set([...upcoming, ...past].map((a) => a.instructor_id).filter(Boolean))] as string[]
  const roomIds = [...new Set([...upcoming, ...past].map((a) => a.room_id).filter(Boolean))] as string[]
  const [instructorsRes, roomsRes] = await Promise.all([
    instructorIds.length > 0
      ? supabase.from('instructors').select('id, name, color').in('id', instructorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; color: string | null }> }),
    roomIds.length > 0
      ? supabase.from('gym_rooms').select('id, name').in('id', roomIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ])
  const instructorMap = new Map((instructorsRes.data ?? []).map((i) => [i.id, { name: i.name, color: i.color ?? '#3b8bea' }]))
  const roomMap = new Map((roomsRes.data ?? []).map((r) => [r.id, r.name]))

  const serializeAppt = (a: Record<string, unknown>) => ({
    id: a.id as string,
    startsAt: a.starts_at as string,
    endsAt: a.ends_at as string,
    status: a.status as string,
    appointmentType: a.appointment_type as string,
    title: (a.title as string | null) ?? null,
    notes: (a.notes as string | null) ?? null,
    instructorName: (a.instructor_id ? instructorMap.get(a.instructor_id as string)?.name : null) ?? null,
    instructorColor: (a.instructor_id ? instructorMap.get(a.instructor_id as string)?.color : null) ?? null,
    roomName: (a.room_id ? roomMap.get(a.room_id as string) : null) ?? null,
    cancellationReason: (a.cancellation_reason as string | null) ?? null,
  })

  return (
    <MiCuentaCitasClient
      memberName={`${member.first_name} ${member.last_name}`}
      cancelHours={cancelHours}
      upcoming={upcoming.map(serializeAppt)}
      past={past.map(serializeAppt)}
    />
  )
}
