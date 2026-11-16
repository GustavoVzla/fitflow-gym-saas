// Types compartidos entre Server y Client. No importar módulos server-only.

export type ClassType =
  | 'dinamico'
  | 'premium'
  | 'salud'
  | 'personal_1h'
  | 'personal_30min'
  | 'grupal'

export interface BookedMember {
  bookingId: string
  memberId: string
  name: string
  status: 'confirmed' | 'waitlist'
  positionInWaitlist: number | null
}

export interface ClassInstanceRow {
  id: string
  classId: string
  className: string
  type: ClassType
  instructorId: string | null
  instructorName: string | null
  scheduledDate: string // YYYY-MM-DD
  startTime: string // HH:MM (convertido a zona del gym)
  endTime: string // HH:MM
  bookedCount: number
  waitlistCount: number
  maxSpots: number
  waitlistSize: number
  room: string | null
  status: 'scheduled' | 'cancelled' | 'completed'
  bookedMembers: BookedMember[]
}

export interface DayOption {
  date: string // YYYY-MM-DD
  dayOfWeek: number // 0-6
  dayLabel: string // Lun, Mar, ...
  dayNumber: number // 1-31
  isToday: boolean
}

export interface MemberOption {
  id: string
  name: string
  email: string | null
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function getDayLabel(dayOfWeek: number): string {
  return DAY_LABELS[dayOfWeek] ?? ''
}

// Genera 7 días rolling desde hoy
export function generateDayOptions(daysCount: number = 7): DayOption[] {
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const result: DayOption[] = []
  for (let i = 0; i < daysCount; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    result.push({
      date: iso,
      dayOfWeek: d.getDay(),
      dayLabel: getDayLabel(d.getDay()),
      dayNumber: d.getDate(),
      isToday: iso === todayIso,
    })
  }
  return result
}

export const CLASS_TYPE_LABEL: Record<ClassType, string> = {
  dinamico: 'Dinámico',
  premium: 'Premium',
  salud: 'Salud',
  personal_1h: 'Personal 1h',
  personal_30min: 'Personal 30min',
  grupal: 'Grupal',
}
