import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { ScheduleClass, ScheduleSlot, DbClassType } from './types'
import { TYPE_COLOR_MAP } from './types'

export type { ScheduleClass, ScheduleSlot, DbClassType } from './types'

function extractTime(timestamptz: string): string {
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

// Carga todas las class_instances de la semana [weekStart, weekStart+6días]
// y las agrupa por franjas horarias (start_time - end_time).
export const getScheduleForWeek = cache(
  async (weekStartIso: string): Promise<ScheduleSlot[]> => {
    const supabase = await createClient()

    // weekEnd: sumar 7 días (domingo incluido) y buscar end_at <= endOfSunday
    const weekEnd = new Date(weekStartIso + 'T00:00:00')
    weekEnd.setDate(weekEnd.getDate() + 7) // lunes siguiente a las 00:00

    const { data, error } = await supabase
      .from('class_instances')
      .select(`
        id, scheduled_date, start_at, end_at, status,
        booked_count, max_spots, room, instructor_id,
        class:class_id (name, type, max_spots, instructor_id),
        instance_instructor:instructor_id (name)
      `)
      .gte('scheduled_date', weekStartIso)
      .lt('scheduled_date', weekEnd.toISOString().slice(0, 10))
      .order('start_at', { ascending: true })

    if (error) {
      console.error('[getScheduleForWeek] error:', error)
      return []
    }

    if (!data || data.length === 0) return []

    // Resolver nombres de instructor (efectivo: instance.instructor_id > class.instructor_id)
    const instructorIds: string[] = []
    for (const inst of data) {
      const cls = Array.isArray(inst.class) ? inst.class[0] : inst.class
      const iid = inst.instructor_id ?? cls?.instructor_id
      if (iid) instructorIds.push(iid)
    }
    const uniqueInstructorIds = Array.from(new Set(instructorIds))

    const instructorMap = new Map<string, string>()
    if (uniqueInstructorIds.length > 0) {
      const { data: insData } = await supabase
        .from('instructors')
        .select('id, name')
        .in('id', uniqueInstructorIds)
      for (const ins of insData ?? []) {
        instructorMap.set(ins.id, ins.name)
      }
    }

    // Mapear a ScheduleClass
    const classes: ScheduleClass[] = data.map((inst) => {
      const cls = Array.isArray(inst.class) ? inst.class[0] : inst.class
      const instructorId = inst.instructor_id ?? cls?.instructor_id ?? null
      const date = new Date(inst.scheduled_date + 'T12:00:00')
      const type = (cls?.type ?? 'grupal') as DbClassType
      return {
        instanceId: inst.id,
        name: cls?.name ?? 'Clase',
        type,
        colorGroup: TYPE_COLOR_MAP[type] ?? 'slate',
        instructorName: instructorId ? instructorMap.get(instructorId) ?? null : null,
        dayOfWeek: date.getDay(),
        date: inst.scheduled_date,
        startTime: extractTime(inst.start_at),
        endTime: extractTime(inst.end_at),
        bookedCount: inst.booked_count ?? 0,
        maxSpots: inst.max_spots ?? cls?.max_spots ?? 0,
        room: inst.room,
        status: inst.status as 'scheduled' | 'cancelled' | 'completed',
      }
    })

    // Agrupar por franjas horarias únicas (startTime + endTime)
    const slotMap = new Map<string, ScheduleSlot>()
    for (const c of classes) {
      const key = `${c.startTime}-${c.endTime}`
      const existing = slotMap.get(key)
      if (existing) {
        existing.classes.push(c)
      } else {
        slotMap.set(key, {
          startTime: c.startTime,
          endTime: c.endTime,
          classes: [c],
        })
      }
    }

    // Ordenar slots por hora de inicio
    return Array.from(slotMap.values()).sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    )
  }
)

// Lista de instructores activos (para filtro)
export const getInstructorsForFilter = cache(
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
