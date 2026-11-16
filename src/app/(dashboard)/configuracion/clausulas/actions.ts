'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'
import { CLAUSE_PRESETS } from './types'

type ActionState = { error?: string; success?: string; id?: string }

async function resolveGymId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('current_user_gyms')
  return data && data.length > 0 ? data[0].gym_id : null
}

// ─── Schemas zod (SECURITY reminder paridad100) ─────────────────────

const CODE_RE = /^[A-Z0-9_]{2,40}$/

const createClauseSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => CODE_RE.test(v), 'Código inválido (2-40 caracteres A-Z 0-9 _)'),
  title: z.string().trim().min(1, 'Título requerido').max(200),
  body: z.string().trim().min(10, 'Cuerpo mínimo 10 caracteres').max(20000),
  is_required: z.boolean(),
  sort_order: z.number().int().min(0).max(999).default(0),
})

const updateClauseSchema = createClauseSchema.extend({
  id: z.string().uuid(),
})

// ─── Actions ─────────────────────────────────────────────────────────

export async function createClauseAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const raw = {
    code: String(formData.get('code') ?? ''),
    title: String(formData.get('title') ?? ''),
    body: String(formData.get('body') ?? ''),
    is_required: formData.get('isRequired') === 'on' || formData.get('isRequired') === 'true',
    sort_order: Number(formData.get('sortOrder') ?? 0),
  }

  const parsed = createClauseSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const gymId = await resolveGymId()
  if (!gymId) return { error: 'No hay gym activo' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('gym_clause_templates')
    .insert({
      gym_id: gymId,
      code: parsed.data.code,
      title: parsed.data.title,
      body: parsed.data.body,
      is_required: parsed.data.is_required,
      is_active: true,
      sort_order: parsed.data.sort_order,
      created_by: user?.id ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { error: sanitizeServerError(error, 'No se pudo crear la cláusula') }
  }

  revalidatePath('/configuracion/clausulas')
  return { success: 'Cláusula creada', id: data.id }
}

export async function updateClauseAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const raw = {
    id: String(formData.get('id') ?? ''),
    code: String(formData.get('code') ?? ''),
    title: String(formData.get('title') ?? ''),
    body: String(formData.get('body') ?? ''),
    is_required: formData.get('isRequired') === 'on' || formData.get('isRequired') === 'true',
    sort_order: Number(formData.get('sortOrder') ?? 0),
  }

  const parsed = updateClauseSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('gym_clause_templates')
    .update({
      code: parsed.data.code,
      title: parsed.data.title,
      body: parsed.data.body,
      is_required: parsed.data.is_required,
      sort_order: parsed.data.sort_order,
    })
    .eq('id', parsed.data.id)

  if (error) {
    return { error: sanitizeServerError(error, 'No se pudo actualizar la cláusula') }
  }

  revalidatePath('/configuracion/clausulas')
  return { success: 'Cláusula actualizada' }
}

export async function toggleClauseActiveAction(
  id: string,
  isActive: boolean
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  if (!z.string().uuid().safeParse(id).success) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('gym_clause_templates')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/configuracion/clausulas')
  return { success: isActive ? 'Cláusula activada' : 'Cláusula desactivada' }
}

export async function deleteClauseAction(id: string): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  if (!z.string().uuid().safeParse(id).success) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase.from('gym_clause_templates').delete().eq('id', id)

  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/configuracion/clausulas')
  return { success: 'Cláusula eliminada' }
}

export async function seedDefaultClausesAction(): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const gymId = await resolveGymId()
  if (!gymId) return { error: 'No hay gym activo' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: existing } = await supabase
    .from('gym_clause_templates')
    .select('code')
    .eq('gym_id', gymId)
    .in(
      'code',
      CLAUSE_PRESETS.map((p) => p.code)
    )

  const existingCodes = new Set((existing ?? []).map((e) => e.code))
  const toInsert = CLAUSE_PRESETS.filter((p) => !existingCodes.has(p.code)).map(
    (p, idx) => ({
      gym_id: gymId,
      code: p.code,
      title: p.title,
      body: p.body,
      is_required: p.is_required,
      is_active: true,
      sort_order: idx * 10,
      created_by: user?.id ?? null,
    })
  )

  if (toInsert.length === 0) {
    return { success: 'Todas las cláusulas plantilla ya existían' }
  }

  const { error } = await supabase.from('gym_clause_templates').insert(toInsert)
  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/configuracion/clausulas')
  return { success: `${toInsert.length} cláusulas plantilla añadidas` }
}
