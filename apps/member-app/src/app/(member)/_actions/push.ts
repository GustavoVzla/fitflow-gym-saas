'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@fitflow/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'

type Result = { ok: true } | { ok: false; error: string }

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().max(500).optional().nullable(),
})

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
})

/**
 * Guarda PushSubscription del browser actual para entrega de notificaciones.
 * Idempotente: si ya existe (user_id+endpoint), actualiza last_seen_at.
 */
export async function subscribePushAction(formData: FormData): Promise<Result> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { ok: false, error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const parsed = subscribeSchema.safeParse({
    endpoint: formData.get('endpoint'),
    p256dh: formData.get('p256dh'),
    auth: formData.get('auth'),
    userAgent: formData.get('userAgent'),
  })
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sesión expirada' }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.p256dh,
        auth_secret: parsed.data.auth,
        user_agent: parsed.data.userAgent ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' }
    )

  if (error) {
    return {
      ok: false,
      error: sanitizeServerError(error, 'No se pudo guardar la suscripción a notificaciones.'),
    }
  }

  return { ok: true }
}

/**
 * Elimina la PushSubscription del browser actual (user dispara unsubscribe).
 */
export async function unsubscribePushAction(formData: FormData): Promise<Result> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { ok: false, error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const parsed = unsubscribeSchema.safeParse({ endpoint: formData.get('endpoint') })
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sesión expirada' }

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', parsed.data.endpoint)

  if (error) {
    return {
      ok: false,
      error: sanitizeServerError(error, 'No se pudo eliminar la suscripción.'),
    }
  }

  return { ok: true }
}
