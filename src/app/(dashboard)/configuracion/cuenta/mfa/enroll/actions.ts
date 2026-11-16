'use server'

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sanitizeServerError } from '@/lib/errors'

export type EnrollState = { error?: string; success?: string }

export async function verifyEnrollAction(
  _prev: EnrollState,
  formData: FormData
): Promise<EnrollState> {
  const factorId = String(formData.get('factorId') ?? '').trim()
  const code = String(formData.get('code') ?? '').trim()

  if (!factorId) return { error: 'Falta factorId (refresca la página).' }
  if (!/^\d{6}$/.test(code)) return { error: 'El código debe tener 6 dígitos.' }

  const rl = await rateLimit('auth')
  if (!rl.success) {
    return { error: `Demasiados intentos. Espera ${rl.retryAfter}s antes de reintentar.` }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión no válida.' }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
  if (error) {
    // Clean up factor no verificado para permitir reintento
    await supabase.auth.mfa.unenroll({ factorId })
    return { error: traducirError(error.message) }
  }

  revalidatePath('/', 'layout')
  redirect('/configuracion/cuenta')
}

export async function cancelEnrollAction(factorId: string) {
  if (!factorId) return
  const supabase = await createClient()
  await supabase.auth.mfa.unenroll({ factorId })
  redirect('/configuracion/cuenta/mfa/enroll')
}

function traducirError(msg: string): string {
  const safe = sanitizeServerError({ message: msg })
  const m = msg.toLowerCase()
  if (m.includes('invalid') || m.includes('code'))
    return 'Código incorrecto. Verifica tu authenticator app.'
  if (m.includes('expired'))
    return 'Código expirado. Usa el nuevo código de tu authenticator app.'
  return safe
}
