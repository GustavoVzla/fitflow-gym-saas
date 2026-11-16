'use server'

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export type AuthState = {
  error?: string
  success?: string
}

export async function loginAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const redirectTo = String(formData.get('redirect') ?? '/')

  if (!email || !password) {
    return { error: 'Email y contraseña son obligatorios' }
  }

  const rl = await rateLimit('auth')
  if (!rl.success) {
    return {
      error: `Demasiados intentos. Espera ${rl.retryAfter}s antes de reintentar.`,
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: traducirError(error.message) }
  }

  revalidatePath('/', 'layout')
  redirect(redirectTo || '/')
}

export async function signupAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const gymName = String(formData.get('gymName') ?? '').trim()
  const gymSlug = String(formData.get('gymSlug') ?? '').trim().toLowerCase()

  // Validaciones básicas
  if (!email || !password || !gymName || !gymSlug) {
    return { error: 'Todos los campos son obligatorios' }
  }
  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres' }
  }
  if (!/^[a-z0-9-]{3,50}$/.test(gymSlug)) {
    return {
      error:
        'El identificador debe tener 3-50 caracteres (solo minúsculas, números y guiones)',
    }
  }

  const rl = await rateLimit('auth')
  if (!rl.success) {
    return {
      error: `Demasiados intentos. Espera ${rl.retryAfter}s antes de reintentar.`,
    }
  }

  const supabase = await createClient()

  // 1. Crear user en Supabase Auth
  const { data: signupData, error: signupError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { gym_name: gymName, gym_slug: gymSlug },
    },
  })

  if (signupError) {
    return { error: traducirError(signupError.message) }
  }

  // 2. Si hay sesión activa (email confirm desactivado), creamos el gym
  if (signupData.session) {
    const { error: rpcError } = await supabase.rpc('create_gym_with_owner', {
      p_name: gymName,
      p_slug: gymSlug,
      p_email: email,
    })

    if (rpcError) {
      return { error: `Error al crear el gym: ${rpcError.message}` }
    }

    revalidatePath('/', 'layout')
    redirect('/')
  }

  // 3. Si no hay sesión, email confirm está activo → mostrar mensaje
  return {
    success:
      'Cuenta creada. Revisa tu email para confirmar la cuenta y completar el alta del gym.',
  }
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

// Traducir errores comunes de Supabase Auth al español
function traducirError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos'
  if (m.includes('email not confirmed')) return 'Debes confirmar tu email antes de iniciar sesión'
  if (m.includes('user already registered')) return 'Ya existe una cuenta con ese email'
  if (m.includes('password should be at least')) return 'La contraseña es demasiado corta'
  if (m.includes('rate limit')) return 'Demasiados intentos. Espera unos minutos'
  return msg
}
