'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'

export type AppointmentType = 'personal_training' | 'consultation' | 'assessment' | 'nutrition' | 'other'
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export interface Appointment {
  id: string
  gymId: string
  memberId: string
  memberName: string | null
  instructorId: string
  instructorName: string | null
  instructorColor: string | null
  roomId: string | null
  roomName: string | null
  appointmentType: AppointmentType
  title: string | null
  startsAt: string
  endsAt: string
  durationMinutes: number
  status: AppointmentStatus
  notes: string | null
  priceCents: number | null
  consumedSession: boolean
  cancellationReason: string | null
  cancelledAt: string | null
  createdAt: string
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

// ============================================================================
// Listar citas en rango (vista calendario)
// ============================================================================

export async function listAppointmentsInRangeAction(
  gymId: string,
  from: string,
  to: string,
  instructorId?: string
): Promise<Appointment[]> {
  const supabase = await createClient()
  const rpcArgs: { p_gym_id: string; p_from: string; p_to: string; p_instructor_id?: string } = {
    p_gym_id: gymId,
    p_from: from,
    p_to: to,
  }
  if (instructorId) rpcArgs.p_instructor_id = instructorId
  const { data, error } = await supabase.rpc('list_appointments_in_range', rpcArgs)
  if (error || !data) return []

  // Enrich con nombres de member/instructor/room en batch
  const rows = data as Record<string, unknown>[]
  if (rows.length === 0) return []

  const memberIds = [...new Set(rows.map((r) => r.member_id as string))]
  const instructorIds = [...new Set(rows.map((r) => r.instructor_id as string))]
  const roomIds = [...new Set(rows.map((r) => r.room_id).filter(Boolean))] as string[]

  const [membersRes, instructorsRes, roomsRes] = await Promise.all([
    supabase.from('members').select('id, first_name, last_name').in('id', memberIds),
    supabase.from('instructors').select('id, name, color').in('id', instructorIds),
    roomIds.length > 0
      ? supabase.from('gym_rooms').select('id, name').in('id', roomIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ])

  const memberMap = new Map((membersRes.data ?? []).map((m) => [m.id, `${m.first_name} ${m.last_name}`.trim()]))
  const instructorMap = new Map((instructorsRes.data ?? []).map((i) => [i.id, { name: i.name, color: i.color ?? null }]))
  const roomMap = new Map((roomsRes.data ?? []).map((r) => [r.id, r.name]))

  return rows.map((r) => ({
    id: r.id as string,
    gymId: r.gym_id as string,
    memberId: r.member_id as string,
    memberName: memberMap.get(r.member_id as string) ?? null,
    instructorId: r.instructor_id as string,
    instructorName: instructorMap.get(r.instructor_id as string)?.name ?? null,
    instructorColor: instructorMap.get(r.instructor_id as string)?.color ?? null,
    roomId: (r.room_id as string | null) ?? null,
    roomName: r.room_id ? roomMap.get(r.room_id as string) ?? null : null,
    appointmentType: r.appointment_type as AppointmentType,
    title: (r.title as string | null) ?? null,
    startsAt: r.starts_at as string,
    endsAt: r.ends_at as string,
    durationMinutes: Number(r.duration_minutes),
    status: r.status as AppointmentStatus,
    notes: (r.notes as string | null) ?? null,
    priceCents: (r.price_cents as number | null) ?? null,
    consumedSession: Boolean(r.consumed_session),
    cancellationReason: (r.cancellation_reason as string | null) ?? null,
    cancelledAt: (r.cancelled_at as string | null) ?? null,
    createdAt: r.created_at as string,
  }))
}

// ============================================================================
// Instructor blocks (migración 0052)
// ============================================================================

export type InstructorBlockReason = 'vacation' | 'sick' | 'personal' | 'other'

export interface InstructorBlock {
  id: string
  gymId: string
  instructorId: string
  instructorName: string | null
  startsAt: string
  endsAt: string
  reason: InstructorBlockReason
  description: string | null
  recurrenceRule: string | null
  createdAt: string
}

export async function listInstructorBlocksAction(
  gymId: string,
  from: string,
  to: string,
  instructorId?: string
): Promise<InstructorBlock[]> {
  const supabase = await createClient()
  const rpcArgs: {
    p_gym_id: string
    p_from: string
    p_to: string
    p_instructor_id?: string
  } = {
    p_gym_id: gymId,
    p_from: from,
    p_to: to,
  }
  if (instructorId) rpcArgs.p_instructor_id = instructorId
  // RPC creado en migración 0052, tipos regenerados tras merge
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('list_instructor_blocks_in_range', rpcArgs)
  if (error || !data) return []
  const rows = data as Record<string, unknown>[]
  if (rows.length === 0) return []

  const instructorIds = [...new Set(rows.map((r) => r.instructor_id as string))]
  const { data: instructors } = await supabase
    .from('instructors')
    .select('id, name')
    .in('id', instructorIds)
  const nameMap = new Map((instructors ?? []).map((i) => [i.id, i.name]))

  return rows.map((r) => ({
    id: r.id as string,
    gymId: r.gym_id as string,
    instructorId: r.instructor_id as string,
    instructorName: nameMap.get(r.instructor_id as string) ?? null,
    startsAt: r.starts_at as string,
    endsAt: r.ends_at as string,
    reason: r.reason as InstructorBlockReason,
    description: (r.description as string | null) ?? null,
    recurrenceRule: (r.recurrence_rule as string | null) ?? null,
    createdAt: r.created_at as string,
  }))
}

interface CreateInstructorBlockInput {
  instructorId: string
  startsAt: string
  endsAt: string
  reason: InstructorBlockReason
  description?: string | null
  recurrenceRule?: string | null
}

export async function createInstructorBlockAction(
  input: CreateInstructorBlockInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  // RPC creado en migración 0052, tipos regenerados tras merge
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('create_instructor_block', {
    p_instructor_id: input.instructorId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_reason: input.reason,
    p_description: input.description ?? null,
    p_recurrence_rule: input.recurrenceRule ?? null,
  })
  if (error) return { ok: false, error: humanizeError(error.message) }
  if (!data) return { ok: false, error: 'RPC devolvió null' }
  const row = data as unknown as Record<string, unknown>
  revalidatePath('/citas')
  return { ok: true, data: { id: row.id as string } }
}

export async function deleteInstructorBlockAction(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  // RPC creado en migración 0052, tipos regenerados tras merge
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)('delete_instructor_block', { p_id: id })
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidatePath('/citas')
  return { ok: true }
}

// ============================================================================
// Disponibilidad instructor (modal SPLIT Nueva cita — migración 0051)
// ============================================================================

export interface AvailabilitySlot {
  source: 'appointment' | 'class' | 'block'
  refId: string
  startsAt: string
  endsAt: string
  label: string
}

export async function getInstructorAvailabilityAction(
  instructorId: string,
  gymId: string,
  from: string,
  to: string
): Promise<AvailabilitySlot[]> {
  const supabase = await createClient()
  // RPC creado en migración 0051, tipos regenerados tras merge
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('get_instructor_availability', {
    p_instructor_id: instructorId,
    p_gym_id: gymId,
    p_from: from,
    p_to: to,
  })
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map((r) => ({
    source: r.source as 'appointment' | 'class' | 'block',
    refId: r.ref_id as string,
    startsAt: r.starts_at as string,
    endsAt: r.ends_at as string,
    label: (r.label as string) ?? '',
  }))
}

// ============================================================================
// Crear cita
// ============================================================================

interface CreateAppointmentInput {
  memberId: string
  instructorId: string
  roomId?: string | null
  startsAt: string
  endsAt: string
  appointmentType?: AppointmentType
  title?: string | null
  notes?: string | null
  priceCents?: number | null
}

const APPOINTMENT_TYPES = ['personal_training', 'consultation', 'assessment', 'nutrition', 'other'] as const

const createAppointmentSchema = z.object({
  memberId: z.string().trim().uuid('Socio inválido'),
  instructorId: z.string().trim().uuid('Instructor inválido'),
  roomId: z.string().trim().uuid('Sala inválida').nullable().optional(),
  startsAt: z.string().trim().datetime({ offset: true, message: 'Inicio inválido (ISO 8601)' }),
  endsAt: z.string().trim().datetime({ offset: true, message: 'Fin inválido (ISO 8601)' }),
  appointmentType: z
    .string()
    .refine((v) => (APPOINTMENT_TYPES as readonly string[]).includes(v), 'Tipo de cita inválido')
    .optional(),
  title: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  priceCents: z.number().int().min(0).max(10_000_00).nullable().optional(),
})

export async function createAppointmentAction(input: CreateAppointmentInput): Promise<ActionResult<{ id: string }>> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { ok: false, error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const parsed = createAppointmentSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  // Cast: types Supabase marcan args con DEFAULT como required; en runtime Postgres los acepta.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data, error } = await (supabase.rpc as any)('create_appointment', {
    p_member_id: parsed.data.memberId,
    p_instructor_id: parsed.data.instructorId,
    p_room_id: parsed.data.roomId ?? null,
    p_starts_at: parsed.data.startsAt,
    p_ends_at: parsed.data.endsAt,
    p_appointment_type: (parsed.data.appointmentType ?? 'personal_training') as AppointmentType,
    p_title: parsed.data.title ?? null,
    p_notes: parsed.data.notes ?? null,
    p_price_cents: parsed.data.priceCents ?? null,
  })
  /* eslint-enable @typescript-eslint/no-explicit-any */
  if (error) return { ok: false, error: humanizeError(error.message) }
  if (!data) return { ok: false, error: 'Error al crear la cita. Inténtalo de nuevo.' }
  const row = data as unknown as Record<string, unknown>
  revalidatePath('/citas')
  return { ok: true, data: { id: row.id as string } }
}

// ============================================================================
// Cancelar cita (staff)
// ============================================================================

export async function cancelAppointmentAction(id: string, reason?: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_appointment', { p_id: id, p_reason: reason ?? undefined })
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidatePath('/citas')
  return { ok: true }
}

// ============================================================================
// Cancelar cita (socio, desde /mi-cuenta/citas)
// ============================================================================

export async function cancelAppointmentByMemberAction(id: string, reason?: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_appointment_by_member', { p_id: id, p_reason: reason ?? undefined })
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidatePath('/mi-cuenta/citas')
  return { ok: true }
}

// ============================================================================
// Reprogramar cita
// ============================================================================

export async function rescheduleAppointmentAction(
  id: string,
  newStartsAt: string,
  newEndsAt: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('reschedule_appointment', {
    p_id: id,
    p_new_starts_at: newStartsAt,
    p_new_ends_at: newEndsAt,
  })
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidatePath('/citas')
  return { ok: true }
}

// ============================================================================
// Completar cita
// ============================================================================

export async function completeAppointmentAction(id: string, consumeSession = false): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('complete_appointment', {
    p_id: id,
    p_consume_session: consumeSession,
  })
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidatePath('/citas')
  return { ok: true }
}

// ============================================================================
// No-show
// ============================================================================

export async function markNoShowAppointmentAction(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_no_show_appointment', { p_id: id })
  if (error) return { ok: false, error: humanizeError(error.message) }
  revalidatePath('/citas')
  return { ok: true }
}

// ============================================================================
// Helper: humanize Postgres errors
// ============================================================================

function humanizeError(raw: string): string {
  if (raw.includes('el instructor tiene otra cita solapada')) return 'Ese instructor ya tiene una cita en ese horario.'
  if (raw.includes('el instructor tiene un bloqueo')) return 'Ese instructor tiene un bloqueo (vacaciones/enfermedad/personal) en ese horario.'
  if (raw.includes('la sala tiene otra cita solapada')) return 'Esa sala ya está ocupada en ese horario.'
  if (raw.includes('No tienes permiso')) return 'No tienes permiso para esta acción.'
  if (raw.includes('Cancelación bloqueada')) return raw // mensaje ya humanizado
  if (raw.includes('instructor no pertenece')) return 'El instructor no pertenece al gym del socio.'
  if (raw.includes('sala no pertenece')) return 'La sala no pertenece al gym.'
  if (raw.includes('ends_at debe ser posterior')) return 'La hora de fin debe ser posterior a la hora de inicio.'
  // Fallback: log el raw server-side y retorna mensaje genérico al cliente
  // (evita info-disclosure de mensajes Postgres internos como schema/relation).
  console.error('[citas/actions] unhandled error:', raw)
  return 'Error al procesar la cita. Revisa los datos e inténtalo de nuevo.'
}
