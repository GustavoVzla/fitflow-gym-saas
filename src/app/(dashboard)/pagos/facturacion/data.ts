import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { InvoiceRow, InvoiceDetail, BillablePayment, InvoiceStatus } from './types'

export type { InvoiceRow, InvoiceDetail, BillablePayment } from './types'

async function getActiveGymId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('current_user_gyms')
  return data && data.length > 0 ? data[0].gym_id : null
}

export const getInvoices = cache(async (): Promise<InvoiceRow[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, series, issue_date, status, receiver_name, receiver_tax_id, subtotal_cents, tax_rate_pct, tax_cents, total_cents, currency, linked_payment_id, description, created_at'
    )
    .order('issue_date', { ascending: false })
    .order('sequence_number', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[getInvoices] error:', error)
    return []
  }

  return (data ?? []).map((r): InvoiceRow => ({
    id: r.id,
    invoiceNumber: r.invoice_number,
    series: r.series,
    issueDate: r.issue_date,
    status: r.status as InvoiceStatus,
    receiverName: r.receiver_name,
    receiverTaxId: r.receiver_tax_id,
    subtotalCents: r.subtotal_cents,
    taxRatePct: Number(r.tax_rate_pct),
    taxCents: r.tax_cents,
    totalCents: r.total_cents,
    currency: r.currency,
    linkedPaymentId: r.linked_payment_id,
    description: r.description,
    createdAt: r.created_at,
  }))
})

export const getInvoiceById = cache(async (id: string): Promise<InvoiceDetail | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null

  return {
    id: data.id,
    gymId: data.gym_id,
    memberId: data.member_id,
    invoiceNumber: data.invoice_number,
    series: data.series,
    sequenceYear: data.sequence_year,
    sequenceNumber: data.sequence_number,
    issueDate: data.issue_date,
    dueDate: data.due_date,
    operationDate: data.operation_date,
    status: data.status as InvoiceStatus,
    subtotalCents: data.subtotal_cents,
    taxRatePct: Number(data.tax_rate_pct),
    taxCents: data.tax_cents,
    totalCents: data.total_cents,
    currency: data.currency,
    linkedPaymentId: data.linked_payment_id,
    description: data.description,
    notes: data.notes,
    emitterLegalName: data.emitter_legal_name,
    emitterTaxId: data.emitter_tax_id,
    emitterFiscalAddress: data.emitter_fiscal_address,
    emitterPostalCode: data.emitter_postal_code,
    emitterCity: data.emitter_city,
    emitterCountryCode: data.emitter_country_code,
    receiverName: data.receiver_name,
    receiverTaxId: data.receiver_tax_id,
    receiverEmail: data.receiver_email,
    receiverAddress: data.receiver_address,
    issuedAt: data.issued_at,
    cancelledAt: data.cancelled_at,
    cancellationReason: data.cancellation_reason,
    createdAt: data.created_at,
  }
})

/**
 * Pagos completed sin factura ligada — candidatos a generar factura.
 */
export const getBillablePayments = cache(async (): Promise<BillablePayment[]> => {
  const supabase = await createClient()
  const gymId = await getActiveGymId()
  if (!gymId) return []

  // Pagos completed del gym
  const { data: payments, error } = await supabase
    .from('payments')
    .select(
      `id, member_id, description, amount, method, paid_at,
       member:member_id (first_name, last_name, email, tax_id)`
    )
    .eq('gym_id', gymId)
    .eq('status', 'completed')
    .order('paid_at', { ascending: false })
    .limit(200)

  if (error || !payments) {
    if (error) console.error('[getBillablePayments] payments error:', error)
    return []
  }

  // Facturas vivas ligadas (para marcar hasInvoice)
  const ids = payments.map((p) => p.id)
  const { data: linked } = ids.length > 0
    ? await supabase
        .from('invoices')
        .select('linked_payment_id')
        .in('linked_payment_id', ids)
        .in('status', ['draft', 'issued'])
    : { data: [] as Array<{ linked_payment_id: string | null }> }

  const linkedSet = new Set((linked ?? []).map((r) => r.linked_payment_id).filter(Boolean) as string[])

  return payments.map((p): BillablePayment => {
    const member = Array.isArray(p.member) ? p.member[0] : p.member
    const memberName = member
      ? `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() || 'Socio sin nombre'
      : 'Socio eliminado'
    return {
      id: p.id,
      memberId: p.member_id,
      memberName,
      memberEmail: member?.email ?? null,
      memberTaxId: member?.tax_id ?? null,
      description: p.description,
      amount: Number(p.amount),
      paidAt: p.paid_at ?? '',
      method: p.method,
      hasInvoice: linkedSet.has(p.id),
    }
  })
})

export const getGymFiscalReady = cache(async (): Promise<{ ready: boolean; missing: string[] }> => {
  const supabase = await createClient()
  const gymId = await getActiveGymId()
  if (!gymId) return { ready: false, missing: ['No hay gym activo'] }

  const { data } = await supabase
    .from('gyms')
    .select('legal_name, tax_id, fiscal_address_line1, fiscal_address_postal_code, fiscal_address_city')
    .eq('id', gymId)
    .single()

  if (!data) return { ready: false, missing: ['Gym no encontrado'] }

  const missing: string[] = []
  if (!data.legal_name) missing.push('Razón social')
  if (!data.tax_id) missing.push('CIF/NIF')
  if (!data.fiscal_address_line1) missing.push('Domicilio fiscal')
  if (!data.fiscal_address_postal_code) missing.push('Código postal')
  if (!data.fiscal_address_city) missing.push('Ciudad')

  return { ready: missing.length === 0, missing }
})
