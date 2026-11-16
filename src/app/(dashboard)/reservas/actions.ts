'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'
import { enqueueAviso } from '@/lib/avisos/enqueue'

export type BookingActionState = {
  error?: string
  success?: string
  bookingId?: string
  status?: 'confirmed' | 'waitlist'
}

const uuidSchema = z.string().trim().uuid('ID inválido')

export async function bookClassAction(
  classInstanceId: string,
  memberId: string
): Promise<BookingActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const ciParsed = uuidSchema.safeParse(classInstanceId)
  if (!ciParsed.success) return { error: 'ID de clase inválido' }
  const mParsed = uuidSchema.safeParse(memberId)
  if (!mParsed.success) return { error: 'ID de socio inválido' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('book_class', {
    p_class_instance_id: ciParsed.data,
    p_member_id: mParsed.data,
  })

  if (error) {
    // Traducir errores comunes del RPC
    const msg = error.message.toLowerCase()
    if (msg.includes('duplicate')) {
      return { error: 'El socio ya tiene una reserva en esta clase' }
    }
    if (msg.includes('class is full and waitlist is full')) {
      return { error: 'Clase y lista de espera completas' }
    }
    if (msg.includes('class is not available')) {
      return { error: 'Esta clase no acepta reservas (cancelada o completada)' }
    }
    if (msg.includes('not found')) {
      return { error: 'Clase no encontrada' }
    }
    return { error: sanitizeServerError(error) }
  }

  // Consultar el booking recién creado para saber si quedó confirmed o waitlist
  const { data: booking } = await supabase
    .from('bookings')
    .select('status, gym_id, class_instance_id, class_instances(start_at, classes(name))')
    .eq('id', data as string)
    .single()

  revalidatePath('/reservas')
  revalidatePath('/horario')

  const status = (booking?.status ?? 'confirmed') as 'confirmed' | 'waitlist'

  // Si queda confirmed, encolar recordatorio (el offset lo aplica cada plantilla)
  if (status === 'confirmed' && booking?.gym_id) {
    const instance = Array.isArray(booking.class_instances)
      ? booking.class_instances[0]
      : booking.class_instances
    const cls = instance
      ? Array.isArray(instance.classes)
        ? instance.classes[0]
        : instance.classes
      : null
    await enqueueAviso(supabase, {
      gymId: booking.gym_id,
      memberId,
      triggerType: 'booking_reminder',
      eventContext: {
        nombre_clase: cls?.name ?? '',
        start_at: instance?.start_at ?? '',
      },
    })
  }

  const successMsg =
    status === 'confirmed'
      ? 'Reserva confirmada'
      : 'Clase llena: socio añadido a lista de espera'

  return {
    success: successMsg,
    bookingId: data as string,
    status,
  }
}

export async function cancelBookingAction(
  bookingId: string
): Promise<BookingActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(bookingId)
  if (!parsed.success) return { error: 'ID de reserva inválido' }

  const supabase = await createClient()

  // Leer booking antes de cancelar para disparar el aviso post-cancel
  const { data: booking } = await supabase
    .from('bookings')
    .select('gym_id, member_id, class_instances(start_at, classes(name))')
    .eq('id', parsed.data)
    .single()

  const { error } = await supabase.rpc('cancel_booking', {
    p_booking_id: parsed.data,
  })

  if (error) return { error: sanitizeServerError(error) }

  if (booking?.gym_id && booking?.member_id) {
    const instance = Array.isArray(booking.class_instances)
      ? booking.class_instances[0]
      : booking.class_instances
    const cls = instance
      ? Array.isArray(instance.classes)
        ? instance.classes[0]
        : instance.classes
      : null
    await enqueueAviso(supabase, {
      gymId: booking.gym_id,
      memberId: booking.member_id,
      triggerType: 'booking_cancelled',
      eventContext: {
        nombre_clase: cls?.name ?? '',
        start_at: instance?.start_at ?? '',
      },
    })
  }

  revalidatePath('/reservas')
  revalidatePath('/horario')
  return { success: 'Reserva cancelada' }
}
