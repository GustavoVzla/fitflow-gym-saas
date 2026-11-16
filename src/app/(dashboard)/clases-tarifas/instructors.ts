import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { InstructorRow } from './types'

export type { InstructorRow } from './types'

export const getInstructors = cache(async (): Promise<InstructorRow[]> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('instructors')
    .select('id, name, email, phone, specialties, color, is_active')
    .order('name', { ascending: true })

  if (error) {
    console.error('[getInstructors] error:', error)
    return []
  }

  return (data ?? []).map((i): InstructorRow => ({
    id: i.id,
    name: i.name,
    email: i.email,
    phone: i.phone,
    specialties: i.specialties ?? [],
    color: i.color ?? '#3b8bea',
    isActive: i.is_active,
  }))
})
