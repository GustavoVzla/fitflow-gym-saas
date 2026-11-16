'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

export type GymPlan = 'base' | 'smart' | 'pro' | 'premium' | 'app_pro' | 'enterprise'
export type PaymentMode = 'manual' | 'direct_keys' | 'connect_express' | 'connect_standard' | 'managed'

function randomPassword(length = 14): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

function siteOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  return 'http://localhost:3000'
}

// ============================================================================
// Gym mutations
// ============================================================================

interface UpdateGymInput {
  gymId: string
  name?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  postalCode?: string
  country?: string
  taxId?: string
  website?: string
  timezone?: string
  currency?: string
}

export async function updateGymAction(input: UpdateGymInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_update_gym', {
    p_gym_id: input.gymId,
    p_name: input.name,
    p_email: input.email,
    p_phone: input.phone,
    p_address: input.address,
    p_city: input.city,
    p_postal_code: input.postalCode,
    p_country: input.country,
    p_tax_id: input.taxId,
    p_website: input.website,
    p_timezone: input.timezone,
    p_currency: input.currency,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/admin/gyms/${input.gymId}`)
  return { ok: true }
}

export async function changeGymPlanAction(gymId: string, newPlan: GymPlan): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_change_gym_plan', {
    p_gym_id: gymId,
    p_new_plan: newPlan,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/admin/gyms/${gymId}`)
  return { ok: true }
}

export async function changeGymPaymentModeAction(
  gymId: string,
  newMode: PaymentMode
): Promise<ActionResult> {
  if (newMode !== 'manual' && newMode !== 'direct_keys') {
    return { ok: false, error: 'Modo no disponible aún (fases 2-4 pendientes)' }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_change_gym_payment_mode', {
    p_gym_id: gymId,
    p_new_mode: newMode,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/admin/gyms/${gymId}`)
  return { ok: true }
}

export async function suspendGymAction(gymId: string, reason: string): Promise<ActionResult> {
  if (!reason || reason.trim().length < 3) {
    return { ok: false, error: 'Motivo requerido (mínimo 3 caracteres)' }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_suspend_gym', {
    p_gym_id: gymId,
    p_reason: reason.trim(),
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/admin/gyms/${gymId}`)
  return { ok: true }
}

export async function reactivateGymAction(gymId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_reactivate_gym', { p_gym_id: gymId })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/admin/gyms/${gymId}`)
  return { ok: true }
}

export async function softDeleteGymAction(
  gymId: string,
  reason: string | null,
  confirmName: string,
  gymName: string
): Promise<ActionResult> {
  if (confirmName !== gymName) {
    return { ok: false, error: 'El nombre de confirmación no coincide' }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_soft_delete_gym', {
    p_gym_id: gymId,
    p_reason: reason?.trim() || undefined,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/gyms')
  revalidatePath(`/admin/gyms/${gymId}`)
  return { ok: true }
}

export async function restoreGymAction(gymId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_restore_gym', { p_gym_id: gymId })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/gyms')
  revalidatePath(`/admin/gyms/${gymId}`)
  return { ok: true }
}

// ============================================================================
// User management
// ============================================================================

export type ResetPasswordResult =
  | { ok: true; mode: 'temporary'; tempPassword: string; loginUrl: string; email: string }
  | { ok: true; mode: 'magic_link'; email: string }
  | { ok: false; error: string }

export async function resetUserPasswordAction(
  userId: string,
  mode: 'temporary' | 'magic_link',
  gymId: string
): Promise<ResetPasswordResult> {
  const supabase = await createClient()

  if (mode === 'temporary') {
    const tempPassword = randomPassword(14)
    const { error } = await supabase.rpc('admin_reset_user_password_temporary', {
      p_user_id: userId,
      p_new_password: tempPassword,
    })
    if (error) return { ok: false, error: error.message }

    // Lookup email for display (via audit log we already logged, but need it in UI)
    const { data: userData, error: lookupErr } = await supabase
      .rpc('admin_list_gym_users', { p_gym_id: gymId })
    if (lookupErr) return { ok: false, error: lookupErr.message }
    const user = userData?.find((u) => u.user_id === userId)

    revalidatePath(`/admin/gyms/${gymId}`)
    return {
      ok: true,
      mode: 'temporary',
      tempPassword,
      loginUrl: `${siteOrigin()}/login`,
      email: user?.email ?? '',
    }
  }

  // magic_link: requires service role to call auth.admin.generateLink
  try {
    const service = createServiceRoleClient()

    // Lookup email (service role bypasses RLS, but we use the admin RPC for consistency)
    const { data: userData, error: lookupErr } = await supabase.rpc('admin_list_gym_users', {
      p_gym_id: gymId,
    })
    if (lookupErr) return { ok: false, error: lookupErr.message }
    const user = userData?.find((u) => u.user_id === userId)
    if (!user?.email) return { ok: false, error: 'Usuario sin email' }

    const { data: linkData, error: linkErr } = await service.auth.admin.generateLink({
      type: 'recovery',
      email: user.email,
      options: { redirectTo: `${siteOrigin()}/auth/callback?next=/configuracion/cuenta` },
    })
    if (linkErr) return { ok: false, error: linkErr.message }

    // NOTE: Supabase generateLink with type:'recovery' sends the email automatically
    // via the configured SMTP (Workspace SMTP Relay). No need to send it manually here.
    // The linkData.properties.action_link is returned for debugging / fallback display.

    // Log audit
    await supabase.rpc('admin_log_magic_link_sent', { p_user_id: userId, p_gym_id: gymId })

    revalidatePath(`/admin/gyms/${gymId}`)
    return { ok: true, mode: 'magic_link', email: user.email }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error generando magic link' }
  }
}

export async function removeGymUserAction(gymUserId: string, gymId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_remove_gym_user', { p_gym_user_id: gymUserId })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/admin/gyms/${gymId}`)
  return { ok: true }
}

export async function transferOwnershipAction(
  gymId: string,
  newOwnerUserId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_transfer_gym_ownership', {
    p_gym_id: gymId,
    p_new_owner_user_id: newOwnerUserId,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/admin/gyms/${gymId}`)
  return { ok: true }
}
