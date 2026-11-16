// Types compartidos server/client. Sin imports server-only.

export type InvoiceStatus = 'draft' | 'issued' | 'cancelled' | 'voided'

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  cancelled: 'Rectificada',
  voided: 'Anulada',
}

export const INVOICE_STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  issued: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-amber-50 text-amber-800 ring-amber-200',
  voided: 'bg-slate-100 text-slate-500 ring-slate-200',
}

export interface InvoiceRow {
  id: string
  invoiceNumber: string
  series: string
  issueDate: string // ISO date
  status: InvoiceStatus
  receiverName: string
  receiverTaxId: string | null
  subtotalCents: number
  taxRatePct: number
  taxCents: number
  totalCents: number
  currency: string
  linkedPaymentId: string | null
  description: string
  createdAt: string
}

export interface InvoiceDetail extends InvoiceRow {
  gymId: string
  memberId: string | null
  sequenceYear: number
  sequenceNumber: number
  dueDate: string | null
  operationDate: string | null
  emitterLegalName: string
  emitterTaxId: string
  emitterFiscalAddress: string
  emitterPostalCode: string
  emitterCity: string
  emitterCountryCode: string
  receiverEmail: string | null
  receiverAddress: string | null
  notes: string | null
  issuedAt: string | null
  cancelledAt: string | null
  cancellationReason: string | null
}

export interface BillablePayment {
  id: string
  memberId: string
  memberName: string
  memberEmail: string | null
  memberTaxId: string | null
  description: string
  amount: number
  paidAt: string
  method: string
  hasInvoice: boolean
}

export function centsToEur(cents: number): number {
  return cents / 100
}

export function formatEurCents(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

export function formatEur(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

export function formatDateEs(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
