'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'

const uuidSchema = z.string().trim().uuid('ID inválido')

export type ExpenseCategory =
  | 'material'
  | 'utilities'
  | 'rent'
  | 'staff'
  | 'cleaning'
  | 'marketing'
  | 'software'
  | 'maintenance'
  | 'other'

export interface Expense {
  id: string
  gymId: string
  category: ExpenseCategory
  supplier: string | null
  description: string
  amount: number
  currency: string
  taxAmount: number
  expenseDate: string
  invoiceUrl: string | null
  invoiceNumber: string | null
  notes: string | null
  createdAt: string
}

export interface ExpenseKpis {
  monthStart: string
  totalExpenses: number
  totalExpensesByCategory: Record<string, number>
  totalIncome: number
  grossMargin: number
  grossMarginPct: number
}

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

async function resolveActiveGymId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('current_user_gyms')
  return data && data.length > 0 ? data[0].gym_id : null
}

function rowToExpense(row: Record<string, unknown>): Expense {
  return {
    id: row.id as string,
    gymId: row.gym_id as string,
    category: row.category as ExpenseCategory,
    supplier: (row.supplier as string | null) ?? null,
    description: row.description as string,
    amount: Number(row.amount),
    currency: row.currency as string,
    taxAmount: Number(row.tax_amount ?? 0),
    expenseDate: row.expense_date as string,
    invoiceUrl: (row.invoice_url as string | null) ?? null,
    invoiceNumber: (row.invoice_number as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}

// ============================================================================
// listExpenses
// ============================================================================

export async function listExpensesAction(
  fromDate?: string,
  toDate?: string,
  category?: ExpenseCategory,
  supplier?: string
): Promise<Expense[]> {
  const supabase = await createClient()
  const gymId = await resolveActiveGymId()
  if (!gymId) return []

  const today = new Date()
  const defaultFrom = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
  const args: Record<string, unknown> = {
    p_gym_id: gymId,
    p_from: fromDate ?? defaultFrom.toISOString().slice(0, 10),
    p_to: toDate ?? today.toISOString().slice(0, 10),
  }
  if (category) args.p_category = category
  if (supplier) args.p_supplier = supplier

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc('list_expenses_range', args as any)
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map(rowToExpense)
}

// ============================================================================
// createExpense
// ============================================================================

interface CreateExpenseInput {
  category: ExpenseCategory
  description: string
  amount: number
  expenseDate?: string
  supplier?: string | null
  taxAmount?: number
  invoiceNumber?: string | null
  invoiceUrl?: string | null
  notes?: string | null
}

export async function createExpenseAction(
  input: CreateExpenseInput
): Promise<ActionResult<{ id: string }>> {
  const rl = await rateLimit('api')
  if (!rl.success) return { ok: false, error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  // Input validation minimal: amount > 0, description non-empty
  if (!input.description || input.description.trim().length === 0) {
    return { ok: false, error: 'Descripción requerida' }
  }
  if (!Number.isFinite(input.amount) || input.amount < 0 || input.amount > 1_000_000) {
    return { ok: false, error: 'Importe inválido' }
  }

  const supabase = await createClient()
  const gymId = await resolveActiveGymId()
  if (!gymId) return { ok: false, error: 'No hay gym activo en la sesión' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc('create_expense', {
    p_gym_id: gymId,
    p_category: input.category,
    p_description: input.description,
    p_amount: input.amount,
    p_expense_date: input.expenseDate ?? new Date().toISOString().slice(0, 10),
    p_supplier: input.supplier ?? null,
    p_tax_amount: input.taxAmount ?? 0,
    p_invoice_number: input.invoiceNumber ?? null,
    p_invoice_url: input.invoiceUrl ?? null,
    p_notes: input.notes ?? null,
  } as any)

  if (error) return { ok: false, error: sanitizeServerError(error, humanize(error.message)) }
  if (!data) return { ok: false, error: 'Error al crear el gasto' }
  revalidatePath('/pagos/gastos')
  revalidatePath('/')
  return { ok: true, data: { id: (data as Record<string, unknown>).id as string } }
}

// ============================================================================
// updateExpense
// ============================================================================

interface UpdateExpenseInput {
  id: string
  category?: ExpenseCategory
  supplier?: string | null
  description?: string
  amount?: number
  taxAmount?: number
  expenseDate?: string
  invoiceNumber?: string | null
  invoiceUrl?: string | null
  notes?: string | null
}

export async function updateExpenseAction(input: UpdateExpenseInput): Promise<ActionResult> {
  const rl = await rateLimit('api')
  if (!rl.success) return { ok: false, error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const idParsed = uuidSchema.safeParse(input.id)
  if (!idParsed.success) return { ok: false, error: 'ID inválido' }

  if (input.amount !== undefined && (!Number.isFinite(input.amount) || input.amount < 0 || input.amount > 1_000_000)) {
    return { ok: false, error: 'Importe inválido' }
  }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.rpc('update_expense', {
    p_id: idParsed.data,
    p_category: input.category ?? null,
    p_supplier: input.supplier ?? null,
    p_description: input.description ?? null,
    p_amount: input.amount ?? null,
    p_tax_amount: input.taxAmount ?? null,
    p_expense_date: input.expenseDate ?? null,
    p_invoice_number: input.invoiceNumber ?? null,
    p_invoice_url: input.invoiceUrl ?? null,
    p_notes: input.notes ?? null,
  } as any)
  if (error) return { ok: false, error: sanitizeServerError(error, humanize(error.message)) }
  revalidatePath('/pagos/gastos')
  return { ok: true }
}

// ============================================================================
// deleteExpense (soft)
// ============================================================================

export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  const rl = await rateLimit('api')
  if (!rl.success) return { ok: false, error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { ok: false, error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_expense', { p_id: parsed.data })
  if (error) return { ok: false, error: sanitizeServerError(error, humanize(error.message)) }
  revalidatePath('/pagos/gastos')
  revalidatePath('/')
  return { ok: true }
}

// ============================================================================
// getKpis
// ============================================================================

export async function getExpenseKpisAction(monthDate?: string): Promise<ExpenseKpis | null> {
  const supabase = await createClient()
  const gymId = await resolveActiveGymId()
  if (!gymId) return null

  const today = new Date()
  const monthStart = monthDate ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`

  const { data, error } = await supabase.rpc('gym_expenses_kpis', {
    p_gym_id: gymId,
    p_month: monthStart,
  })
  if (error || !data || data.length === 0) return null
  const row = data[0] as Record<string, unknown>
  return {
    monthStart: row.month_start as string,
    totalExpenses: Number(row.total_expenses ?? 0),
    totalExpensesByCategory: (row.total_expenses_by_category as Record<string, number>) ?? {},
    totalIncome: Number(row.total_income ?? 0),
    grossMargin: Number(row.gross_margin ?? 0),
    grossMarginPct: Number(row.gross_margin_pct ?? 0),
  }
}

// ============================================================================
// uploadInvoice — signed URL flow para upload a bucket gym-expenses
// ============================================================================

export async function createInvoiceUploadUrlAction(
  expenseId: string,
  fileName: string
): Promise<{ ok: true; uploadPath: string; signedUrl: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const gymId = await resolveActiveGymId()
  if (!gymId) return { ok: false, error: 'Sin gym activo' }

  const ext = fileName.split('.').pop()?.toLowerCase() ?? 'bin'
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'pdf']
  if (!allowed.includes(ext)) {
    return { ok: false, error: `Extensión no permitida (usa ${allowed.join(', ')})` }
  }

  const uploadPath = `${gymId}/${expenseId}.${ext}`

  const { data, error } = await supabase.storage
    .from('gym-expenses')
    .createSignedUploadUrl(uploadPath)

  if (error || !data) return { ok: false, error: error?.message ?? 'No se pudo generar URL' }

  return { ok: true, uploadPath, signedUrl: data.signedUrl }
}

export async function getInvoiceDownloadUrlAction(
  invoicePath: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from('gym-expenses')
    .createSignedUrl(invoicePath, 3600)
  if (error || !data) return { ok: false, error: error?.message ?? 'No se pudo generar URL' }
  return { ok: true, url: data.signedUrl }
}

// ============================================================================
// Helper humanize
// ============================================================================

function humanize(raw: string): string {
  if (raw.includes('No tienes permiso')) return 'No tienes permiso para esta acción.'
  if (raw.includes('amount debe ser >= 0')) return 'El importe debe ser mayor o igual a 0.'
  if (raw.includes('description obligatoria')) return 'La descripción es obligatoria.'
  if (raw.includes('gasto no existe')) return 'El gasto ya no existe.'
  return raw
}
