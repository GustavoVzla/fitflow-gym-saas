import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { TariffRow, GroupColor, ClassRow, ClassType } from './types'

// Re-export tipos para compatibilidad con imports existentes (el bundler los
// tree-shakea hacia types.ts sin arrastrar el resto del módulo).
export type { TariffRow, GroupColor, ClassRow, ClassType } from './types'
export { getDayName } from './types'

const GROUP_COLOR_MAP: Record<string, GroupColor> = {
  Dinamico: 'blue',
  Reducidos: 'amber',
  'Salud +65': 'green',
  Salud: 'green',
  Personal: 'purple',
}

function formatPrice(price: number, type: 'Mensual' | 'Bono'): string {
  const suffix = type === 'Mensual' ? ' EUR/mes' : ' EUR'
  return `${price.toFixed(2).replace('.', ',')}${suffix}`
}

function timeToHHMM(t: string): string {
  return t?.slice(0, 5) ?? ''
}

export const getTariffs = cache(async (): Promise<TariffRow[]> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tariffs')
    .select('id, name, "group", price, type, is_active, sort_order')
    .order('group', { ascending: true, nullsFirst: true })
    .order('sort_order', { ascending: true })
    .order('price', { ascending: true })

  if (error) {
    console.error('[getTariffs] error:', error)
    return []
  }

  return (data ?? []).map((t): TariffRow => {
    const uiType: 'Mensual' | 'Bono' = t.type === 'bonus' ? 'Bono' : 'Mensual'
    const group = t.group ?? 'General'
    const price = Number(t.price)
    return {
      id: t.id,
      group,
      groupColor: GROUP_COLOR_MAP[group] ?? 'blue',
      name: t.name,
      price,
      priceLabel: formatPrice(price, uiType),
      type: uiType,
      isActive: t.is_active,
    }
  })
})

export const getClasses = cache(async (): Promise<ClassRow[]> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('classes')
    .select(`
      id, name, type, instructor_id, day_of_week,
      start_time, end_time, max_spots, waitlist_size,
      room, color, is_active,
      instructor:instructor_id (name)
    `)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) {
    console.error('[getClasses] error:', error)
    return []
  }

  return (data ?? []).map((c): ClassRow => {
    const instructor = Array.isArray(c.instructor) ? c.instructor[0] : c.instructor
    return {
      id: c.id,
      name: c.name,
      type: c.type as ClassType,
      instructorId: c.instructor_id,
      instructorName: instructor?.name ?? null,
      dayOfWeek: c.day_of_week,
      startTime: timeToHHMM(c.start_time),
      endTime: timeToHHMM(c.end_time),
      maxSpots: c.max_spots,
      waitlistSize: c.waitlist_size ?? 0,
      room: c.room,
      color: c.color,
      isActive: c.is_active,
    }
  })
})
