'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type DismissResult = { ok: true } | { ok: false; error: string }

/**
 * Persists the "No volver a mostrar" choice to gym_onboarding_progress.
 * RPC dismiss_onboarding (migration 0024) upserts the row with dismissed_at=now().
 *
 * Auth: RLS restricts UPDATE/INSERT to gym owner/admin. The RPC itself runs
 * SECURITY INVOKER so the policy applies. If a non-admin member calls this,
 * the INSERT/UPDATE silently fails — we surface that to the UI.
 */
export async function dismissOnboardingAction(gymId: string): Promise<DismissResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('dismiss_onboarding', { p_gym_id: gymId })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/')
  return { ok: true }
}

export type OnboardingStepKey =
  | 'profile'
  | 'instructors'
  | 'tariffs'
  | 'classes'
  | 'instances'
  | 'members'

export type StepActionResult = { ok: true } | { ok: false; error: string }

/** Marks a step as "skipped" (doesn't apply to this gym, e.g. no instructors). */
export async function markStepSkippedAction(
  gymId: string,
  stepKey: OnboardingStepKey
): Promise<StepActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_step_skipped', {
    p_gym_id: gymId,
    p_step_key: stepKey,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/')
  return { ok: true }
}

/** Marks a step as completed manually (hecho fuera del sistema, sin data). */
export async function markStepCompletedManuallyAction(
  gymId: string,
  stepKey: OnboardingStepKey
): Promise<StepActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_step_completed_manually', {
    p_gym_id: gymId,
    p_step_key: stepKey,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/')
  return { ok: true }
}

/** Clears any override on a step, reverting to data-derived detection. */
export async function clearStepOverrideAction(
  gymId: string,
  stepKey: OnboardingStepKey
): Promise<StepActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('clear_step_override', {
    p_gym_id: gymId,
    p_step_key: stepKey,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/')
  return { ok: true }
}

export type ResetGuideResult = { ok: true } | { ok: false; error: string }

/**
 * Reverts the dismiss state — the onboarding checklist "Empieza aquí" will
 * appear again in the dashboard. RPC reset_onboarding_dismissed (migration 0026)
 * sets dismissed_at = NULL, leaving other derived state untouched.
 *
 * Auth: RLS UPDATE policy on gym_onboarding_progress restricts to owner/admin
 * of the gym. Staff/viewer will see 0 rows affected (silent fail).
 */
export async function resetOnboardingDismissedAction(
  gymId: string
): Promise<ResetGuideResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('reset_onboarding_dismissed', { p_gym_id: gymId })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/')
  revalidatePath('/configuracion')
  return { ok: true }
}
