// Types + helpers compartidos entre Server Components y Client Components.
// NO importar desde aquí módulos server-only (next/headers, supabase/server, etc.)

export type GroupColor = 'blue' | 'amber' | 'green' | 'purple'

export interface TariffRow {
  id: string
  group: string
  groupColor: GroupColor
  name: string
  price: number
  priceLabel: string
  type: 'Mensual' | 'Bono'
  isActive: boolean
}

export type ClassType =
  | 'dinamico'
  | 'premium'
  | 'salud'
  | 'personal_1h'
  | 'personal_30min'
  | 'grupal'

export interface ClassRow {
  id: string
  name: string
  type: ClassType
  instructorId: string | null
  instructorName: string | null
  dayOfWeek: number
  startTime: string
  endTime: string
  maxSpots: number
  waitlistSize: number
  room: string | null
  color: string | null
  isActive: boolean
}

export interface InstructorRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  specialties: string[]
  color: string
  isActive: boolean
}

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export function getDayName(dayOfWeek: number): string {
  return DAYS_ES[dayOfWeek] ?? ''
}
