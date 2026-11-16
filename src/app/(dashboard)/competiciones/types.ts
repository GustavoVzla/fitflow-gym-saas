// Tipos compartidos server/client. Sin imports server-only.

export type UiCompType = 'Individual' | 'Equipos' | 'Reto semanal' | 'Torneo'

export interface CompetitionRow {
  id: string
  name: string
  description: string | null
  startDate: string // YYYY-MM-DD
  endDate: string
  type: string | null
  participantsCount: number
  isActive: boolean
  createdAt: string

  // 0067_pd_competitions_expand — campos paridad LegacyGym
  slug: string | null
  coverImageUrl: string | null
  conditions: string | null
  onlineRegistrationEnabled: boolean
  priceCents: number | null
  taxPercent: number | null
  maxRegistrations: number | null
  waitlistEnabled: boolean
  categories: string[]
  contactEmail: string | null
  contactPhone: string | null
  locationAddress: string | null
  latitude: number | null
  longitude: number | null

  // Computados
  statusLabel: 'Próxima' | 'En curso' | 'Finalizada' | 'Inactiva'
  rangeLabel: string
  registrationsCount?: number
}

export interface CompetitionRegistrationRow {
  id: string
  competitionId: string
  memberId: string | null
  memberName: string | null
  externalFirstName: string | null
  externalLastName: string | null
  externalEmail: string | null
  externalPhone: string | null
  category: string | null
  paid: boolean
  paymentId: string | null
  amountCents: number | null
  waitlisted: boolean
  registeredAt: string
  cancelledAt: string | null
  cancellationReason: string | null
  notes: string | null
}

export const TYPE_COLORS: Record<string, string> = {
  Individual: 'bg-blue-100 text-blue-700 ring-blue-200',
  Equipos: 'bg-purple-100 text-purple-700 ring-purple-200',
  'Reto semanal': 'bg-amber-100 text-amber-700 ring-amber-200',
  Torneo: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
}

export const STATUS_STYLES: Record<CompetitionRow['statusLabel'], string> = {
  'Próxima': 'bg-blue-50 text-blue-700 ring-blue-200',
  'En curso': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Finalizada: 'bg-slate-100 text-slate-500 ring-slate-200',
  Inactiva: 'bg-red-50 text-red-600 ring-red-200',
}

export function computeStatus(
  startDate: string,
  endDate: string,
  isActive: boolean
): CompetitionRow['statusLabel'] {
  if (!isActive) return 'Inactiva'
  const today = new Date().toISOString().slice(0, 10)
  if (startDate > today) return 'Próxima'
  if (endDate < today) return 'Finalizada'
  return 'En curso'
}

export function computeRangeLabel(startDate: string, endDate: string): string {
  const s = new Date(startDate + 'T12:00:00')
  const e = new Date(endDate + 'T12:00:00')
  const sameYear = s.getFullYear() === e.getFullYear()
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
    })
  return `${fmt(s, !sameYear)} → ${fmt(e, true)}`
}

// Generador slug a partir del nombre (para UI autosuggest)
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function formatPriceEuros(cents: number | null): string {
  if (cents == null) return 'Gratis'
  return `${(cents / 100).toFixed(2)} €`
}
