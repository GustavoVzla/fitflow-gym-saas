'use server'

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'
import { redirect } from 'next/navigation'

export type ChangePasswordState = { error?: string; success?: string }

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')

  if (password.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres' }
  if (password !== confirmPassword) return { error: 'Las contraseñas no coinciden' }

  const rl = await rateLimit('auth')
  if (!rl.success) {
    return { error: `Demasiados intentos. Espera ${rl.retryAfter}s antes de reintentar.` }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión no válida' }

  const { error: updateErr } = await supabase.auth.updateUser({ password })
  if (updateErr) return { error: updateErr.message }

  const { error: rpcErr } = await supabase.rpc('clear_must_change_password')
  if (rpcErr) return { error: rpcErr.message }

  redirect('/')
}
