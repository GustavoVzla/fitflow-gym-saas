'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'

type ActionState = { error?: string; success?: string }

const contactSchema = z.object({
  email: z.string().trim().email('Email inválido').max(320),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  full_name: z.string().trim().min(1, 'Nombre requerido').max(120),
})

const changePasswordSchema = z
  .object({
    new_password: z.string().min(8, 'Mínimo 8 caracteres').max(128),
    confirm_password: z.string().min(8).max(128),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm_password'],
  })

export async function updateOwnerContactAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const raw = {
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    full_name: String(formData.get('full_name') ?? ''),
  }

  const parsed = contactSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión no válida' }

  const updates: Record<string, unknown> = {
    data: {
      ...(user.user_metadata ?? {}),
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
    },
  }

  if (parsed.data.email.toLowerCase() !== (user.email ?? '').toLowerCase()) {
    updates.email = parsed.data.email
  }

  const { error } = await supabase.auth.updateUser(updates)
  if (error)
    return { error: sanitizeServerError(error, 'No se pudo actualizar la cuenta') }

  revalidatePath('/configuracion/cuenta')
  const emailChanged = updates.email !== undefined
  return {
    success: emailChanged
      ? 'Datos guardados. Revisa tu email para confirmar el cambio de dirección.'
      : 'Datos de cuenta actualizados',
  }
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const rl = await rateLimit('auth')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const raw = {
    new_password: String(formData.get('new_password') ?? ''),
    confirm_password: String(formData.get('confirm_password') ?? ''),
  }

  const parsed = changePasswordSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesión no válida' }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.new_password })
  if (error)
    return { error: sanitizeServerError(error, 'No se pudo cambiar la contraseña') }

  revalidatePath('/configuracion/cuenta')
  return {
    success: 'Contraseña actualizada. Usa la nueva la próxima vez que inicies sesión.',
  }
}
