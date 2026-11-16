'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type MemberDetailActionState = {
  error?: string
  success?: string
}

export async function updateMemberDetailAction(
  memberId: string,
  formData: FormData
): Promise<MemberDetailActionState> {
  if (!memberId) return { error: 'Falta el id del socio' }

  const firstName = String(formData.get('first_name') ?? '').trim()
  const lastName = String(formData.get('last_name') ?? '').trim()
  if (!firstName) return { error: 'El nombre es obligatorio' }
  if (!lastName) return { error: 'El primer apellido es obligatorio' }

  const rawGender = String(formData.get('gender') ?? '').trim()
  const gender: 'male' | 'female' | 'other' | null =
    rawGender === 'male' || rawGender === 'female' || rawGender === 'other'
      ? rawGender
      : null
  const joinDate = String(formData.get('join_date') ?? '').trim()

  const payload = {
    first_name: firstName,
    last_name: lastName,
    second_last_name:
      String(formData.get('second_last_name') ?? '').trim() || null,
    email: String(formData.get('email') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    tax_id: String(formData.get('tax_id') ?? '').trim() || null,
    birth_date: String(formData.get('birth_date') ?? '').trim() || null,
    gender,
    address: String(formData.get('address') ?? '').trim() || null,
    city: String(formData.get('city') ?? '').trim() || null,
    postal_code: String(formData.get('postal_code') ?? '').trim() || null,
    ...(joinDate ? { join_date: joinDate } : {}),
    avatar_url: String(formData.get('avatar_url') ?? '').trim() || null,
    emergency_contact_name:
      String(formData.get('emergency_contact_name') ?? '').trim() || null,
    emergency_contact_phone:
      String(formData.get('emergency_contact_phone') ?? '').trim() || null,
    emergency_contact_relation:
      String(formData.get('emergency_contact_relation') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
    internal_notes: String(formData.get('internal_notes') ?? '').trim() || null,
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('members')
    .update(payload)
    .eq('id', memberId)

  if (error) {
    if (error.code === '23505') return { error: 'Ya existe un socio con ese email' }
    return { error: error.message }
  }

  revalidatePath(`/socios/${memberId}`)
  revalidatePath('/socios')
  return { success: 'Cambios guardados' }
}

// ===========================================================================
// Reservas automáticas (recurring_bookings)
// ===========================================================================

export interface RecurringBookingInput {
  type: 'class' | 'appointment'
  classId?: string | null
  instructorId?: string | null
  room?: string | null
  durationMinutes?: number | null
  dayOfWeek: number
  startTime: string // HH:MM
  startsOn?: string | null
  endsOn?: string | null
  notes?: string | null
}

export async function createRecurringBookingAction(
  memberId: string,
  input: RecurringBookingInput
): Promise<MemberDetailActionState> {
  if (!memberId) return { error: 'Falta el id del socio' }
  if (input.dayOfWeek < 0 || input.dayOfWeek > 6) {
    return { error: 'Día de la semana inválido' }
  }
  if (!input.startTime || !/^\d{2}:\d{2}/.test(input.startTime)) {
    return { error: 'Hora de inicio inválida' }
  }
  if (input.type === 'class' && !input.classId) {
    return { error: 'Selecciona la clase recurrente' }
  }

  const supabase = await createClient()
  const { data: member } = await supabase
    .from('members')
    .select('gym_id')
    .eq('id', memberId)
    .maybeSingle()
  if (!member) return { error: 'Socio no encontrado' }

  const { error } = await supabase.from('recurring_bookings').insert({
    gym_id: member.gym_id,
    member_id: memberId,
    type: input.type,
    class_id: input.type === 'class' ? input.classId : null,
    instructor_id: input.type === 'appointment' ? input.instructorId ?? null : null,
    room: input.type === 'appointment' ? input.room ?? null : null,
    duration_minutes:
      input.type === 'appointment' ? input.durationMinutes ?? 60 : null,
    day_of_week: input.dayOfWeek,
    start_time: input.startTime,
    starts_on: input.startsOn ?? new Date().toISOString().slice(0, 10),
    ends_on: input.endsOn ?? null,
    notes: input.notes ?? null,
    active: true,
  })

  if (error) return { error: error.message }

  revalidatePath(`/socios/${memberId}`)
  return { success: 'Reserva automática creada' }
}

export async function toggleRecurringBookingAction(
  memberId: string,
  recurringId: string,
  active: boolean
): Promise<MemberDetailActionState> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('recurring_bookings')
    .update({ active })
    .eq('id', recurringId)
  if (error) return { error: error.message }
  revalidatePath(`/socios/${memberId}`)
  return { success: active ? 'Recurrencia activada' : 'Recurrencia pausada' }
}

export async function deleteRecurringBookingAction(
  memberId: string,
  recurringId: string
): Promise<MemberDetailActionState> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('recurring_bookings')
    .delete()
    .eq('id', recurringId)
  if (error) return { error: error.message }
  revalidatePath(`/socios/${memberId}`)
  return { success: 'Recurrencia eliminada' }
}

// ===========================================================================
// Morosos — desbloqueo manual (PA #72)
// ===========================================================================

export async function unblockMemberMorososAction(
  memberId: string
): Promise<MemberDetailActionState> {
  if (!memberId) return { error: 'Falta el id del socio' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('unblock_member_morosos', { p_member_id: memberId })
  if (error) return { error: error.message }
  revalidatePath(`/socios/${memberId}`)
  revalidatePath('/pagos')
  return { success: 'Socio desbloqueado. Recuerda registrar el pago pendiente.' }
}

// ===========================================================================
// Cláusulas RGPD (member_clauses + RPCs) — migración 0059
// ===========================================================================

export async function assignClauseToMemberAction(
  memberId: string,
  templateId: string,
  expiresAt?: string | null
): Promise<MemberDetailActionState> {
  if (!memberId || !templateId) {
    return { error: 'Falta socio o plantilla' }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('assign_clause_to_member', {
    p_member_id: memberId,
    p_template_id: templateId,
    p_expires_at: expiresAt ?? undefined,
  })
  if (error) return { error: error.message }
  revalidatePath(`/socios/${memberId}`)
  return { success: 'Cláusula asignada' }
}

export async function signMemberClauseAction(
  memberId: string,
  clauseId: string,
  signedByName: string
): Promise<MemberDetailActionState> {
  if (!clauseId || !signedByName.trim()) {
    return { error: 'Falta nombre o cláusula' }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('sign_member_clause', {
    p_clause_id: clauseId,
    p_signed_by_name: signedByName.trim(),
    p_signed_by_ip: undefined,
  })
  if (error) return { error: error.message }
  revalidatePath(`/socios/${memberId}`)
  return { success: 'Cláusula firmada' }
}

export async function revokeMemberClauseAction(
  memberId: string,
  clauseId: string
): Promise<MemberDetailActionState> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('member_clauses')
    .delete()
    .eq('id', clauseId)
  if (error) return { error: error.message }
  revalidatePath(`/socios/${memberId}`)
  return { success: 'Cláusula eliminada' }
}

// ===========================================================================
// member_health_data — datos médicos scoped (RGPD Art. 9, owner/admin only)
// SECURITY HIGH — migración 0066. Trainer NO debe poder llegar aquí (RLS gate).
// ===========================================================================

export async function updateMemberHealthDataAction(
  memberId: string,
  formData: FormData
): Promise<MemberDetailActionState> {
  if (!memberId) return { error: 'Falta el id del socio' }

  const supabase = await createClient()

  // Resuelve gym_id del socio (necesario para INSERT si no existe)
  const { data: member } = await supabase
    .from('members')
    .select('gym_id')
    .eq('id', memberId)
    .maybeSingle()
  if (!member) return { error: 'Socio no encontrado' }

  const medicalNotes = String(formData.get('medical_notes') ?? '').trim() || null
  const medicalInfoRaw = String(formData.get('medical_info_json') ?? '').trim()
  const imageConsent = String(formData.get('image_consent') ?? 'false') === 'true'
  const marketingConsent = String(formData.get('marketing_consent') ?? 'false') === 'true'

  let medicalInfo: unknown = null
  if (medicalInfoRaw) {
    try {
      medicalInfo = JSON.parse(medicalInfoRaw)
    } catch {
      return { error: 'medical_info debe ser JSON válido (deja vacío si no aplica)' }
    }
  }

  // Upsert: INSERT si no existe, UPDATE si sí
  const { error } = await supabase
    .from('member_health_data')
    .upsert(
      {
        member_id: memberId,
        gym_id: member.gym_id,
        medical_notes: medicalNotes,
        medical_info: medicalInfo as never,
        image_consent: imageConsent,
        marketing_consent: marketingConsent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'member_id' }
    )

  if (error) {
    if (error.code === '42501') {
      return { error: 'Sin permiso para editar datos médicos (solo owner/admin)' }
    }
    return { error: error.message }
  }

  revalidatePath(`/socios/${memberId}`)
  return { success: 'Datos médicos guardados' }
}

// ===========================================================================
// Quick-wins ficha socio (paridad LegacyGym)
// Backlog STATUS_PB_socios-tabs-audit_INTERMEDIO.md
// ===========================================================================

/**
 * Cambia la tarifa actual del socio. Snapshot legacy `current_tariff_id`.
 * Para el historial completo (member_tariffs row), usar /clases-tarifas.
 */
export async function changeMemberTariffAction(
  memberId: string,
  tariffId: string | null
): Promise<MemberDetailActionState> {
  if (!memberId) return { error: 'Falta el id del socio' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('members')
    .update({ current_tariff_id: tariffId })
    .eq('id', memberId)

  if (error) return { error: error.message }

  revalidatePath(`/socios/${memberId}`)
  revalidatePath('/socios')
  return { success: tariffId ? 'Tarifa actualizada' : 'Tarifa retirada' }
}

/**
 * Cancela una reserva del socio. Wrapper sobre RPC cancel_booking
 * (idéntica a cancelBookingAction de /reservas pero scope ficha).
 */
export async function cancelBookingFromMemberAction(
  memberId: string,
  bookingId: string
): Promise<MemberDetailActionState> {
  if (!memberId || !bookingId) return { error: 'Falta socio o reserva' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_booking', { p_booking_id: bookingId })
  if (error) return { error: error.message }
  revalidatePath(`/socios/${memberId}`)
  return { success: 'Reserva cancelada' }
}

/**
 * Crea un pago manual rápido (sin Stripe). El flujo completo Stripe
 * (link compartible, etc.) sigue en /pagos. Este es para "registrar
 * pago en efectivo / transferencia ya recibida".
 */
export interface QuickPaymentInput {
  amount: number
  description: string
  method: 'manual' | 'sepa' | 'card' | 'stripe'
  markPaid: boolean // true = paid_at = now, false = pending
}

export async function createQuickPaymentAction(
  memberId: string,
  input: QuickPaymentInput
): Promise<MemberDetailActionState> {
  if (!memberId) return { error: 'Falta el id del socio' }
  if (!input.amount || input.amount <= 0) return { error: 'El importe debe ser > 0' }
  if (!input.description?.trim()) return { error: 'La descripción es obligatoria' }

  const supabase = await createClient()
  const { data: member } = await supabase
    .from('members')
    .select('gym_id, first_name, last_name, email, current_tariff_id, tariffs:current_tariff_id (name, price, "group", type)')
    .eq('id', memberId)
    .maybeSingle()
  if (!member) return { error: 'Socio no encontrado' }

  const tariff = Array.isArray(member.tariffs) ? member.tariffs[0] : member.tariffs
  const memberSnapshot = {
    member_id: memberId,
    first_name: member.first_name,
    last_name: member.last_name,
    email: member.email,
    captured_at: new Date().toISOString(),
  }
  const tariffSnapshot = tariff
    ? {
        tariff_id: member.current_tariff_id,
        name: tariff.name,
        price: tariff.price,
        group: tariff.group,
        type: tariff.type,
        captured_at: new Date().toISOString(),
      }
    : null

  const now = new Date().toISOString()
  const status: 'completed' | 'pending' = input.markPaid ? 'completed' : 'pending'

  const { error } = await supabase.from('payments').insert({
    gym_id: member.gym_id,
    member_id: memberId,
    description: input.description.trim(),
    concept: 'manual_quick',
    amount: input.amount,
    currency: 'EUR',
    method: input.method,
    status,
    paid_at: status === 'completed' ? now : null,
    member_snapshot: memberSnapshot,
    tariff_snapshot: tariffSnapshot ?? undefined,
  })

  if (error) return { error: error.message }

  revalidatePath(`/socios/${memberId}`)
  revalidatePath('/pagos')
  return {
    success: status === 'completed' ? 'Pago registrado como completado' : 'Pago pendiente creado',
  }
}
