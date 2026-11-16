// Tipos compartidos entre server (page.tsx) y client (DashboardView.tsx).
// Sin imports server-only.

export interface DashboardKPIs {
  activeMembers: number
  totalMembers: number
  monthRevenue: number
  averageTicket: number
  churnRate: number
  leftThisMonth: number
}

export interface DashboardUpcomingClass {
  id: string
  className: string
  classType: string
  instructorName: string | null
  startTime: string // HH:MM
  endTime: string // HH:MM
  scheduledDate: string // YYYY-MM-DD
  bookedCount: number
  maxSpots: number
}

export interface DashboardRecentPayment {
  id: string
  memberName: string
  description: string
  amount: number
  paidAt: string // ISO
  method: string
  methodLabel: string
}

export interface DashboardRevenueMonth {
  month: string // "Ene", "Feb", ...
  year: number
  amount: number
}

export interface DashboardTariffDistribution {
  group: string
  count: number
  percentage: number
  color: string
}

export type StepOverride = {
  skipped: boolean
  manually_completed: boolean
}

export type StepOverrides = {
  profile?: StepOverride
  instructors?: StepOverride
  tariffs?: StepOverride
  classes?: StepOverride
  instances?: StepOverride
  members?: StepOverride
}

export interface OnboardingProgress {
  profileComplete: boolean
  hasInstructors: boolean
  hasTariffs: boolean
  hasClasses: boolean
  hasInstances: boolean
  hasMembers: boolean
  completedCount: number
  totalCount: number
  // True si todo está hecho: el checklist se auto-oculta
  allDone: boolean
  // ISO timestamp del "No volver a mostrar". Null = nunca dismissed.
  // Persistido en public.gym_onboarding_progress (migración 0024).
  dismissedAt: string | null
  // Per-step overrides: skipped o manually_completed por paso.
  // Persistido en gym_onboarding_progress.step_overrides JSONB (migración 0027).
  stepOverrides: StepOverrides
}

export interface DashboardData {
  gymId: string | null
  kpis: DashboardKPIs
  upcomingClasses: DashboardUpcomingClass[]
  recentPayments: DashboardRecentPayment[]
  revenueByMonth: DashboardRevenueMonth[]
  tariffDistribution: DashboardTariffDistribution[]
  onboarding: OnboardingProgress
}

export const METHOD_LABEL: Record<string, string> = {
  manual: 'Manual',
  cash: 'Efectivo',
  card: 'Tarjeta',
  bank_transfer: 'Transferencia',
  sepa: 'SEPA',
  stripe: 'Stripe',
}

export const GROUP_COLORS: Record<string, string> = {
  Dinamico: '#3b8bea',
  Reducidos: '#f59e0b',
  Premium: '#f59e0b',
  'Salud +65': '#10b981',
  Salud: '#10b981',
  Personal: '#8b5cf6',
}

export const DEFAULT_COLOR = '#64748b'

export function formatEUR(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

export function formatDateShort(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
    })
  } catch {
    return ''
  }
}
