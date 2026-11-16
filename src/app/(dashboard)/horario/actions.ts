'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'

type ActionState = { error?: string; success?: string; notified?: number }
type GuestBookingResult = { error?: string; success?: string; bookingId?: string }

const cancelClassSchema = z.object({
  classInstanceId: z.string().trim().uuid('ID clase inválido'),
  reason: z.string().trim().max(500).optional(),
})

const GUEST_PAYMENT_METHODS = ['manual', 'cash', 'card', 'bank_transfer'] as const

const guestBookingSchema = z.object({
  classInstanceId: z.string().trim().uuid('ID clase inválido'),
  firstName: z.string().trim().min(1, 'Nombre requerido').max(100),
  lastName: z.string().trim().min(1, 'Apellidos requeridos').max(100),
  email: z.string().trim().email('Email inválido').max(200).or(z.literal('')).optional(),
  phone: z.string().trim().max(30).or(z.literal('')).optional(),
  paymentMethod: z.string().refine(
    (v) => v === '' || (GUEST_PAYMENT_METHODS as readonly string[]).includes(v),
    'Método de pago inválido'
  ).or(z.literal('')).optional(),
  amount: z.string().refine(
    (v) => {
      if (v === '' || v == null) return true
      const n = Number(v.replace(',', '.'))
      return Number.isFinite(n) && n >= 0 && n <= 1000
    },
    'Importe inválido'
  ).or(z.literal('')).optional(),
})

/**
 * Cancela una class_instance marcando status='cancelled'.
 * - Libera las reservas no canceladas (status='cancelled', cancelled_at=now)
 * - Permite que plazas queden libres y waitlist no promueva más (clase entera cancelada)
 * - Inserta notifications a cada socio con reserva activa (trigger_type='class_cancelled')
 *
 * Solo owner/admin del gym de la clase puede cancelar (RLS vía gym_id check).
 */
export async function cancelClassInstanceAction(
  classInstanceId: string,
  reason?: string
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = cancelClassSchema.safeParse({ classInstanceId, reason })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verificar que la clase existe + obtener gym_id para RLS check
  const { data: classInst } = await supabase
    .from('class_instances')
    .select('id, gym_id, status, start_at, classes(name)')
    .eq('id', parsed.data.classInstanceId)
    .single()

  if (!classInst) return { error: 'Clase no encontrada' }
  if (classInst.status === 'cancelled') return { error: 'La clase ya está cancelada' }
  if (classInst.status === 'completed') return { error: 'No se puede cancelar una clase ya completada' }

  const trimmedReason = (parsed.data.reason ?? '').trim().slice(0, 500)

  // 1) Marcar class_instance como cancelada
  const { error: updClassErr } = await supabase
    .from('class_instances')
    .update({ status: 'cancelled' })
    .eq('id', parsed.data.classInstanceId)

  if (updClassErr) return { error: sanitizeServerError(updClassErr) }

  // 2) Recoger reservas activas para notificación
  const { data: activeBookings } = await supabase
    .from('bookings')
    .select('id, member_id')
    .eq('class_instance_id', parsed.data.classInstanceId)
    .in('status', ['confirmed', 'waitlist'])

  const bookingIds = (activeBookings ?? []).map((b) => b.id)
  const affectedMemberIds = (activeBookings ?? [])
    .map((b) => b.member_id)
    .filter((id): id is string => !!id)

  // 3) Cancelar bookings activas (batch)
  if (bookingIds.length > 0) {
    await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .in('id', bookingIds)
  }

  // 4) Insertar notifications a socios afectados (one-shot, best-effort)
  // Esquema real: notifications tiene user_id (auth.users) no member_id → resolver
  const cls = Array.isArray(classInst.classes) ? classInst.classes[0] : classInst.classes
  const className = cls?.name ?? 'Clase'
  const whenStr = classInst.start_at
    ? new Date(classInst.start_at).toLocaleString('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : ''
  const title = `Clase cancelada: ${className}`
  const message = `La clase ${className}${whenStr ? ` del ${whenStr}` : ''} ha sido cancelada.${trimmedReason ? ` Motivo: ${trimmedReason}` : ''}`

  if (affectedMemberIds.length > 0) {
    // Obtener auth_user_id de los members afectados (solo los que tienen cuenta FitFlow)
    const { data: membersWithAuth } = await supabase
      .from('members')
      .select('auth_user_id')
      .in('id', affectedMemberIds)
      .not('auth_user_id', 'is', null)

    const userIds = (membersWithAuth ?? [])
      .map((m) => m.auth_user_id)
      .filter((id): id is string => !!id)

    if (userIds.length > 0) {
      const notifications = userIds.map((userId) => ({
        gym_id: classInst.gym_id,
        user_id: userId,
        type: 'warning' as const,
        title,
        message,
        link: `/mi-cuenta`,
      }))
      await supabase.from('notifications').insert(notifications)
    }
  }

  revalidatePath('/horario')
  revalidatePath('/reservas')
  revalidatePath('/clases-tarifas')

  return {
    success: `Clase cancelada. ${affectedMemberIds.length} socio(s) notificado(s).`,
    notified: affectedMemberIds.length,
  }
}

/**
 * F2.2: Apuntar invitado (no-socio) a una clase.
 * Crea un member con is_guest=true + booking confirmed atómicamente vía RPC
 * create_guest_booking. Valida capacity + rol owner/admin server-side.
 * Opcionalmente registra pago inmediato si paymentMethod + amount.
 */
export async function createGuestBookingAction(input: {
  classInstanceId: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  paymentMethod?: string
  amount?: string
}): Promise<GuestBookingResult> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const parsed = guestBookingSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()

  const paymentMethod = parsed.data.paymentMethod?.trim() || null
  const amountStr = parsed.data.amount?.trim() || ''
  const amount = amountStr ? Number(amountStr.replace(',', '.')) : null

  // Solo crear payment si AMBOS están presentes y amount > 0
  const includePayment = paymentMethod && amount !== null && amount > 0

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data, error } = await (supabase.rpc as any)('create_guest_booking', {
    p_class_instance_id: parsed.data.classInstanceId,
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_email: parsed.data.email?.trim() || null,
    p_phone: parsed.data.phone?.trim() || null,
    p_payment_method: includePayment ? paymentMethod : null,
    p_amount: includePayment ? amount : null,
  })
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (error) {
    // Mensajes específicos RPC → user-friendly
    const msg = (error.message ?? '').toLowerCase()
    if (msg.includes('class is full')) return { error: 'La clase está completa.' }
    if (msg.includes('class is not available')) return { error: 'La clase no está disponible (cancelada o completada).' }
    if (msg.includes('forbidden')) return { error: 'Solo owner o admin pueden añadir invitados.' }
    if (msg.includes('not found')) return { error: 'Clase no encontrada.' }
    if (msg.includes('first_name is required')) return { error: 'Nombre requerido.' }
    if (msg.includes('last_name is required')) return { error: 'Apellidos requeridos.' }
    return { error: sanitizeServerError(error) }
  }

  revalidatePath('/horario')
  revalidatePath('/reservas')

  return {
    success: `Invitado apuntado correctamente${includePayment ? ` + cobro €${amount?.toFixed(2)}` : ''}.`,
    bookingId: data as string,
  }
}
