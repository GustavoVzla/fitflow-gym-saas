// Tipos compartidos server/client. Sin imports server-only.

export type DbTaskStatus = 'todo' | 'in_progress' | 'done' | 'archived'
export type DbTaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type DbTaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly'

export type UiPriority = 'Alta' | 'Media' | 'Baja' | 'Urgente'
export type UiRecurrence = 'Ninguna' | 'Diaria' | 'Semanal' | 'Mensual'

export interface TaskRow {
  id: string
  title: string
  description: string | null
  status: DbTaskStatus
  priority: DbTaskPriority
  uiPriority: UiPriority
  assignedTo: string | null
  assignedToName: string | null
  memberId: string | null
  memberName: string | null
  instructorId: string | null
  instructorName: string | null
  phone: string | null
  relatedPaymentId: string | null
  relatedPaymentLabel: string | null
  recurrenceType: DbTaskRecurrence
  recurrenceInterval: number | null
  recurrenceEndDate: string | null
  dueDate: string | null
  dueDateLabel: string // "Hoy", "Mañana", "dd/mm/yyyy", "Vencida dd/mm"
  createdAt: string
  completedAt: string | null
  createdBy: string | null
  createdByName: string | null
}

export interface MemberOption {
  id: string
  name: string
  phone: string | null
}

export interface InstructorOption {
  id: string
  name: string
}

export interface StaffOption {
  userId: string
  label: string // "Nombre · rol" o email si no hay nombre
}

export interface PaymentOption {
  id: string
  label: string // "15/04 · 95€ · María García"
}

export const RECURRENCE_MAP: Record<DbTaskRecurrence, UiRecurrence> = {
  none: 'Ninguna',
  daily: 'Diaria',
  weekly: 'Semanal',
  monthly: 'Mensual',
}

export const RECURRENCE_REVERSE_MAP: Record<UiRecurrence, DbTaskRecurrence> = {
  Ninguna: 'none',
  Diaria: 'daily',
  Semanal: 'weekly',
  Mensual: 'monthly',
}

export type UiSection = 'hoy' | 'bandeja' | 'proximo' | 'completado'

export const PRIORITY_MAP: Record<DbTaskPriority, UiPriority> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
}

export const PRIORITY_REVERSE_MAP: Record<UiPriority, DbTaskPriority> = {
  Urgente: 'urgent',
  Alta: 'high',
  Media: 'medium',
  Baja: 'low',
}

export const PRIORITY_STYLES: Record<UiPriority, { dot: string; label: string; ring: string }> = {
  Urgente: { dot: 'bg-red-600', label: 'Urgente', ring: 'ring-red-200' },
  Alta: { dot: 'bg-red-400', label: 'Alta', ring: 'ring-red-200' },
  Media: { dot: 'bg-amber-500', label: 'Media', ring: 'ring-amber-200' },
  Baja: { dot: 'bg-emerald-500', label: 'Baja', ring: 'ring-emerald-200' },
}

// Calcular label relativo para la fecha de vencimiento
export function computeDueDateLabel(dueDate: string | null): {
  label: string
  isOverdue: boolean
  isToday: boolean
} {
  if (!dueDate) return { label: 'Sin fecha', isOverdue: false, isToday: false }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T12:00:00')
  const dueMidnight = new Date(due)
  dueMidnight.setHours(0, 0, 0, 0)

  const diffMs = dueMidnight.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return { label: 'Hoy', isOverdue: false, isToday: true }
  if (diffDays === 1) return { label: 'Mañana', isOverdue: false, isToday: false }
  if (diffDays === -1) return { label: 'Ayer', isOverdue: true, isToday: false }
  if (diffDays < 0) {
    const formatted = due.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
    return { label: `Vencida ${formatted}`, isOverdue: true, isToday: false }
  }
  if (diffDays > 0 && diffDays <= 7) {
    const weekday = due.toLocaleDateString('es-ES', { weekday: 'long' })
    return {
      label: weekday.charAt(0).toUpperCase() + weekday.slice(1),
      isOverdue: false,
      isToday: false,
    }
  }
  const formatted = due.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  return { label: formatted, isOverdue: false, isToday: false }
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
