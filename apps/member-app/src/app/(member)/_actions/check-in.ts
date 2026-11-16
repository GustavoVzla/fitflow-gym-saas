'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@fitflow/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'

type Result = { ok: true } | { ok: false; error: string }

const startSchema = z.object({
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
})

/**
 * Trainer ficha inicio de jornada via RPC `instructor_check_in` (PB schema).
 * El RPC valida ownership (instructors.user_id = auth.uid()) y cierra
 * silenciosamente cualquier sesión abierta previa.
 */
export async function startCheckInAction(formData: FormData): Promise<Result> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { ok: false, error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const latRaw = formData.get('lat')
  const lngRaw = formData.get('lng')
  const parsed = startSchema.safeParse({
    lat: latRaw ? Number(latRaw) : null,
    lng: lngRaw ? Number(lngRaw) : null,
  })
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sesión expirada' }

  const { error } = await supabase.rpc('instructor_check_in', {
    p_location_lat: parsed.data.lat ?? undefined,
    p_location_lng: parsed.data.lng ?? undefined,
    p_source: 'pwa',
  })

  if (error) {
    return {
      ok: false,
      error: sanitizeServerError(error, 'No se pudo iniciar la jornada.'),
    }
  }

  revalidatePath('/inicio')
  revalidatePath('/cuenta')
  return { ok: true }
}

/**
 * Trainer cierra jornada via RPC `instructor_check_out` (PB schema).
 * El RPC valida ownership y cierra la sesión abierta del trainer actual.
 */
export async function endCheckInAction(): Promise<Result> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { ok: false, error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sesión expirada' }

  const { error } = await supabase.rpc('instructor_check_out')

  if (error) {
    return {
      ok: false,
      error: sanitizeServerError(error, 'No se pudo cerrar la jornada.'),
    }
  }

  revalidatePath('/inicio')
  revalidatePath('/cuenta')
  return { ok: true }
}
