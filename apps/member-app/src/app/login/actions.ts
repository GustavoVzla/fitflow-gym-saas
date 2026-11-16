'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/config'
import { rateLimit } from '@fitflow/lib/ratelimit'

const schema = z.object({
  email: z.string().email('Correo no válido'),
  redirectTo: z.string().default('/inicio'),
})

const passwordSchema = z.object({
  email: z.string().email('Correo no válido'),
  password: z.string().min(8, 'Contraseña requerida'),
  redirectTo: z.string().default('/inicio'),
})

type Result = { error?: string; message?: string }
type PasswordResult = { error?: string }

/**
 * Login primary: email + password.
 * Anti-enumeration: misma respuesta para email no existe vs password incorrecto.
 * Si OK, redirect server-side a /inicio (next() del middleware lo enrutará).
 */
export async function signInWithPasswordAction(
  formData: FormData
): Promise<PasswordResult> {
  const parsed = passwordSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    redirectTo: formData.get('redirectTo') ?? '/inicio',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const rl = await rateLimit('auth')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { error: 'Correo o contraseña incorrectos' }
  }

  redirect(parsed.data.redirectTo)
}

/**
 * Anti-enumeration estricto (OWASP API Security Top 10):
 * SIEMPRE devolvemos el mismo `message`, sea email válido o no.
 * Si error real (rate limit Supabase, signup disabled, etc.) → log server-side
 * pero respuesta al cliente idéntica a éxito. Socio legítimo recibe email;
 * email no registrado no recibe nada — usuario contacta al gym si no llega.
 */
export async function sendMagicLinkAction(formData: FormData): Promise<Result> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    redirectTo: formData.get('redirectTo') ?? '/inicio',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { email, redirectTo } = parsed.data

  const rl = await rateLimit('auth')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // No crear users nuevos: solo socios pre-invitados por panel admin (internal ticket).
      shouldCreateUser: false,
      emailRedirectTo: `${getAppUrl()}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
    },
  })

  if (error) {
    console.error('[login] magic link error', error.message)
  }

  return {
    message:
      'Si el correo está dado de alta, te hemos enviado un enlace de acceso. Revisa tu correo (puede tardar 1-2 minutos).',
  }
}
