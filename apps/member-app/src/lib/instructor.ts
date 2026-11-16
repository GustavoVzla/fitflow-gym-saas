import { createClient } from '@/lib/supabase/server'

export type ActiveCheckIn = {
  id: string
  instructorId: string
  gymId: string
  checkedInAt: string
  checkedOutAt: string | null
}

/**
 * Busca el fichaje abierto del instructor (checked_out_at IS NULL, no cancelado).
 * Devuelve null si no hay fichaje activo.
 */
export async function getActiveCheckIn(instructorId: string): Promise<ActiveCheckIn | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('instructor_check_ins')
    .select('id, instructor_id, gym_id, checked_in_at, checked_out_at')
    .eq('instructor_id', instructorId)
    .is('checked_out_at', null)
    .eq('cancelled', false)
    .order('checked_in_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    instructorId: data.instructor_id,
    gymId: data.gym_id,
    checkedInAt: data.checked_in_at,
    checkedOutAt: data.checked_out_at,
  }
}

/**
 * ¿Hay alguna entrada de check-in para este instructor hoy (UTC)?
 * Conservador: usamos "hoy" desde 00:00 UTC. Madrid en algunas horas
 * temprano podría caer en día previo, pero el modal queda dismissable.
 */
export async function hasCheckedInToday(instructorId: string): Promise<boolean> {
  const supabase = await createClient()
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const { data } = await supabase
    .from('instructor_check_ins')
    .select('id')
    .eq('instructor_id', instructorId)
    .eq('cancelled', false)
    .gte('checked_in_at', startOfDay.toISOString())
    .limit(1)
    .maybeSingle()
  return !!data
}
