// Tipos compartidos server/client. Sin imports server-only.

export type DbClassType =
  | 'dinamico'
  | 'premium'
  | 'salud'
  | 'personal_1h'
  | 'personal_30min'
  | 'grupal'

export type UiColorGroup = 'blue' | 'amber' | 'green' | 'purple' | 'slate'

export interface ScheduleClass {
  instanceId: string
  name: string
  type: DbClassType
  colorGroup: UiColorGroup
  instructorName: string | null
  dayOfWeek: number // 0=Domingo, 1=Lunes, ..., 6=Sábado
  date: string // YYYY-MM-DD
  startTime: string // HH:MM
  endTime: string // HH:MM
  bookedCount: number
  maxSpots: number
  room: string | null
  status: 'scheduled' | 'cancelled' | 'completed'
}

export interface ScheduleSlot {
  startTime: string // HH:MM
  endTime: string
  classes: ScheduleClass[]
}

export interface WeekInfo {
  weekStart: string // YYYY-MM-DD (lunes)
  weekEnd: string // YYYY-MM-DD (domingo)
  label: string // "13 - 19 Abril 2026"
  isCurrentWeek: boolean
  prevWeekQuery: string // "?week=2026-04-13"
  nextWeekQuery: string
}

export const TYPE_COLOR_MAP: Record<DbClassType, UiColorGroup> = {
  dinamico: 'blue',
  grupal: 'slate',
  premium: 'amber',
  salud: 'green',
  personal_1h: 'purple',
  personal_30min: 'purple',
}

export const TYPE_LABEL: Record<DbClassType, string> = {
  dinamico: 'Dinámico',
  grupal: 'Grupal',
  premium: 'Premium',
  salud: 'Salud',
  personal_1h: 'Personal 1h',
  personal_30min: 'Personal 30min',
}

export const COLOR_STYLES: Record<
  UiColorGroup,
  { bg: string; border: string; text: string; dot: string }
> = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    dot: 'bg-[#3b8bea]',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
  },
  green: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-800',
    dot: 'bg-purple-500',
  },
  slate: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-700',
    dot: 'bg-slate-400',
  },
}

export const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
export const DAY_LABELS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// Devuelve lunes de la semana dada (para cualquier date ISO). JS trata Dom=0 pero nosotros queremos Lun como inicio.
export function getMondayOf(dateIso: string): Date {
  const d = new Date(dateIso + 'T12:00:00')
  const dayOfWeek = d.getDay() // 0=Dom, 1=Lun, ..., 6=Sáb
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // cuánto hay que retroceder para llegar a Lun
  d.setDate(d.getDate() + diff)
  return d
}

export function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const sameMonth = monday.getMonth() === sunday.getMonth()
  const fmt = (d: Date, withMonth: boolean) =>
    withMonth
      ? d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
      : d.toLocaleDateString('es-ES', { day: 'numeric' })
  if (sameMonth) {
    return `${fmt(monday, false)} – ${fmt(sunday, true)}`
  }
  return `${fmt(monday, true)} – ${fmt(sunday, true)}`
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function isSameIsoDate(a: string, b: Date): boolean {
  return a === toIsoDate(b)
}
