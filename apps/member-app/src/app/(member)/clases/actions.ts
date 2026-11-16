'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@fitflow/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'

type Result = { ok: boolean; error?: string; bookingId?: string; status?: string }

const bookSchema = z.object({
  instanceId: z.string().uuid(),
})

const cancelSchema = z.object({
  bookingId: z.string().uuid(),
})

export async function bookClassAction(formData: FormData): Promise<Result> {
  const parsed = bookSchema.safeParse({ instanceId: formData.get('instanceId') })
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  const rl = await rateLimit('api')
  if (!rl.success) return { ok: false, error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sesión expirada' }

  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!member) return { ok: false, error: 'Socio no encontrado' }

  const { data: bookingId, error } = await supabase.rpc('book_class', {
    p_class_instance_id: parsed.data.instanceId,
    p_member_id: member.id,
  })

  if (error) return { ok: false, error: humanizeBookingError(error) }
  if (!bookingId) return { ok: false, error: 'No se pudo reservar' }

  // Detectar si entró en lista de espera
  const { data: bookingRow } = await supabase
    .from('bookings')
    .select('status')
    .eq('id', bookingId)
    .single()

  revalidatePath('/clases')
  revalidatePath('/inicio')
  return { ok: true, bookingId, status: bookingRow?.status ?? 'confirmed' }
}

export async function cancelBookingAction(formData: FormData): Promise<Result> {
  const parsed = cancelSchema.safeParse({ bookingId: formData.get('bookingId') })
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }

  const rl = await rateLimit('api')
  if (!rl.success) return { ok: false, error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sesión expirada' }

  const { error } = await supabase.rpc('cancel_booking', {
    p_booking_id: parsed.data.bookingId,
  })

  if (error) {
    return {
      ok: false,
      error: sanitizeServerError(error, 'No se pudo cancelar la reserva. Inténtalo de nuevo.'),
    }
  }

  revalidatePath('/clases')
  revalidatePath('/inicio')
  return { ok: true }
}

/**
 * Mapea errores conocidos del RPC `book_class` a mensajes amigables.
 * Si el error no matchea ningún caso conocido → devuelve mensaje genérico
 * (NO `error.message` raw — evita info disclosure de internals Supabase/PG).
 * El mensaje raw queda logueado server-side vía sanitizeServerError.
 */
function humanizeBookingError(err: { message: string } | Error): string {
  const msg = err.message ?? ''
  const lower = msg.toLowerCase()
  if (lower.includes('full') || lower.includes('no spots')) {
    return 'Clase llena. Te has añadido a la lista de espera.'
  }
  if (lower.includes('already booked') || lower.includes('duplicate')) {
    return 'Ya tienes una reserva para esta clase.'
  }
  if (lower.includes('cancelled')) {
    return 'Esta clase ha sido cancelada.'
  }
  if (lower.includes('past') || lower.includes('started')) {
    return 'No puedes reservar una clase que ya ha comenzado.'
  }
  return sanitizeServerError(err, 'No se pudo reservar la clase. Revisa el horario o contacta al gimnasio.')
}
