'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'

type ActionState = { error?: string; success?: string; id?: string }

async function resolveGymId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('current_user_gyms')
  return data && data.length > 0 ? data[0].gym_id : null
}

const FIELD_NAME_RE = /^[a-z][a-z0-9_]{0,40}$/

const fieldSchema = z.object({
  form_scope: z.enum(['member_signup', 'prospect_signup']),
  field_name: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => FIELD_NAME_RE.test(v), 'Nombre inválido (minúsculas, 1-41 chars, sin espacios)'),
  field_label: z.string().trim().min(1, 'Etiqueta requerida').max(120),
  field_type: z.enum(['text', 'number', 'select', 'checkbox', 'textarea', 'date']),
  options: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  placeholder: z.string().trim().max(200).optional().or(z.literal('')),
  help_text: z.string().trim().max(500).optional().or(z.literal('')),
  is_required: z.boolean(),
  sort_order: z.number().int().min(0).max(999),
})

const updateSchema = fieldSchema.extend({ id: z.string().uuid() })

export async function createFieldAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const optionsRaw = String(formData.get('options') ?? '').trim()
  const options = optionsRaw
    ? optionsRaw
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  const raw = {
    form_scope: String(formData.get('form_scope') ?? ''),
    field_name: String(formData.get('field_name') ?? ''),
    field_label: String(formData.get('field_label') ?? ''),
    field_type: String(formData.get('field_type') ?? ''),
    options,
    placeholder: String(formData.get('placeholder') ?? ''),
    help_text: String(formData.get('help_text') ?? ''),
    is_required: formData.get('is_required') === 'on' || formData.get('is_required') === 'true',
    sort_order: Number(formData.get('sort_order') ?? 0),
  }

  const parsed = fieldSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  // Si tipo=select, options no vacío
  if (parsed.data.field_type === 'select' && parsed.data.options.length === 0) {
    return { error: 'Un desplegable necesita al menos 1 opción' }
  }

  const gymId = await resolveGymId()
  if (!gymId) return { error: 'No hay gym activo' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('gym_form_fields')
    .insert({
      gym_id: gymId,
      form_scope: parsed.data.form_scope,
      field_name: parsed.data.field_name,
      field_label: parsed.data.field_label,
      field_type: parsed.data.field_type,
      options: parsed.data.options,
      placeholder: parsed.data.placeholder || null,
      help_text: parsed.data.help_text || null,
      is_required: parsed.data.is_required,
      is_active: true,
      sort_order: parsed.data.sort_order,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { error: sanitizeServerError(error, 'No se pudo crear el campo') }
  }

  revalidatePath('/configuracion/formularios')
  return { success: 'Campo creado', id: data.id }
}

export async function updateFieldAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const optionsRaw = String(formData.get('options') ?? '').trim()
  const options = optionsRaw
    ? optionsRaw
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  const raw = {
    id: String(formData.get('id') ?? ''),
    form_scope: String(formData.get('form_scope') ?? ''),
    field_name: String(formData.get('field_name') ?? ''),
    field_label: String(formData.get('field_label') ?? ''),
    field_type: String(formData.get('field_type') ?? ''),
    options,
    placeholder: String(formData.get('placeholder') ?? ''),
    help_text: String(formData.get('help_text') ?? ''),
    is_required: formData.get('is_required') === 'on' || formData.get('is_required') === 'true',
    sort_order: Number(formData.get('sort_order') ?? 0),
  }

  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  if (parsed.data.field_type === 'select' && parsed.data.options.length === 0) {
    return { error: 'Un desplegable necesita al menos 1 opción' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('gym_form_fields')
    .update({
      form_scope: parsed.data.form_scope,
      field_name: parsed.data.field_name,
      field_label: parsed.data.field_label,
      field_type: parsed.data.field_type,
      options: parsed.data.options,
      placeholder: parsed.data.placeholder || null,
      help_text: parsed.data.help_text || null,
      is_required: parsed.data.is_required,
      sort_order: parsed.data.sort_order,
    })
    .eq('id', parsed.data.id)

  if (error) return { error: sanitizeServerError(error, 'No se pudo actualizar el campo') }

  revalidatePath('/configuracion/formularios')
  return { success: 'Campo actualizado' }
}

export async function toggleFieldActiveAction(
  id: string,
  isActive: boolean
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  if (!z.string().uuid().safeParse(id).success) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('gym_form_fields')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/configuracion/formularios')
  return { success: isActive ? 'Campo activado' : 'Campo desactivado' }
}

export async function deleteFieldAction(id: string): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  if (!z.string().uuid().safeParse(id).success) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase.from('gym_form_fields').delete().eq('id', id)

  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/configuracion/formularios')
  return { success: 'Campo eliminado' }
}
