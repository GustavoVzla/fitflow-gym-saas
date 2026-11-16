// Tipos compartidos server/client. Sin imports server-only.

export type DbDiscountType = 'percentage' | 'fixed' | 'free_trial'

export type UiDiscountType = 'Porcentaje' | 'Cantidad fija' | 'Prueba gratis'

// 0071_pd_offers_target_audience
export type OfferTargetAudience = 'all' | 'active' | 'new' | 'churned'

export const AUDIENCE_LABELS: Record<OfferTargetAudience, string> = {
  all: 'Todos los socios',
  active: 'Socios activos',
  new: 'Nuevos (< 30 días)',
  churned: 'Reactivación (inactivos)',
}

export const AUDIENCE_OPTIONS: OfferTargetAudience[] = ['all', 'active', 'new', 'churned']

export interface OfferRow {
  id: string
  title: string
  description: string | null
  discountType: DbDiscountType | null
  discountValue: number | null
  validFrom: string | null
  validUntil: string | null
  maxRedemptions: number | null
  currentRedemptions: number
  code: string | null
  isActive: boolean
  createdAt: string
  // 0071
  targetAudience: OfferTargetAudience
  applicableTariffIds: string[]
  // Helpers calculados
  discountLabel: string // "10%", "5,00 €", "Prueba gratis"
  validityLabel: string // "Sin fecha", "Hasta 31/12/2026", "Vence en 5 días", "Vencida"
  redemptionsLabel: string // "12 usos", "5 / 100 usos"
  statusLabel: 'Activa' | 'Inactiva' | 'Vencida' | 'Agotada'
  audienceLabel: string
  tariffsLabel: string // "Todas" | "3 tarifas" | "Dinámico ilimitado"
}

export const DISCOUNT_TYPE_UI_MAP: Record<DbDiscountType, UiDiscountType> = {
  percentage: 'Porcentaje',
  fixed: 'Cantidad fija',
  free_trial: 'Prueba gratis',
}

export const DISCOUNT_TYPE_DB_MAP: Record<UiDiscountType, DbDiscountType> = {
  Porcentaje: 'percentage',
  'Cantidad fija': 'fixed',
  'Prueba gratis': 'free_trial',
}

export const STATUS_STYLES: Record<OfferRow['statusLabel'], string> = {
  Activa: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Inactiva: 'bg-slate-100 text-slate-500 ring-slate-200',
  Vencida: 'bg-red-50 text-red-600 ring-red-200',
  Agotada: 'bg-amber-50 text-amber-700 ring-amber-200',
}

export function formatEUR(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

export function computeDiscountLabel(
  type: DbDiscountType | null,
  value: number | null
): string {
  if (!type) return '—'
  if (type === 'free_trial') return 'Prueba gratis'
  if (value == null) return '—'
  if (type === 'percentage') return `${value}%`
  if (type === 'fixed') return formatEUR(value)
  return '—'
}

export function computeValidityLabel(
  validFrom: string | null,
  validUntil: string | null
): string {
  if (!validUntil && !validFrom) return 'Sin fecha límite'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  if (validFrom && validFrom > todayStr) {
    const d = new Date(validFrom + 'T12:00:00')
    return `Desde ${d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`
  }

  if (validUntil) {
    const d = new Date(validUntil + 'T12:00:00')
    if (validUntil < todayStr) return 'Vencida'
    const diffDays = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays <= 7) return `Vence en ${diffDays} día${diffDays === 1 ? '' : 's'}`
    return `Hasta ${d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
  }

  return 'Sin fecha límite'
}

export function computeStatus(
  isActive: boolean,
  validFrom: string | null,
  validUntil: string | null,
  currentRedemptions: number,
  maxRedemptions: number | null
): OfferRow['statusLabel'] {
  if (!isActive) return 'Inactiva'
  if (maxRedemptions != null && currentRedemptions >= maxRedemptions) return 'Agotada'
  const todayStr = new Date().toISOString().slice(0, 10)
  if (validUntil && validUntil < todayStr) return 'Vencida'
  if (validFrom && validFrom > todayStr) return 'Inactiva'
  return 'Activa'
}

export function computeRedemptionsLabel(
  current: number,
  max: number | null
): string {
  if (max == null) return `${current} uso${current === 1 ? '' : 's'}`
  return `${current} / ${max} usos`
}
