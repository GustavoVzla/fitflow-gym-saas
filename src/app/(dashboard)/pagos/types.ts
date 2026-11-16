// Types compartidos entre Server y Client. Sin imports server-only.

export type DbPaymentMethod =
  | 'manual'
  | 'sepa'
  | 'card'
  | 'stripe'
  | 'cash'
  | 'bank_transfer'

export type DbPaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'cancelled'

export interface PaymentRow {
  id: string
  memberId: string
  memberName: string
  memberEmail: string | null
  description: string
  concept: string | null
  amount: number
  currency: string
  method: DbPaymentMethod
  status: DbPaymentStatus
  periodStart: string | null
  periodEnd: string | null
  dueDate: string | null
  paidAt: string | null
  createdAt: string
}

export interface MemberOption {
  id: string
  name: string
  email: string | null
}

export interface TariffOption {
  id: string
  name: string
  group: string | null
  price: number
  type: 'monthly' | 'bonus' | 'one_time'
}

export const METHOD_LABEL: Record<DbPaymentMethod, string> = {
  manual: 'Manual',
  sepa: 'SEPA',
  card: 'Tarjeta',
  stripe: 'Stripe',
  cash: 'Efectivo',
  bank_transfer: 'Transferencia',
}

export const STATUS_LABEL: Record<DbPaymentStatus, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  completed: 'Completado',
  failed: 'Fallido',
  refunded: 'Reembolsado',
  cancelled: 'Cancelado',
}

export function formatEUR(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
