// Client-safe types + constants shared between Server data.ts and Client panels.
// Import from this file (NOT data.ts) inside 'use client' components.

export interface AdminGymRow {
  id: string
  name: string
  slug: string
  plan: string
  status: string
  ownerEmail: string | null
  ownerName: string | null
  membersCount: number
  activeMembersCount: number
  createdAt: string
  deletedAt: string | null
  suspendedAt: string | null
}

export interface AdminGymDetail extends AdminGymRow {
  paymentMode: string
  stripeOnboardedAt: string | null
  feePercentSepa: number
  feePercentCard: number
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  country: string | null
  taxId: string | null
  website: string | null
  timezone: string | null
  currency: string | null
  suspendedAt: string | null
  suspendedReason: string | null
  deletedAt: string | null
}

export interface AdminGlobalStats {
  totalGyms: number
  activeGyms: number
  totalMembers: number
  totalActiveMembers: number
  revenueThisMonthCents: number
  newGymsThisMonth: number
}

export interface AdminGymUser {
  gymUserId: string
  userId: string
  email: string
  fullName: string
  role: string
  isActive: boolean
  mustChangePassword: boolean
  lastSignInAt: string | null
  invitedAt: string | null
  acceptedAt: string | null
  createdAt: string
}

export interface AdminAuditLogRow {
  id: string
  actorUserId: string | null
  actorEmail: string | null
  action: string
  resourceType: string
  resourceId: string | null
  gymId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  base: { label: 'Base', color: 'bg-slate-100 text-slate-700 ring-slate-200' },
  smart: { label: 'Smart', color: 'bg-violet-100 text-violet-700 ring-violet-200' },
  pro: { label: 'Pro', color: 'bg-blue-100 text-blue-700 ring-blue-200' },
  premium: { label: 'Premium', color: 'bg-amber-100 text-amber-700 ring-amber-200' },
  app_pro: { label: 'App Pro', color: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  enterprise: { label: 'Enterprise', color: 'bg-purple-100 text-purple-700 ring-purple-200' },
}

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Activo', color: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  trial: { label: 'Trial', color: 'bg-blue-50 text-blue-700 ring-blue-200' },
  suspended: { label: 'Suspendido', color: 'bg-red-50 text-red-700 ring-red-200' },
  cancelled: { label: 'Cancelado', color: 'bg-slate-100 text-slate-500 ring-slate-200' },
}

export const PAYMENT_MODE_LABELS: Record<string, { label: string; color: string; hint: string }> = {
  manual: {
    label: 'Manual',
    color: 'bg-slate-100 text-slate-700 ring-slate-200',
    hint: 'Sin Stripe. Cobros registrados a mano.',
  },
  direct_keys: {
    label: 'Direct Keys',
    color: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    hint: 'El gym usa su propia cuenta Stripe.',
  },
  connect_express: {
    label: 'Connect Express',
    color: 'bg-blue-50 text-blue-700 ring-blue-200',
    hint: 'Onboarding Stripe hosted en FitFlow (Fase 2).',
  },
  connect_standard: {
    label: 'Connect Standard',
    color: 'bg-violet-50 text-violet-700 ring-violet-200',
    hint: 'OAuth Stripe (Fase 3).',
  },
  managed: {
    label: 'Managed',
    color: 'bg-amber-50 text-amber-700 ring-amber-200',
    hint: 'FitFlow cobra y paga al gym (Fase 4).',
  },
}

export const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'bg-blue-50 text-blue-700 ring-blue-200' },
  admin: { label: 'Admin', color: 'bg-violet-50 text-violet-700 ring-violet-200' },
  staff: { label: 'Staff', color: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  trainer: { label: 'Trainer', color: 'bg-amber-50 text-amber-700 ring-amber-200' },
  viewer: { label: 'Viewer', color: 'bg-slate-50 text-slate-600 ring-slate-200' },
  super_admin: { label: 'Super Admin', color: 'bg-red-50 text-red-700 ring-red-200' },
}

export const AUDIT_ACTION_LABELS: Record<string, { label: string; tone: 'info' | 'warn' | 'danger' | 'ok' }> = {
  'gym.update': { label: 'Actualización de datos', tone: 'info' },
  'gym.change_plan': { label: 'Cambio de plan', tone: 'info' },
  'gym.change_payment_mode': { label: 'Cambio de modo de pago', tone: 'info' },
  'gym.suspend': { label: 'Cuenta suspendida', tone: 'warn' },
  'gym.reactivate': { label: 'Cuenta reactivada', tone: 'ok' },
  'gym.soft_delete': { label: 'Eliminación (soft delete)', tone: 'danger' },
  'gym.restore': { label: 'Restauración', tone: 'ok' },
  'gym.remove_user': { label: 'Usuario eliminado', tone: 'warn' },
  'gym.transfer_ownership': { label: 'Transferencia de ownership', tone: 'warn' },
  'user.reset_password': { label: 'Reset de password', tone: 'warn' },
  'cron.hard_delete': { label: 'Purga automática (30d)', tone: 'danger' },
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  })
}
