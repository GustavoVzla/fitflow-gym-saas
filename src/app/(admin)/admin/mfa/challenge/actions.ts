'use server'

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export type ChallengeState = { error?: string }

export async function verifyChallengeAction(
  _prev: ChallengeState,
  formData: FormData
): Promise<ChallengeState> {
  const factorId = String(formData.get('factorId') ?? '').trim()
  const code = String(formData.get('code') ?? '').trim()
  const nextRaw = String(formData.get('next') ?? '/admin').trim()
  // Sanitiza next para evitar open redirect — solo rutas internas
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/admin'

  if (!factorId) return { error: 'Falta factorId (refresca la página).' }
  if (!/^\d{6}$/.test(code)) return { error: 'El código debe tener 6 dígitos.' }

  const rl = await rateLimit('auth')
  if (!rl.success) {
    return { error: `Demasiados intentos. Espera ${rl.retryAfter}s antes de reintentar.` }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión no válida.' }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
  if (error) {
    return { error: traducirError(error.message) }
  }

  revalidatePath('/', 'layout')
  redirect(next)
}

function traducirError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid') || m.includes('code')) return 'Código incorrecto. Verifica tu authenticator app.'
  if (m.includes('expired')) return 'Código expirado. Usa el nuevo código de tu authenticator app.'
  return msg
}
