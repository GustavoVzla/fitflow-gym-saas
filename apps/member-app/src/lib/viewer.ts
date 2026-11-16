import { createClient } from '@/lib/supabase/server'

export type ViewerContext =
  | {
      type: 'member'
      userId: string
      gymId: string
      firstName: string | null
      lastName: string | null
      email: string | null
      memberId: string
    }
  | {
      type: 'trainer'
      userId: string
      gymId: string
      firstName: string | null
      lastName: string | null
      email: string | null
      instructorId: string
      fullName: string
    }
  | { type: 'unknown'; userId: string }

/**
 * Resuelve si el usuario logueado es socio (members) o instructor (instructors).
 * Si es ambos (caso muy raro), prioriza miembro (la app está pensada para socios).
 *
 * Devuelve `unknown` si el user existe en auth pero no tiene fila en ninguna tabla
 * — el caller debe redirect a /auth/welcome o /login según contexto.
 */
export async function getViewerContext(): Promise<ViewerContext | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('members')
    .select('id, first_name, last_name, email, gym_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (member) {
    return {
      type: 'member',
      userId: user.id,
      gymId: member.gym_id,
      firstName: member.first_name,
      lastName: member.last_name,
      email: member.email,
      memberId: member.id,
    }
  }

  const { data: instructor } = await supabase
    .from('instructors')
    .select('id, name, email, gym_id, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (instructor) {
    const fullName = instructor.name ?? ''
    const [first, ...rest] = fullName.split(' ')
    return {
      type: 'trainer',
      userId: user.id,
      gymId: instructor.gym_id,
      firstName: first || null,
      lastName: rest.length ? rest.join(' ') : null,
      email: instructor.email,
      instructorId: instructor.id,
      fullName,
    }
  }

  return { type: 'unknown', userId: user.id }
}
