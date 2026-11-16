// Tipos compartidos server/client. Sin imports server-only.

export type PaymentMode =
  | 'manual'
  | 'direct_keys'
  | 'connect_express'
  | 'connect_standard'
  | 'managed'

export interface GymProfile {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  country: string | null
  phone: string | null
  email: string | null
  website: string | null
  timezone: string
  currency: string
  taxId: string | null
  status: 'active' | 'trial' | 'suspended' | 'cancelled'
  plan: string
  paymentMode: PaymentMode
  stripePublishableKey: string | null
  stripeOnboardedAt: string | null
  feePercentSepa: number
  feePercentCard: number
  // Datos fiscales emisor (RD 1619/2012) — separados del perfil comercial
  legalName: string | null
  fiscalAddressLine1: string | null
  fiscalAddressPostalCode: string | null
  fiscalAddressCity: string | null
  fiscalCountryCode: string
  // Web pública (logo, hero, galería)
  webHeroUrl: string | null
  webGalleryUrls: string[]
  // Política morosos
  blockMorososAfterDays: number | null
}

export interface StripeAccountInfo {
  accountId: string
  email: string | null
  country: string | null
  businessName: string | null
  chargesEnabled: boolean
  payoutsEnabled: boolean
  isLiveMode: boolean
}

export interface GymSettings {
  gymId: string
  bookingAdvanceDays: number
  bookingCancelHours: number
  waitlistEnabled: boolean
  brandColor: string
}

export interface CurrentUserInfo {
  email: string
  role: 'super_admin' | 'owner' | 'admin' | 'staff' | 'trainer' | 'viewer'
  canEdit: boolean // true si role in (super_admin, owner, admin)
}

export const STATUS_LABEL: Record<GymProfile['status'], string> = {
  active: 'Activo',
  trial: 'Periodo de prueba',
  suspended: 'Suspendido',
  cancelled: 'Cancelado',
}

export const STATUS_STYLES: Record<GymProfile['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  trial: 'bg-blue-50 text-blue-700 ring-blue-200',
  suspended: 'bg-amber-50 text-amber-700 ring-amber-200',
  cancelled: 'bg-slate-100 text-slate-500 ring-slate-200',
}
