'use server'

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sanitizeServerError } from '@/lib/errors'

export type ChallengeState = { error?: string }

export async function verifyChallengeAction(
  _prev: ChallengeState,
  formData: FormData
): Promise<ChallengeState> {
  const factorId = String(formData.get('factorId') ?? '').trim()
  const code = String(formData.get('code') ?? '').trim()

  if (!factorId) return { error: 'Factor MFA no encontrado' }
  if (!/^\d{6}$/.test(code)) return { error: 'El código debe tener 6 dígitos' }

  const rl = await rateLimit('auth')
  if (!rl.success) {
    return { error: `Demasiados intentos. Espera ${rl.retryAfter}s.` }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión no válida' }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
  if (error) {
    return { error: sanitizeServerError({ message: error.message }, 'Código inválido') }
  }

  revalidatePath('/', 'layout')
  redirect('/configuracion/cuenta')
}
