'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'
import { syncTariffToStripe } from '@/lib/stripe/gym-stripe'

const uuidSchema = z.string().trim().uuid('ID inválido')

export type TariffActionState = {
  error?: string
  success?: string
}

export type InstructorActionState = {
  error?: string
  success?: string
}

export type ClassActionState = {
  error?: string
  success?: string
}

async function resolveActiveGymId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('current_user_gyms')
  return data && data.length > 0 ? data[0].gym_id : null
}

export async function createTariffAction(
  _prev: TariffActionState,
  formData: FormData
): Promise<TariffActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const group = String(formData.get('group') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const priceStr = String(formData.get('price') ?? '0')
  const typeUI = String(formData.get('type') ?? 'Mensual')

  if (!name) return { error: 'El nombre es obligatorio' }

  const price = Number(priceStr.replace(',', '.'))
  if (!Number.isFinite(price) || price < 0) {
    return { error: 'Precio invalido' }
  }

  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo en la sesion' }

  const supabase = await createClient()
  const dbType = typeUI === 'Bono' ? 'bonus' : 'monthly'

  const { data: inserted, error } = await supabase
    .from('tariffs')
    .insert({
      gym_id: gymId,
      group: group || null,
      name,
      price,
      type: dbType,
      is_active: true,
    })
    .select('id')
    .single()

  if (error || !inserted) return { error: error?.message ?? 'Error creando tarifa' }

  // Fase 1C: sync Stripe en background (fallback silencioso si falla)
  try {
    await syncTariffToStripe(gymId, inserted.id, {
      name,
      amountCents: Math.round(price * 100),
      recurring: dbType === 'monthly',
    })
  } catch {
    // ignorar: syncTariffToStripe ya registra error en DB via RPC
  }

  revalidatePath('/clases-tarifas')
  revalidatePath('/socios') // el dropdown de socios usa esta lista
  return { success: 'Tarifa creada' }
}

export async function updateTariffAction(
  _prev: TariffActionState,
  formData: FormData
): Promise<TariffActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const id = String(formData.get('id') ?? '')
  const group = String(formData.get('group') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const priceStr = String(formData.get('price') ?? '0')
  const typeUI = String(formData.get('type') ?? 'Mensual')

  if (!id) return { error: 'ID requerido' }
  if (!name) return { error: 'El nombre es obligatorio' }

  const price = Number(priceStr.replace(',', '.'))
  if (!Number.isFinite(price) || price < 0) {
    return { error: 'Precio invalido' }
  }

  const supabase = await createClient()
  const dbType = typeUI === 'Bono' ? 'bonus' : 'monthly'

  // Leer estado Stripe previo para saber si tenemos que sincronizar
  const { data: before } = await supabase
    .from('tariffs')
    .select('gym_id, stripe_product_id, stripe_price_id, stripe_sync_status, price')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase
    .from('tariffs')
    .update({
      group: group || null,
      name,
      price,
      type: dbType,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  // Fase 1C: sync Stripe si no es 'manual' override — re-sync cualquier cambio
  if (before && before.gym_id && before.stripe_sync_status !== 'manual') {
    try {
      await syncTariffToStripe(before.gym_id, id, {
        name,
        amountCents: Math.round(price * 100),
        recurring: dbType === 'monthly',
        existingProductId: before.stripe_product_id,
        existingPriceId: before.stripe_price_id,
        existingPriceAmountCents: before.price != null ? Math.round(Number(before.price) * 100) : null,
      })
    } catch {
      // ignorar
    }
  }

  revalidatePath('/clases-tarifas')
  revalidatePath('/socios')
  return { success: 'Tarifa actualizada' }
}

export async function toggleTariffActiveAction(
  id: string,
  isActive: boolean
): Promise<TariffActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('tariffs')
    .update({ is_active: isActive })
    .eq('id', parsed.data)

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/clases-tarifas')
  revalidatePath('/socios')
  return { success: isActive ? 'Tarifa activada' : 'Tarifa desactivada' }
}

// ═════════════════════════════════════════════════════════════════════════
// INSTRUCTORS
// ═════════════════════════════════════════════════════════════════════════

export async function createInstructorAction(
  _prev: InstructorActionState,
  formData: FormData
): Promise<InstructorActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim() || null
  const phone = String(formData.get('phone') ?? '').trim() || null
  const specialtiesRaw = String(formData.get('specialties') ?? '').trim()
  const color = String(formData.get('color') ?? '#3b8bea').trim()

  if (!name) return { error: 'El nombre es obligatorio' }

  const specialties = specialtiesRaw
    ? specialtiesRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo en la sesion' }

  const supabase = await createClient()
  const { error } = await supabase.from('instructors').insert({
    gym_id: gymId,
    name,
    email,
    phone,
    specialties,
    color,
    is_active: true,
  })

  if (error) return { error: error.message }

  revalidatePath('/clases-tarifas')
  return { success: 'Instructor creado' }
}

export async function updateInstructorAction(
  _prev: InstructorActionState,
  formData: FormData
): Promise<InstructorActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim() || null
  const phone = String(formData.get('phone') ?? '').trim() || null
  const specialtiesRaw = String(formData.get('specialties') ?? '').trim()
  const color = String(formData.get('color') ?? '#3b8bea').trim()

  if (!id) return { error: 'ID requerido' }
  if (!name) return { error: 'El nombre es obligatorio' }

  const specialties = specialtiesRaw
    ? specialtiesRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const supabase = await createClient()
  const { error } = await supabase
    .from('instructors')
    .update({ name, email, phone, specialties, color })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/clases-tarifas')
  return { success: 'Instructor actualizado' }
}

export async function toggleInstructorActiveAction(
  id: string,
  isActive: boolean
): Promise<InstructorActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('instructors')
    .update({ is_active: isActive })
    .eq('id', parsed.data)

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/clases-tarifas')
  return { success: isActive ? 'Instructor activado' : 'Instructor desactivado' }
}

// ═════════════════════════════════════════════════════════════════════════
// CLASSES (plantillas semanales)
// ═════════════════════════════════════════════════════════════════════════

const VALID_CLASS_TYPES = [
  'dinamico',
  'premium',
  'salud',
  'personal_1h',
  'personal_30min',
  'grupal',
] as const

type DbClassType = (typeof VALID_CLASS_TYPES)[number]

function validateTimeHHMM(t: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(t)) return null
  const [hStr, mStr] = t.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return `${hStr}:${mStr}:00`
}

export async function createClassAction(
  _prev: ClassActionState,
  formData: FormData
): Promise<ClassActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const name = String(formData.get('name') ?? '').trim()
  const typeRaw = String(formData.get('type') ?? 'grupal').trim()
  const instructorId = String(formData.get('instructorId') ?? '').trim() || null
  const dayOfWeekStr = String(formData.get('dayOfWeek') ?? '')
  const startTimeUI = String(formData.get('startTime') ?? '').trim()
  const endTimeUI = String(formData.get('endTime') ?? '').trim()
  const maxSpotsStr = String(formData.get('maxSpots') ?? '0')
  const waitlistSizeStr = String(formData.get('waitlistSize') ?? '0')
  const room = String(formData.get('room') ?? '').trim() || null

  if (!name) return { error: 'El nombre es obligatorio' }
  if (!VALID_CLASS_TYPES.includes(typeRaw as DbClassType)) {
    return { error: 'Tipo de clase invalido' }
  }
  const type = typeRaw as DbClassType

  const dayOfWeek = Number(dayOfWeekStr)
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { error: 'Dia de semana invalido' }
  }

  const startTime = validateTimeHHMM(startTimeUI)
  const endTime = validateTimeHHMM(endTimeUI)
  if (!startTime || !endTime) {
    return { error: 'Horario invalido (formato HH:MM)' }
  }
  if (startTime >= endTime) {
    return { error: 'La hora de fin debe ser posterior a la de inicio' }
  }

  const maxSpots = Number(maxSpotsStr)
  if (!Number.isInteger(maxSpots) || maxSpots < 1) {
    return { error: 'Plazas maximas debe ser un numero mayor que 0' }
  }

  const waitlistSize = Number(waitlistSizeStr)
  if (!Number.isInteger(waitlistSize) || waitlistSize < 0) {
    return { error: 'Lista de espera invalida' }
  }

  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo en la sesion' }

  const supabase = await createClient()
  const { error } = await supabase.from('classes').insert({
    gym_id: gymId,
    name,
    type,
    instructor_id: instructorId,
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
    max_spots: maxSpots,
    waitlist_size: waitlistSize,
    room,
    is_active: true,
  })

  if (error) return { error: error.message }

  revalidatePath('/clases-tarifas')
  revalidatePath('/horario')
  revalidatePath('/reservas')
  return { success: 'Clase creada' }
}

export async function updateClassAction(
  _prev: ClassActionState,
  formData: FormData
): Promise<ClassActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const typeRaw = String(formData.get('type') ?? 'grupal').trim()
  const instructorId = String(formData.get('instructorId') ?? '').trim() || null
  const dayOfWeekStr = String(formData.get('dayOfWeek') ?? '')
  const startTimeUI = String(formData.get('startTime') ?? '').trim()
  const endTimeUI = String(formData.get('endTime') ?? '').trim()
  const maxSpotsStr = String(formData.get('maxSpots') ?? '0')
  const waitlistSizeStr = String(formData.get('waitlistSize') ?? '0')
  const room = String(formData.get('room') ?? '').trim() || null

  if (!id) return { error: 'ID requerido' }
  if (!name) return { error: 'El nombre es obligatorio' }
  if (!VALID_CLASS_TYPES.includes(typeRaw as DbClassType)) {
    return { error: 'Tipo de clase invalido' }
  }
  const type = typeRaw as DbClassType

  const dayOfWeek = Number(dayOfWeekStr)
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { error: 'Dia de semana invalido' }
  }

  const startTime = validateTimeHHMM(startTimeUI)
  const endTime = validateTimeHHMM(endTimeUI)
  if (!startTime || !endTime) {
    return { error: 'Horario invalido (formato HH:MM)' }
  }
  if (startTime >= endTime) {
    return { error: 'La hora de fin debe ser posterior a la de inicio' }
  }

  const maxSpots = Number(maxSpotsStr)
  if (!Number.isInteger(maxSpots) || maxSpots < 1) {
    return { error: 'Plazas maximas debe ser un numero mayor que 0' }
  }

  const waitlistSize = Number(waitlistSizeStr)
  if (!Number.isInteger(waitlistSize) || waitlistSize < 0) {
    return { error: 'Lista de espera invalida' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('classes')
    .update({
      name,
      type,
      instructor_id: instructorId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      max_spots: maxSpots,
      waitlist_size: waitlistSize,
      room,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/clases-tarifas')
  revalidatePath('/horario')
  revalidatePath('/reservas')
  return { success: 'Clase actualizada' }
}

export async function toggleClassActiveAction(
  id: string,
  isActive: boolean
): Promise<ClassActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('classes')
    .update({ is_active: isActive })
    .eq('id', parsed.data)

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/clases-tarifas')
  revalidatePath('/horario')
  revalidatePath('/reservas')
  return { success: isActive ? 'Clase activada' : 'Clase desactivada' }
}

export async function generateClassInstancesAction(
  daysAhead: number = 14
): Promise<ClassActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  if (!Number.isInteger(daysAhead) || daysAhead < 1 || daysAhead > 90) {
    return { error: 'daysAhead inválido (1-90)' }
  }

  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo en la sesion' }

  const from = new Date()
  const to = new Date()
  to.setDate(to.getDate() + daysAhead)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('generate_class_instances', {
    p_gym_id: gymId,
    p_from_date: from.toISOString().slice(0, 10),
    p_to_date: to.toISOString().slice(0, 10),
  })

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/clases-tarifas')
  revalidatePath('/horario')
  revalidatePath('/reservas')
  return { success: `Generadas ${data ?? 0} instancias para los proximos ${daysAhead} dias` }
}

// ============================================================================
// Agendas (migración 0053)
// ============================================================================

export type AgendaActionState = {
  error?: string
  success?: string
}

interface AgendaPayload {
  id: string | null
  name: string
  description?: string | null
  durationMinutes: number
  defaultInstructorId?: string | null
  color?: string
  active?: boolean
  capacity?: number
  requiresPaymentUpfront?: boolean
  sortOrder?: number
}

export async function upsertAgendaAction(payload: AgendaPayload): Promise<AgendaActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo en la sesion' }

  if (!payload.name.trim()) return { error: 'El nombre es obligatorio' }
  if (payload.durationMinutes < 15 || payload.durationMinutes > 240) {
    return { error: 'La duración debe estar entre 15 y 240 minutos' }
  }

  const supabase = await createClient()
  // RPC creado en migración 0053, tipos regenerados tras merge
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)('upsert_agenda', {
    p_id: payload.id,
    p_gym_id: gymId,
    p_name: payload.name.trim(),
    p_duration_minutes: payload.durationMinutes,
    p_default_instructor_id: payload.defaultInstructorId ?? null,
    p_color: payload.color ?? '#3b8bea',
    p_active: payload.active ?? true,
    p_capacity: payload.capacity ?? 1,
    p_requires_payment_upfront: payload.requiresPaymentUpfront ?? false,
    p_description: payload.description ?? null,
    p_sort_order: payload.sortOrder ?? 0,
  })

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/clases-tarifas')
  revalidatePath('/citas')
  return { success: payload.id ? 'Agenda actualizada' : 'Agenda creada' }
}

export async function deleteAgendaAction(id: string): Promise<AgendaActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: 'ID inválido' }

  const supabase = await createClient()
  // RPC creado en migración 0053, tipos regenerados tras merge
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)('delete_agenda', { p_id: parsed.data })
  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/clases-tarifas')
  revalidatePath('/citas')
  return { success: 'Agenda eliminada' }
}
