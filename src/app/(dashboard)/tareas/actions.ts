'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'
import type { DbTaskPriority, DbTaskRecurrence } from './types'
import {
  PRIORITY_REVERSE_MAP,
  RECURRENCE_REVERSE_MAP,
  type UiPriority,
  type UiRecurrence,
} from './types'

const uuidSchema = z.string().trim().uuid('ID inválido')

export type TaskActionState = {
  error?: string
  success?: string
}

async function resolveActiveGymId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('current_user_gyms')
  return data && data.length > 0 ? data[0].gym_id : null
}

const VALID_UI_PRIORITIES: UiPriority[] = ['Urgente', 'Alta', 'Media', 'Baja']
const VALID_UI_RECURRENCE: UiRecurrence[] = ['Ninguna', 'Diaria', 'Semanal', 'Mensual']

function parseCommonFields(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  const priorityRaw = String(formData.get('priority') ?? 'Media')
  const dueDate = String(formData.get('dueDate') ?? '').trim() || null
  const memberId = String(formData.get('memberId') ?? '').trim() || null
  const instructorId = String(formData.get('instructorId') ?? '').trim() || null
  const phone = String(formData.get('phone') ?? '').trim() || null
  const assignedTo = String(formData.get('assignedTo') ?? '').trim() || null
  const relatedPaymentId = String(formData.get('relatedPaymentId') ?? '').trim() || null
  const recurrenceRaw = String(formData.get('recurrenceType') ?? 'Ninguna')
  const recurrenceIntervalRaw = String(formData.get('recurrenceInterval') ?? '').trim()
  const recurrenceEndDate = String(formData.get('recurrenceEndDate') ?? '').trim() || null

  return {
    title,
    description,
    priorityRaw,
    dueDate,
    memberId,
    instructorId,
    phone,
    assignedTo,
    relatedPaymentId,
    recurrenceRaw,
    recurrenceIntervalRaw,
    recurrenceEndDate,
  }
}

function validateCommon(fields: ReturnType<typeof parseCommonFields>): {
  error?: string
  priority?: DbTaskPriority
  recurrenceType?: DbTaskRecurrence
  recurrenceInterval?: number | null
} {
  if (!fields.title) return { error: 'El título es obligatorio' }
  if (fields.title.length > 200) return { error: 'Título demasiado largo (máx 200 caracteres)' }

  if (!VALID_UI_PRIORITIES.includes(fields.priorityRaw as UiPriority)) {
    return { error: 'Prioridad inválida' }
  }
  const priority: DbTaskPriority = PRIORITY_REVERSE_MAP[fields.priorityRaw as UiPriority]

  if (!VALID_UI_RECURRENCE.includes(fields.recurrenceRaw as UiRecurrence)) {
    return { error: 'Recurrencia inválida' }
  }
  const recurrenceType: DbTaskRecurrence =
    RECURRENCE_REVERSE_MAP[fields.recurrenceRaw as UiRecurrence]

  let recurrenceInterval: number | null = null
  if (recurrenceType !== 'none') {
    const n = Number(fields.recurrenceIntervalRaw || '1')
    if (!Number.isFinite(n) || n < 1 || n > 365) {
      return { error: 'Intervalo recurrencia debe ser entre 1 y 365' }
    }
    recurrenceInterval = Math.trunc(n)
  }

  return { priority, recurrenceType, recurrenceInterval }
}

export async function createTaskAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const fields = parseCommonFields(formData)
  const check = validateCommon(fields)
  if (check.error) return { error: check.error }

  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo en la sesión' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('tasks').insert({
    gym_id: gymId,
    title: fields.title,
    description: fields.description,
    priority: check.priority!,
    status: 'todo',
    due_date: fields.dueDate,
    member_id: fields.memberId,
    instructor_id: fields.instructorId,
    phone: fields.phone,
    assigned_to: fields.assignedTo,
    related_payment_id: fields.relatedPaymentId,
    recurrence_type: check.recurrenceType!,
    recurrence_interval: check.recurrenceInterval,
    recurrence_end_date: fields.recurrenceEndDate,
    created_by: user?.id ?? null,
  })

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/tareas')
  return { success: 'Tarea creada' }
}

export async function updateTaskAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const idParsed = uuidSchema.safeParse(String(formData.get('id') ?? ''))
  if (!idParsed.success) return { error: 'ID inválido' }

  const fields = parseCommonFields(formData)
  const check = validateCommon(fields)
  if (check.error) return { error: check.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('tasks')
    .update({
      title: fields.title,
      description: fields.description,
      priority: check.priority!,
      due_date: fields.dueDate,
      member_id: fields.memberId,
      instructor_id: fields.instructorId,
      phone: fields.phone,
      assigned_to: fields.assignedTo,
      related_payment_id: fields.relatedPaymentId,
      recurrence_type: check.recurrenceType!,
      recurrence_interval: check.recurrenceInterval,
      recurrence_end_date: fields.recurrenceEndDate,
    })
    .eq('id', idParsed.data)

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/tareas')
  return { success: 'Tarea actualizada' }
}

export async function toggleTaskCompleteAction(
  id: string,
  completed: boolean,
): Promise<TaskActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('tasks')
    .update({
      status: completed ? 'done' : 'todo',
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', parsed.data)

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/tareas')
  return { success: completed ? 'Tarea completada' : 'Tarea reabierta' }
}

export async function archiveTaskAction(id: string): Promise<TaskActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase.from('tasks').update({ status: 'archived' }).eq('id', parsed.data)

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/tareas')
  return { success: 'Tarea archivada' }
}
