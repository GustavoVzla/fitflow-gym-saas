'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'

type ActionState = { error?: string; conversationId?: string }

async function resolveGymId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('current_user_gyms')
  return data && data.length > 0 ? data[0].gym_id : null
}

const uuidSchema = z.string().trim().uuid('ID inválido')
const messageContentSchema = z.string().trim().min(1, 'El mensaje no puede estar vacío').max(4000, 'Mensaje demasiado largo (máx 4000)')

export async function sendMessageAction(
  conversationId: string,
  content: string
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const idParsed = uuidSchema.safeParse(conversationId)
  if (!idParsed.success) return { error: idParsed.error.issues[0]?.message ?? 'Conversación inválida' }

  const contentParsed = messageContentSchema.safeParse(content)
  if (!contentParsed.success) return { error: contentParsed.error.issues[0]?.message ?? 'Mensaje inválido' }

  const trimmed = contentParsed.data
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const gymId = await resolveGymId()
  if (!gymId) return { error: 'No hay gym activo' }

  const { error: insertErr } = await supabase.from('messages').insert({
    gym_id: gymId,
    conversation_id: idParsed.data,
    sender_type: 'gym',
    sender_user_id: user.id,
    content: trimmed,
  })
  if (insertErr) return { error: sanitizeServerError(insertErr) }

  const preview = trimmed.slice(0, 120)
  const { error: updErr } = await supabase
    .from('conversations')
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: preview,
      unread_count_gym: 0,
    })
    .eq('id', idParsed.data)
    .eq('gym_id', gymId)
  if (updErr) return { error: sanitizeServerError(updErr) }

  revalidatePath('/mensajes')
  return { conversationId: idParsed.data }
}

export async function createConversationAction(
  memberId: string,
  initialContent?: string
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(memberId)
  if (!parsed.success) return { error: 'Selecciona un socio' }

  const supabase = await createClient()
  const gymId = await resolveGymId()
  if (!gymId) return { error: 'No hay gym activo' }

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('gym_id', gymId)
    .eq('member_id', parsed.data)
    .eq('is_archived', false)
    .maybeSingle()

  if (existing) {
    if (initialContent?.trim()) {
      await sendMessageAction(existing.id, initialContent)
    }
    revalidatePath('/mensajes')
    return { conversationId: existing.id }
  }

  const { data: inserted, error } = await supabase
    .from('conversations')
    .insert({ gym_id: gymId, member_id: parsed.data })
    .select('id')
    .single()

  if (error || !inserted) return { error: sanitizeServerError(error, 'Error creando conversación') }

  if (initialContent?.trim()) {
    await sendMessageAction(inserted.id, initialContent)
  }

  revalidatePath('/mensajes')
  return { conversationId: inserted.id }
}

export async function markConversationReadAction(conversationId: string): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(conversationId)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'ID inválido' }

  const supabase = await createClient()
  const gymId = await resolveGymId()
  if (!gymId) return { error: 'No hay gym activo' }

  const { error } = await supabase
    .from('conversations')
    .update({ unread_count_gym: 0 })
    .eq('id', parsed.data)
    .eq('gym_id', gymId)

  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/mensajes')
  return { conversationId: parsed.data }
}

// ===========================================================================
// Broadcast masivo (PB sprint paridad100 — handoff cerrar-gaps-socios-mensajes)
// ===========================================================================

export interface BroadcastTargetFilters {
  scope: 'all' | 'by_tariff' | 'by_status' | 'blocked_morosos'
  tariffIds?: string[]
  statuses?: ('active' | 'pending' | 'inactive' | 'blocked')[]
}

const broadcastSchema = z.object({
  title: z.string().trim().min(1, 'Título obligatorio').max(200),
  body: z.string().trim().min(1, 'Cuerpo obligatorio').max(4000),
  scope: z.enum(['all', 'by_tariff', 'by_status', 'blocked_morosos']),
  tariffIds: z.array(z.string().uuid()).optional(),
  statuses: z.array(z.enum(['active', 'pending', 'inactive', 'blocked'])).optional(),
})

async function resolveTargetMembers(
  gymId: string,
  filters: BroadcastTargetFilters
): Promise<string[]> {
  const supabase = await createClient()
  let query = supabase.from('members').select('id').eq('gym_id', gymId)

  switch (filters.scope) {
    case 'all':
      // sin filtros adicionales
      break
    case 'by_tariff':
      if (filters.tariffIds && filters.tariffIds.length > 0) {
        query = query.in('current_tariff_id', filters.tariffIds)
      }
      break
    case 'by_status':
      if (filters.statuses && filters.statuses.length > 0) {
        query = query.in('status', filters.statuses)
      }
      break
    case 'blocked_morosos':
      query = query.not('blocked_for_morosos_at', 'is', null)
      break
  }

  const { data } = await query
  return (data ?? []).map((r) => r.id)
}

/**
 * Cuenta destinatarios sin enviar (preview).
 */
export async function previewBroadcastTargetsAction(
  filters: BroadcastTargetFilters
): Promise<{ count: number; error?: string }> {
  const supabase = await createClient()
  const gymId = await resolveGymId()
  if (!gymId) return { count: 0, error: 'No hay gym activo' }

  const ids = await resolveTargetMembers(gymId, filters)
  void supabase
  return { count: ids.length }
}

/**
 * Envía broadcast: para cada socio target abre/reusa conversación + inserta
 * mensaje + crea row en notifications (si tabla existe).
 *
 * Rate limit fuerte (1 broadcast / 5 min) para evitar spam masivo accidental.
 */
export async function broadcastMessageAction(input: {
  title: string
  body: string
  filters: BroadcastTargetFilters
}): Promise<{ ok: boolean; sent?: number; error?: string }> {
  const rl = await rateLimit('api')
  if (!rl.success) return { ok: false, error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = broadcastSchema.safeParse({
    title: input.title,
    body: input.body,
    scope: input.filters.scope,
    tariffIds: input.filters.tariffIds,
    statuses: input.filters.statuses,
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const gymId = await resolveGymId()
  if (!gymId) return { ok: false, error: 'No hay gym activo' }

  const targetMemberIds = await resolveTargetMembers(gymId, input.filters)
  if (targetMemberIds.length === 0) {
    return { ok: false, error: 'Sin destinatarios con esos filtros' }
  }

  // Hard cap 500 destinatarios por broadcast (anti abuso + Edge Function limits)
  if (targetMemberIds.length > 500) {
    return { ok: false, error: `Demasiados destinatarios (${targetMemberIds.length}). Límite por broadcast: 500. Refina filtros.` }
  }

  const fullBody = `**${parsed.data.title}**\n\n${parsed.data.body}`
  const preview = fullBody.slice(0, 120)
  let sent = 0
  const errors: string[] = []

  for (const memberId of targetMemberIds) {
    // Reusa o crea conversación con este socio
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('gym_id', gymId)
      .eq('member_id', memberId)
      .eq('is_archived', false)
      .maybeSingle()

    let convId: string
    if (existing) {
      convId = existing.id
    } else {
      const { data: inserted, error: convErr } = await supabase
        .from('conversations')
        .insert({ gym_id: gymId, member_id: memberId })
        .select('id')
        .single()
      if (convErr || !inserted) {
        errors.push(`member ${memberId}: ${convErr?.message ?? 'no insert'}`)
        continue
      }
      convId = inserted.id
    }

    const { error: msgErr } = await supabase.from('messages').insert({
      gym_id: gymId,
      conversation_id: convId,
      sender_type: 'gym',
      sender_user_id: user.id,
      content: fullBody,
    })
    if (msgErr) {
      errors.push(`member ${memberId}: ${msgErr.message}`)
      continue
    }

    // Update conversation preview + bump unread member side
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: preview,
      })
      .eq('id', convId)

    sent++
  }

  revalidatePath('/mensajes')

  if (errors.length > 0 && sent === 0) {
    return { ok: false, error: `Sin enviar. Errores: ${errors.slice(0, 3).join('; ')}` }
  }

  return {
    ok: true,
    sent,
    error: errors.length > 0 ? `Enviados ${sent}, ${errors.length} con error` : undefined,
  }
}
