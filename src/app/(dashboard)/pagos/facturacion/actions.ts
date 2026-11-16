'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type FacturacionActionState = {
  error?: string
  success?: string
  invoiceId?: string
}

const generateSchema = z.object({
  paymentId: z.string().uuid('Pago invalido'),
  taxRatePct: z.number().min(0).max(100).default(21),
  receiverTaxId: z.string().trim().max(20).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
})

export async function generateInvoiceFromPaymentAction(
  _prev: FacturacionActionState,
  formData: FormData
): Promise<FacturacionActionState> {
  const raw = {
    paymentId: String(formData.get('paymentId') ?? ''),
    taxRatePct: Number(formData.get('taxRatePct') ?? 21),
    receiverTaxId: String(formData.get('receiverTaxId') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  }

  const parsed = generateSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos invalidos' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('generate_invoice_from_payment', {
    p_payment_id: parsed.data.paymentId,
    p_tax_rate_pct: parsed.data.taxRatePct,
    p_receiver_tax_id: parsed.data.receiverTaxId || undefined,
    p_notes: parsed.data.notes || undefined,
  })

  if (error) return { error: error.message }
  if (!data) return { error: 'No se pudo generar la factura' }

  revalidatePath('/pagos/facturacion')
  revalidatePath(`/pagos/facturacion/${data}`)
  return { success: 'Factura generada correctamente', invoiceId: data as string }
}
