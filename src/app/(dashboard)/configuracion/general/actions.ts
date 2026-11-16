'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'
import type { SettingsGeneral } from './types'

type ActionState = { error?: string; success?: string }

const reservasSchema = z.object({
  min_hours_cancel: z.number().int().min(0).max(168),
  booking_window_days: z.number().int().min(1).max(365),
  max_future_bookings: z.number().int().min(1).max(100),
  auto_waitlist_enabled: z.boolean(),
  no_show_penalty_enabled: z.boolean(),
  no_show_block_days: z.number().int().min(0).max(365),
})

const visibilidadSchema = z.object({
  classes_public: z.boolean(),
  show_capacity_occupancy: z.boolean(),
  show_instructor_names_public: z.boolean(),
})

const calendarioSchema = z.object({
  timezone: z.string().min(1).max(64),
  week_starts_on: z.enum(['monday', 'sunday']),
  time_format: z.enum(['12h', '24h']),
  date_format: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']),
})

const loginSchema = z.object({
  require_email_verified: z.boolean(),
  magic_link_only: z.boolean(),
  password_min_length: z.number().int().min(6).max(128),
  password_require_uppercase: z.boolean(),
  password_require_number: z.boolean(),
  password_require_special: z.boolean(),
  session_duration_hours: z.number().int().min(1).max(8760),
})

const facturaSchema = z.object({
  default_series: z.string().max(10),
  prefix_number: z.string().max(20),
  default_vat_rate: z.number().min(0).max(100),
  next_invoice_number: z.number().int().min(1),
  reset_numbering_yearly: z.boolean(),
})

const notificacionesSchema = z.object({
  send_welcome_email: z.boolean(),
  send_booking_confirmation: z.boolean(),
  send_cancellation_confirmation: z.boolean(),
  send_payment_receipt: z.boolean(),
  reminder_hours_before_class: z.number().int().min(0).max(168),
})

const privacidadSchema = z.object({
  cookie_banner_enabled: z.boolean(),
  analytics_enabled: z.boolean(),
  data_retention_months: z.number().int().min(12).max(120),
})

const settingsSchema = z.object({
  reservas: reservasSchema,
  visibilidad: visibilidadSchema,
  calendario: calendarioSchema,
  login: loginSchema,
  factura: facturaSchema,
  notificaciones: notificacionesSchema,
  privacidad: privacidadSchema,
})

export async function updateSettingsGeneralAction(
  settings: SettingsGeneral
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = settingsSchema.safeParse(settings)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: `${first.path.join('.')}: ${first.message}` }
  }

  const supabase = await createClient()
  const { data: gyms } = await supabase.rpc('current_user_gyms')
  if (!gyms || gyms.length === 0) return { error: 'No hay gym activo' }

  const gymId = gyms[0].gym_id

  const { error } = await supabase
    .from('gyms')
    .update({ settings_general: parsed.data })
    .eq('id', gymId)

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/configuracion/general')
  revalidatePath('/configuracion')
  return { success: 'Configuración general actualizada' }
}
