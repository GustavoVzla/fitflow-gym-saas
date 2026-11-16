'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'
import { DB_STATUS_MAP, type MemberStatus } from './data'

export type MemberActionState = {
  error?: string
  success?: string
}

async function resolveActiveGymId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('current_user_gyms')
  return data && data.length > 0 ? data[0].gym_id : null
}

// Utilidad: partir el fullName en first_name + last_name
function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { first_name: parts[0], last_name: '-' }
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') }
}

const VALID_RGPD_SOURCES = [
  'paper_signed',
  'email_confirmed',
  'in_person_verbal_logged',
  'digital_signature',
] as const

const emailOrEmpty = z.string().trim().email('Email inválido').max(200).or(z.literal(''))
const phoneOrEmpty = z.string().trim().max(30).or(z.literal(''))
const uuidOrEmpty = z.string().trim().uuid('Identificador inválido').or(z.literal(''))

const createMemberSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  email: emailOrEmpty.optional(),
  phone: phoneOrEmpty.optional(),
  tariffId: uuidOrEmpty.optional(),
  paymentMethod: z.string().trim().max(40).optional(),
  rgpdConsent: z.string().refine(
    (v) => v === 'on' || v === 'true',
    'Debes confirmar que el socio ha otorgado consentimiento RGPD.'
  ),
  rgpdConsentSource: z.string().refine(
    (v) => (VALID_RGPD_SOURCES as readonly string[]).includes(v),
    'Fuente de consentimiento inválida. Elige cómo se recabó (firmado en papel, email, verbal, firma digital).'
  ),
})

const updateMemberSchema = z.object({
  id: z.string().trim().uuid('ID de socio inválido'),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  email: emailOrEmpty.optional(),
  phone: phoneOrEmpty.optional(),
  tariffId: uuidOrEmpty.optional(),
})

export async function createMemberAction(
  _prev: MemberActionState,
  formData: FormData
): Promise<MemberActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const parsed = createMemberSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo en la sesión' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { first_name, last_name } = splitName(parsed.data.name)
  const email = parsed.data.email?.trim() ? parsed.data.email.trim() : null
  const phone = parsed.data.phone?.trim() ? parsed.data.phone.trim() : null
  const tariffId = parsed.data.tariffId?.trim() ? parsed.data.tariffId.trim() : null

  const { error } = await supabase.from('members').insert({
    gym_id: gymId,
    first_name,
    last_name,
    email,
    phone,
    current_tariff_id: tariffId,
    status: 'active',
    rgpd_consent: true,
    rgpd_consent_at: new Date().toISOString(),
    rgpd_consent_source: parsed.data.rgpdConsentSource as (typeof VALID_RGPD_SOURCES)[number],
    rgpd_consent_operator_user_id: user?.id ?? null,
  })

  if (error) {
    if (error.code === '23505') return { error: 'Ya existe un socio con ese email' }
    return { error: sanitizeServerError(error) }
  }

  // paymentMethod se guarda en notas por ahora (no hay columna dedicada)
  void parsed.data.paymentMethod

  revalidatePath('/socios')
  return { success: 'Socio creado correctamente' }
}

export async function updateMemberAction(
  _prev: MemberActionState,
  formData: FormData
): Promise<MemberActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const parsed = updateMemberSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const { first_name, last_name } = splitName(parsed.data.name)
  const email = parsed.data.email?.trim() ? parsed.data.email.trim() : null
  const phone = parsed.data.phone?.trim() ? parsed.data.phone.trim() : null
  const tariffId = parsed.data.tariffId?.trim() ? parsed.data.tariffId.trim() : null

  const { error } = await supabase
    .from('members')
    .update({
      first_name,
      last_name,
      email,
      phone,
      current_tariff_id: tariffId,
    })
    .eq('id', parsed.data.id)

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/socios')
  return { success: 'Socio actualizado' }
}

export async function changeMemberStatusAction(
  id: string,
  status: MemberStatus
): Promise<MemberActionState> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('members')
    .update({ status: DB_STATUS_MAP[status] })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/socios')
  return { success: 'Estado actualizado' }
}

export async function deleteMemberAction(
  id: string
): Promise<MemberActionState> {
  // Soft delete: status='inactive' + leave_date=hoy (NO borramos por RGPD/histórico)
  const supabase = await createClient()
  const { error } = await supabase
    .from('members')
    .update({
      status: 'inactive',
      leave_date: new Date().toISOString().slice(0, 10),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/socios')
  return { success: 'Socio dado de baja' }
}

/**
 * Fase 1C: invita al socio a crear cuenta FitFlow /mi-cuenta.
 * Usa Supabase Auth admin API (signInWithOtp con redirectTo custom).
 *
 * NOTA: Supabase Auth admin.inviteUserByEmail requiere service_role key,
 * que solo esta disponible server-side con SUPABASE_SERVICE_ROLE_KEY.
 */
export async function inviteMemberAction(memberId: string): Promise<MemberActionState> {
  const supabase = await createClient()

  // Verificar que el user actual es owner/admin del gym del socio
  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo en la sesion' }

  const { data: member } = await supabase
    .from('members')
    .select('id, email, first_name, last_name, gym_id, auth_user_id, invite_count')
    .eq('id', memberId)
    .maybeSingle()

  if (!member) return { error: 'Socio no encontrado' }
  if (member.gym_id !== gymId) return { error: 'El socio no pertenece a tu gym' }
  if (!member.email) return { error: 'El socio no tiene email registrado' }
  if (member.auth_user_id) {
    return { error: 'El socio ya tiene cuenta FitFlow activa' }
  }

  // Rate limiting suave: max 3 re-invitaciones por socio
  if ((member.invite_count ?? 0) >= 3) {
    return { error: 'Ya se enviaron 3 invitaciones. Contacta al socio directamente.' }
  }

  // Usar magic link OTP estandar (no requiere service_role)
  // Canonical post-D-PM2: panel.example.com. Compat app.* dual 7d.
  const host =
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://panel.example.com'
  const redirectTo = `${host}/mi-cuenta/welcome?memberId=${member.id}`

  const { error } = await supabase.auth.signInWithOtp({
    email: member.email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
      data: {
        fitflow_member_id: member.id,
        fitflow_gym_id: member.gym_id,
      },
    },
  })

  if (error) return { error: error.message }

  // Tracking: mark invite_sent_at + invite_count++ (idempotente vía RPC)
  const { error: markErr } = await supabase.rpc('mark_member_invited', { p_member_id: memberId })
  if (markErr) {
    // Email ya enviado, solo falla tracking → warning, no bloqueante
    console.error('[inviteMember] mark_member_invited failed:', markErr.message)
  }

  revalidatePath('/socios')
  return { success: `Invitacion enviada a ${member.email}` }
}

/**
 * Bulk invite: invita a N socios en un solo request.
 * Reporta total enviado / errores / saltados (ya tienen cuenta o sin email).
 */
export type BulkInviteResult = {
  sent: number
  skipped: number
  errors: Array<{ memberId: string; reason: string }>
  total: number
}

export async function inviteMembersBulkAction(memberIds: string[]): Promise<BulkInviteResult> {
  const result: BulkInviteResult = { sent: 0, skipped: 0, errors: [], total: memberIds.length }

  for (const memberId of memberIds) {
    const res = await inviteMemberAction(memberId)
    if (res.success) {
      result.sent++
    } else if (res.error?.includes('ya tiene cuenta') || res.error?.includes('sin email') || res.error?.includes('3 invitaciones')) {
      result.skipped++
    } else {
      result.errors.push({ memberId, reason: res.error ?? 'Desconocido' })
    }
  }

  revalidatePath('/socios')
  return result
}

/**
 * Invite todos los socios del gym actual que NO tengan auth_user_id aún.
 * Límite 50 por request para no saturar el SMTP relay.
 */
export async function inviteAllPendingMembersAction(): Promise<BulkInviteResult> {
  const supabase = await createClient()
  const gymId = await resolveActiveGymId()
  if (!gymId) {
    return { sent: 0, skipped: 0, errors: [{ memberId: '', reason: 'No hay gym activo' }], total: 0 }
  }

  const { data: pendingMembers } = await supabase
    .from('members')
    .select('id')
    .eq('gym_id', gymId)
    .is('auth_user_id', null)
    .not('email', 'is', null)
    .lt('invite_count', 3)
    .limit(50)

  const ids = (pendingMembers ?? []).map((m) => m.id)
  return inviteMembersBulkAction(ids)
}
