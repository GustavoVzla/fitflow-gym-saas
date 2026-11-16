import 'server-only'
import { createClient } from '@/lib/supabase/server'

export interface Agenda {
  id: string
  gymId: string
  name: string
  description: string | null
  durationMinutes: number
  defaultInstructorId: string | null
  color: string
  active: boolean
  capacity: number
  requiresPaymentUpfront: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export async function getAgendas(): Promise<Agenda[]> {
  const supabase = await createClient()

  const { data: userGyms } = await supabase.rpc('current_user_gyms')
  if (!userGyms || userGyms.length === 0) return []
  const gymId = (userGyms[0] as { gym_id: string }).gym_id

  // Tabla creada en migración 0053, tipos regenerados tras merge
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any
  const { data, error } = await client
    .from('agendas')
    .select('*')
    .eq('gym_id', gymId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error || !data) return []

  return (data as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    gymId: row.gym_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    durationMinutes: row.duration_minutes as number,
    defaultInstructorId: (row.default_instructor_id as string | null) ?? null,
    color: row.color as string,
    active: row.active as boolean,
    capacity: row.capacity as number,
    requiresPaymentUpfront: row.requires_payment_upfront as boolean,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }))
}
