import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listAppointmentsInRangeAction, type Appointment } from './actions'
import CitasClient from './CitasClient'

export default async function CitasPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>
}) {
  const supabase = await createClient()

  // Obtener gym del user autenticado (tenant owner/staff)
  const { data: userGyms, error } = await supabase.rpc('current_user_gyms')
  if (error || !userGyms || userGyms.length === 0) {
    redirect('/login')
  }
  const currentGym = userGyms[0] as { gym_id: string; gym_name: string; gym_plan: string }

  // Fecha inicial: hoy (UTC) o la del query param
  const params = await searchParams
  const today = new Date()
  const focusedDate = params.fecha ? new Date(params.fecha) : today

  // Rango semanal centrado en el día focused
  const dayOfWeek = focusedDate.getDay() // 0=dom
  const weekStart = new Date(focusedDate)
  weekStart.setDate(focusedDate.getDate() - dayOfWeek)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  // Fetch parallelo: appointments + instructors + rooms + members (para dropdown Nueva cita)
  const [appointments, instructorsRes, roomsRes, membersRes] = await Promise.all([
    listAppointmentsInRangeAction(currentGym.gym_id, weekStart.toISOString(), weekEnd.toISOString()),
    supabase.from('instructors').select('id, name, color').eq('gym_id', currentGym.gym_id).eq('is_active', true).order('name'),
    supabase.from('gym_rooms').select('id, name').eq('gym_id', currentGym.gym_id).eq('is_active', true).order('name'),
    supabase.from('members').select('id, first_name, last_name').eq('gym_id', currentGym.gym_id).neq('status', 'inactive').order('last_name').limit(500),
  ])

  const instructors = (instructorsRes.data ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    color: (i.color as string | null) ?? '#3b8bea',
  }))
  const rooms = (roomsRes.data ?? []).map((r) => ({ id: r.id, name: r.name }))
  const members = (membersRes.data ?? []).map((m) => ({
    id: m.id,
    name: `${m.first_name} ${m.last_name}`.trim(),
  }))

  return (
    <CitasClient
      gymId={currentGym.gym_id}
      focusedDateISO={focusedDate.toISOString()}
      weekStartISO={weekStart.toISOString()}
      weekEndISO={weekEnd.toISOString()}
      initialAppointments={appointments as Appointment[]}
      instructors={instructors}
      rooms={rooms}
      members={members}
    />
  )
}
