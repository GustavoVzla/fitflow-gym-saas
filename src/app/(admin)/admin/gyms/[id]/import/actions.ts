'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type MemberField =
  | 'first_name'
  | 'last_name'
  | 'full_name'
  | 'email'
  | 'phone'
  | 'birth_date'
  | 'tax_id'
  | 'address'
  | 'city'
  | 'postal_code'
  | 'member_number'
  | 'status'
  | 'join_date'
  | 'notes'
  | 'rgpd_consent'
  | 'marketing_consent'
  | 'image_consent'
  | 'ignore'

export type ColumnMapping = Record<string, MemberField>

export type CsvRow = Record<string, string>

export interface ImportRowError {
  row: number
  field?: string
  reason: string
  value?: unknown
}

export interface ValidationResult {
  ok: true
  validRows: Record<string, unknown>[]
  errors: ImportRowError[]
  duplicatesInternal: number
  duplicatesExisting: number
  totalInput: number
}

export interface ValidationError {
  ok: false
  error: string
}

export interface ImportJobResult {
  id: string
  gymId: string
  status: 'pending' | 'dry_run_ok' | 'completed' | 'failed'
  filename: string | null
  rowsTotal: number
  rowsOk: number
  rowsErr: number
  errors: ImportRowError[]
  createdAt: string
}

// ============================================================================
// Helpers
// ============================================================================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseDateFlexible(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim()
  // ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // dd/mm/yyyy o dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    const dd = d.padStart(2, '0')
    const mm = mo.padStart(2, '0')
    const date = new Date(`${y}-${mm}-${dd}T00:00:00Z`)
    if (!isNaN(date.getTime())) return `${y}-${mm}-${dd}`
  }
  return null
}

/**
 * Divide "Nombre Apellidos" en first_name + last_name.
 * Heurística: primer token = first_name, resto = last_name.
 * Edge cases: 1 solo token → first_name = token, last_name = '' (fallará validación).
 * Nombres compuestos ("Juan José Martín López") — primer token = first_name, resto = last_name.
 */
function splitFullName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first_name: '', last_name: '' }
  if (parts.length === 1) return { first_name: parts[0], last_name: '' }
  // 2+ tokens: primer token = first_name, resto = last_name
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(' '),
  }
}

function mapRow(csvRow: CsvRow, mapping: ColumnMapping, rowIdx: number): {
  mapped: Record<string, unknown>
  errors: ImportRowError[]
} {
  const mapped: Record<string, unknown> = {}
  const errors: ImportRowError[] = []

  for (const [csvCol, memberField] of Object.entries(mapping)) {
    if (memberField === 'ignore') continue
    const raw = (csvRow[csvCol] ?? '').toString().trim()

    if (memberField === 'full_name') {
      if (!raw) continue
      const { first_name, last_name } = splitFullName(raw)
      // Solo sobreescribir si no hay first_name/last_name ya asignados por otra columna
      if (!mapped.first_name) mapped.first_name = first_name
      if (!mapped.last_name) mapped.last_name = last_name
      continue
    }

    if (memberField === 'birth_date' || memberField === 'join_date') {
      if (!raw) continue
      const iso = parseDateFlexible(raw)
      if (!iso) {
        errors.push({ row: rowIdx, field: memberField, reason: `Fecha inválida (esperada DD/MM/YYYY o YYYY-MM-DD)`, value: raw })
        continue
      }
      mapped[memberField] = iso
    } else if (memberField === 'rgpd_consent' || memberField === 'marketing_consent' || memberField === 'image_consent') {
      if (!raw) continue
      const lower = raw.toLowerCase()
      mapped[memberField] = ['si', 'sí', 'yes', 'true', '1', 'x'].includes(lower)
    } else if (memberField === 'status') {
      if (!raw) continue
      const lower = raw.toLowerCase()
      // LegacyGym usa: "activa"/"bloqueado"/"sin invitar"/"inactivo" — normalizamos a member_status enum
      // member_status enum: 'active' | 'pending' | 'inactive' | 'blocked'
      if (['activa', 'activo', 'active'].includes(lower)) mapped[memberField] = 'active'
      else if (['sin invitar', 'pendiente', 'pending', 'pendiente invitacion', 'pendiente invitación'].includes(lower)) mapped[memberField] = 'pending'
      else if (['inactive', 'inactivo', 'inactiva', 'baja'].includes(lower)) mapped[memberField] = 'inactive'
      else if (['suspended', 'suspendido', 'bloqueado', 'bloqueada', 'blocked'].includes(lower)) mapped[memberField] = 'blocked'
      else mapped[memberField] = 'pending' // default seguro para imports (no auto-active)
    } else if (memberField === 'email') {
      if (!raw) continue
      if (!EMAIL_RE.test(raw)) {
        errors.push({ row: rowIdx, field: 'email', reason: 'Email con formato inválido', value: raw })
        continue
      }
      mapped[memberField] = raw.toLowerCase()
    } else {
      if (raw) mapped[memberField] = raw
    }
  }

  // Validar obligatorios
  if (!mapped.first_name || !(mapped.first_name as string).length) {
    errors.push({ row: rowIdx, field: 'first_name', reason: 'Nombre requerido' })
  }
  if (!mapped.last_name || !(mapped.last_name as string).length) {
    errors.push({ row: rowIdx, field: 'last_name', reason: 'Apellidos requeridos' })
  }
  if (mapped.first_name && (mapped.first_name as string).length > 50) {
    errors.push({ row: rowIdx, field: 'first_name', reason: 'Nombre excede 50 caracteres', value: mapped.first_name })
  }
  if (mapped.last_name && (mapped.last_name as string).length > 50) {
    errors.push({ row: rowIdx, field: 'last_name', reason: 'Apellidos exceden 50 caracteres', value: mapped.last_name })
  }

  return { mapped, errors }
}

// ============================================================================
// Server Actions
// ============================================================================

export async function validateCsvAction(
  gymId: string,
  csvRows: CsvRow[],
  mapping: ColumnMapping
): Promise<ValidationResult | ValidationError> {
  if (!gymId) return { ok: false, error: 'gym_id requerido' }
  if (!csvRows || csvRows.length === 0) return { ok: false, error: 'CSV vacío' }
  if (csvRows.length > 2000) return { ok: false, error: 'CSV excede 2000 filas (split en múltiples imports)' }

  const supabase = await createClient()

  // Guard is_app_admin via RPC (si falla, no es admin)
  const { data: isAdmin, error: adminErr } = await supabase.rpc('is_app_admin')
  if (adminErr || !isAdmin) return { ok: false, error: 'Solo super-admin puede importar' }

  // Mapear y validar fila por fila
  const validRows: Record<string, unknown>[] = []
  const errors: ImportRowError[] = []
  const emailsInCsv = new Map<string, number>() // email -> primera fila
  let duplicatesInternal = 0

  for (let i = 0; i < csvRows.length; i++) {
    const { mapped, errors: rowErrors } = mapRow(csvRows[i], mapping, i + 1)
    if (rowErrors.length > 0) {
      errors.push(...rowErrors)
      continue
    }

    // Duplicado interno por email (si tiene email)
    const email = mapped.email as string | undefined
    if (email) {
      const existingIdx = emailsInCsv.get(email)
      if (existingIdx !== undefined) {
        duplicatesInternal++
        errors.push({
          row: i + 1,
          field: 'email',
          reason: `Email duplicado dentro del CSV (fila ${existingIdx} tiene el mismo email)`,
          value: email,
        })
        continue
      }
      emailsInCsv.set(email, i + 1)
    }

    validRows.push(mapped)
  }

  // Check duplicados vs members existentes del gym
  let duplicatesExisting = 0
  const emails = [...emailsInCsv.keys()]
  if (emails.length > 0) {
    const { data: existing } = await supabase
      .from('members')
      .select('email')
      .eq('gym_id', gymId)
      .in('email', emails)
    if (existing && existing.length > 0) {
      const existingSet = new Set(existing.map((r) => (r.email as string).toLowerCase()))
      for (let i = validRows.length - 1; i >= 0; i--) {
        const email = validRows[i].email as string | undefined
        if (email && existingSet.has(email)) {
          duplicatesExisting++
          errors.push({
            row: -1, // fila original perdida, referenciar email
            field: 'email',
            reason: `Email ya existe en este gym (${email})`,
            value: email,
          })
          validRows.splice(i, 1)
        }
      }
    }
  }

  return {
    ok: true,
    validRows,
    errors,
    duplicatesInternal,
    duplicatesExisting,
    totalInput: csvRows.length,
  }
}

export async function executeImportAction(
  gymId: string,
  filename: string,
  mapping: ColumnMapping,
  validRows: Record<string, unknown>[]
): Promise<{ ok: true; job: ImportJobResult } | { ok: false; error: string }> {
  if (!gymId) return { ok: false, error: 'gym_id requerido' }
  if (!validRows || validRows.length === 0) return { ok: false, error: 'No hay filas para importar' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_import_members_from_csv', {
    p_gym_id: gymId,
    p_filename: filename,
    p_column_mapping: mapping as unknown as Record<string, string>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p_rows: validRows as any,
  })

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'RPC devolvió null' }

  // data es la row de import_jobs
  const row = data as unknown as Record<string, unknown>
  const job: ImportJobResult = {
    id: row.id as string,
    gymId: row.gym_id as string,
    status: row.status as ImportJobResult['status'],
    filename: (row.filename as string | null) ?? null,
    rowsTotal: Number(row.rows_total),
    rowsOk: Number(row.rows_ok),
    rowsErr: Number(row.rows_err),
    errors: (row.errors_json as ImportRowError[]) ?? [],
    createdAt: row.created_at as string,
  }

  revalidatePath(`/admin/gyms/${gymId}`)
  revalidatePath(`/admin/gyms/${gymId}/import`)
  return { ok: true, job }
}

export async function listImportJobsAction(gymId: string): Promise<ImportJobResult[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_list_import_jobs', { p_gym_id: gymId })
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    gymId: row.gym_id as string,
    status: row.status as ImportJobResult['status'],
    filename: (row.filename as string | null) ?? null,
    rowsTotal: Number(row.rows_total),
    rowsOk: Number(row.rows_ok),
    rowsErr: Number(row.rows_err),
    errors: (row.errors_json as ImportRowError[]) ?? [],
    createdAt: row.created_at as string,
  }))
}
