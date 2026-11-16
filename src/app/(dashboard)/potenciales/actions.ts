'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'
import type { ProspectStatus } from './types'

type ActionState = { error?: string; success?: string; id?: string; memberId?: string }

async function resolveGymId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('current_user_gyms')
  return data && data.length > 0 ? data[0].gym_id : null
}

const prospectBaseSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  email: z.string().trim().email('Email inválido').max(200).or(z.literal('')).optional(),
  phone: z.string().trim().max(30).or(z.literal('')).optional(),
  source: z.string().trim().max(80).or(z.literal('')).optional(),
  interest: z.string().trim().max(200).or(z.literal('')).optional(),
  notes: z.string().trim().max(2000).or(z.literal('')).optional(),
})

const createProspectSchema = prospectBaseSchema
const updateProspectSchema = prospectBaseSchema.extend({
  id: z.string().trim().uuid('ID inválido'),
})

function orNull(s: string | undefined | null): string | null {
  const t = (s ?? '').trim()
  return t.length > 0 ? t : null
}

export async function createProspectAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const parsed = createProspectSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const gymId = await resolveGymId()
  if (!gymId) return { error: 'No hay gym activo' }

  const { data, error } = await supabase
    .from('prospects')
    .insert({
      gym_id: gymId,
      name: parsed.data.name,
      email: orNull(parsed.data.email),
      phone: orNull(parsed.data.phone),
      source: orNull(parsed.data.source),
      interest: orNull(parsed.data.interest),
      notes: orNull(parsed.data.notes),
      status: 'new',
    })
    .select('id')
    .single()

  if (error || !data) {
    return { error: sanitizeServerError(error, 'Error creando potencial') }
  }
  revalidatePath('/potenciales')
  return { success: 'Potencial creado', id: data.id }
}

export async function updateProspectAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const parsed = updateProspectSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('prospects')
    .update({
      name: parsed.data.name,
      email: orNull(parsed.data.email),
      phone: orNull(parsed.data.phone),
      source: orNull(parsed.data.source),
      interest: orNull(parsed.data.interest),
      notes: orNull(parsed.data.notes),
    })
    .eq('id', parsed.data.id)

  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/potenciales')
  return { success: 'Actualizado' }
}

export async function moveProspectStatusAction(
  id: string,
  newStatus: ProspectStatus,
  lostReason?: string
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const parsed = z.string().trim().uuid('ID inválido').safeParse(id)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'ID requerido' }

  const supabase = await createClient()

  const payload: {
    status: ProspectStatus
    last_contact_at?: string
    lost_reason?: string | null
  } = { status: newStatus }

  if (newStatus === 'contacted' || newStatus === 'scheduled_visit') {
    payload.last_contact_at = new Date().toISOString()
  }
  if (newStatus === 'lost') {
    payload.lost_reason = (lostReason ?? '').trim().slice(0, 500) || null
  }
  if (newStatus !== 'lost') {
    payload.lost_reason = null
  }

  const { error } = await supabase.from('prospects').update(payload).eq('id', parsed.data)
  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/potenciales')
  return { success: 'Estado actualizado' }
}

export async function deleteProspectAction(id: string): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const parsed = z.string().trim().uuid('ID inválido').safeParse(id)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'ID requerido' }

  const supabase = await createClient()
  const { error } = await supabase.from('prospects').delete().eq('id', parsed.data)
  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/potenciales')
  return { success: 'Eliminado' }
}

const VALID_RGPD_SOURCES = [
  'paper_signed',
  'email_confirmed',
  'in_person_verbal_logged',
  'digital_signature',
] as const

type RgpdConsentSource = (typeof VALID_RGPD_SOURCES)[number]

const convertProspectSchema = z.object({
  prospectId: z.string().trim().uuid('ID prospect inválido'),
  tariffId: z.string().trim().uuid('Tarifa inválida').nullable(),
  rgpdConsentGranted: z.boolean().refine(
    (v) => v === true,
    'Debes confirmar consentimiento RGPD antes de convertir en socio.'
  ),
  rgpdConsentSource: z.string().refine(
    (v) => (VALID_RGPD_SOURCES as readonly string[]).includes(v),
    'Fuente de consentimiento inválida. Elige cómo se recabó (firmado en papel, email, verbal, firma digital).'
  ),
})

export async function convertProspectAction(
  prospectId: string,
  tariffId: string | null,
  rgpdConsentGranted: boolean,
  rgpdConsentSource: RgpdConsentSource | null
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const parsed = convertProspectSchema.safeParse({
    prospectId,
    tariffId,
    rgpdConsentGranted,
    rgpdConsentSource,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('convert_prospect_to_member', {
    p_prospect_id: parsed.data.prospectId,
    p_tariff_id: parsed.data.tariffId ?? undefined,
    p_rgpd_consent_granted: parsed.data.rgpdConsentGranted,
    p_rgpd_consent_source: parsed.data.rgpdConsentSource as RgpdConsentSource,
  })

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/potenciales')
  revalidatePath('/socios')
  return { success: 'Convertido en socio', memberId: data as string }
}
