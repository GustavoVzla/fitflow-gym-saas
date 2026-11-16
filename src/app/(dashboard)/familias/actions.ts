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
const CIF_NIF_RE = /^[A-Z0-9][0-9]{7}[A-Z0-9]$/i

const familyBaseSchema = z.object({
  name: z.string().trim().min(1, 'El nombre de la familia es obligatorio').max(200),
  primaryPayerId: z.string().trim().uuid('Pagador inválido').or(z.literal('')).optional(),
  billingEmail: z.string().trim().email('Email inválido').max(200).or(z.literal('')).optional(),
  billingPhone: z.string().trim().max(30).or(z.literal('')).optional(),
  billingTaxId: z
    .string()
    .trim()
    .refine((v) => v === '' || CIF_NIF_RE.test(v), 'CIF/NIF inválido')
    .or(z.literal(''))
    .optional(),
  billingAddress: z.string().trim().max(200).or(z.literal('')).optional(),
  billingCity: z.string().trim().max(100).or(z.literal('')).optional(),
  billingPostalCode: z.string().trim().max(10).or(z.literal('')).optional(),
  notes: z.string().trim().max(2000).or(z.literal('')).optional(),
})

const updateFamilySchema = familyBaseSchema.extend({
  id: z.string().trim().uuid('ID inválido'),
})

function orNull(s: string | undefined | null): string | null {
  const t = (s ?? '').trim()
  return t.length > 0 ? t : null
}

export async function createFamilyAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = familyBaseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const supabase = await createClient()
  const gymId = await resolveGymId()
  if (!gymId) return { error: 'No hay gym activo' }

  const { data, error } = await supabase
    .from('families')
    .insert({
      gym_id: gymId,
      name: parsed.data.name,
      primary_payer_member_id: orNull(parsed.data.primaryPayerId),
      billing_email: orNull(parsed.data.billingEmail),
      billing_phone: orNull(parsed.data.billingPhone),
      billing_tax_id: orNull(parsed.data.billingTaxId),
      billing_address: orNull(parsed.data.billingAddress),
      billing_city: orNull(parsed.data.billingCity),
      billing_postal_code: orNull(parsed.data.billingPostalCode),
      notes: orNull(parsed.data.notes),
    })
    .select('id')
    .single()

  if (error || !data) return { error: sanitizeServerError(error, 'Error creando familia') }

  revalidatePath('/familias')
  return { success: 'Familia creada', id: data.id }
}

export async function updateFamilyAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = updateFamilySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('families')
    .update({
      name: parsed.data.name,
      primary_payer_member_id: orNull(parsed.data.primaryPayerId),
      billing_email: orNull(parsed.data.billingEmail),
      billing_phone: orNull(parsed.data.billingPhone),
      billing_tax_id: orNull(parsed.data.billingTaxId),
      billing_address: orNull(parsed.data.billingAddress),
      billing_city: orNull(parsed.data.billingCity),
      billing_postal_code: orNull(parsed.data.billingPostalCode),
      notes: orNull(parsed.data.notes),
    })
    .eq('id', parsed.data.id)

  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/familias')
  return { success: 'Familia actualizada' }
}

export async function deleteFamilyAction(id: string): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase.from('families').delete().eq('id', parsed.data)
  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/familias')
  return { success: 'Familia eliminada' }
}

export async function addMemberToFamilyAction(
  familyId: string,
  memberId: string
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const fParsed = uuidSchema.safeParse(familyId)
  if (!fParsed.success) return { error: 'Familia inválida' }
  const mParsed = uuidSchema.safeParse(memberId)
  if (!mParsed.success) return { error: 'Socio inválido' }

  const supabase = await createClient()
  const gymId = await resolveGymId()
  if (!gymId) return { error: 'No hay gym activo' }

  const { error } = await supabase.from('family_members').upsert({
    member_id: mParsed.data,
    family_id: fParsed.data,
    gym_id: gymId,
  })

  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/familias')
  return { success: 'Miembro añadido' }
}

export async function removeMemberFromFamilyAction(memberId: string): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(memberId)
  if (!parsed.success) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase.from('family_members').delete().eq('member_id', parsed.data)
  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/familias')
  return { success: 'Miembro removido' }
}
