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

const uuidSchema = z.string().trim().uuid('ID inválido')
const hexColorSchema = z.string().trim().regex(/^#[0-9a-f]{6}$/i, 'Color hex inválido')

const groupBaseSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  description: z.string().trim().max(2000).or(z.literal('')).optional(),
  defaultClassId: z.string().trim().uuid('Clase inválida').or(z.literal('')).optional(),
  color: hexColorSchema,
})

const updateGroupSchema = groupBaseSchema.extend({
  id: z.string().trim().uuid('ID inválido'),
})

function orNull(s: string | undefined | null): string | null {
  const t = (s ?? '').trim()
  return t.length > 0 ? t : null
}

export async function createGroupAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = groupBaseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const supabase = await createClient()
  const gymId = await resolveGymId()
  if (!gymId) return { error: 'No hay gym activo' }

  const { data, error } = await supabase
    .from('training_groups')
    .insert({
      gym_id: gymId,
      name: parsed.data.name,
      description: orNull(parsed.data.description),
      default_class_id: orNull(parsed.data.defaultClassId),
      color: parsed.data.color,
      is_active: true,
    })
    .select('id')
    .single()

  if (error || !data) return { error: sanitizeServerError(error, 'Error creando grupo') }
  revalidatePath('/grupos-entreno')
  return { success: 'Grupo creado', id: data.id }
}

export async function updateGroupAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = updateGroupSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('training_groups')
    .update({
      name: parsed.data.name,
      description: orNull(parsed.data.description),
      default_class_id: orNull(parsed.data.defaultClassId),
      color: parsed.data.color,
    })
    .eq('id', parsed.data.id)

  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/grupos-entreno')
  return { success: 'Grupo actualizado' }
}

export async function toggleGroupAction(id: string, isActive: boolean): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('training_groups')
    .update({ is_active: isActive })
    .eq('id', parsed.data)
  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/grupos-entreno')
  return { success: isActive ? 'Grupo activado' : 'Grupo desactivado' }
}

export async function deleteGroupAction(id: string): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase.from('training_groups').delete().eq('id', parsed.data)
  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/grupos-entreno')
  return { success: 'Grupo eliminado' }
}

export async function addMemberToGroupAction(
  groupId: string,
  memberId: string
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const gParsed = uuidSchema.safeParse(groupId)
  if (!gParsed.success) return { error: 'Grupo inválido' }
  const mParsed = uuidSchema.safeParse(memberId)
  if (!mParsed.success) return { error: 'Socio inválido' }

  const supabase = await createClient()
  const gymId = await resolveGymId()
  if (!gymId) return { error: 'No hay gym activo' }

  const { error } = await supabase
    .from('training_group_members')
    .upsert({ member_id: mParsed.data, group_id: gParsed.data, gym_id: gymId })

  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/grupos-entreno')
  return { success: 'Miembro añadido' }
}

export async function removeMemberFromGroupAction(
  groupId: string,
  memberId: string
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const gParsed = uuidSchema.safeParse(groupId)
  if (!gParsed.success) return { error: 'Grupo inválido' }
  const mParsed = uuidSchema.safeParse(memberId)
  if (!mParsed.success) return { error: 'Socio inválido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('training_group_members')
    .delete()
    .eq('group_id', gParsed.data)
    .eq('member_id', mParsed.data)

  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/grupos-entreno')
  return { success: 'Miembro removido' }
}
