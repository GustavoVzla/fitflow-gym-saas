'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TriggerType, Channel } from './types'

type ActionResult = { error?: string; success?: string; id?: string }

const VALID_TRIGGERS: TriggerType[] = [
  'welcome',
  'payment_due',
  'payment_overdue',
  'birthday',
  'booking_reminder',
  'booking_cancelled',
  'membership_expiring',
  'no_attendance',
]

const VALID_CHANNELS: Channel[] = ['email', 'sms', 'whatsapp', 'in_app']

async function resolveGymId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('current_user_gyms')
  return data && data.length > 0 ? data[0].gym_id : null
}

export async function createAvisoTemplateAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get('name') ?? '').trim()
  const triggerType = String(formData.get('triggerType') ?? '') as TriggerType
  const triggerValueRaw = String(formData.get('triggerValue') ?? '').trim()
  const channel = String(formData.get('channel') ?? 'in_app') as Channel
  const subject = String(formData.get('subject') ?? '').trim() || null
  const messageTemplate = String(formData.get('messageTemplate') ?? '').trim()
  const sendOffsetMinutes = Number(formData.get('sendOffsetMinutes') ?? 0)

  if (!name) return { error: 'El nombre es obligatorio' }
  if (name.length > 120) return { error: 'Nombre demasiado largo (máx 120)' }
  if (!messageTemplate) return { error: 'La plantilla es obligatoria' }
  if (messageTemplate.length > 4000) return { error: 'Plantilla demasiado larga (máx 4000)' }
  if (!VALID_TRIGGERS.includes(triggerType)) return { error: 'Disparador inválido' }
  if (!VALID_CHANNELS.includes(channel)) return { error: 'Canal inválido' }
  if (channel === 'email' && !subject) return { error: 'El asunto es obligatorio para email' }
  if (!Number.isFinite(sendOffsetMinutes)) return { error: 'Offset inválido' }

  const triggerValue = triggerValueRaw === '' ? null : Number(triggerValueRaw)
  if (triggerValue !== null && !Number.isFinite(triggerValue)) {
    return { error: 'Valor numérico inválido' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const gymId = await resolveGymId()
  if (!gymId) return { error: 'No hay gym activo' }

  const { data, error } = await supabase
    .from('engagement_alerts')
    .insert({
      gym_id: gymId,
      name,
      trigger_type: triggerType,
      trigger_value: triggerValue,
      channel,
      subject,
      message_template: messageTemplate,
      send_offset_minutes: sendOffsetMinutes,
      is_active: true,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !data) return { error: error?.message ?? 'Error al crear la plantilla' }

  revalidatePath('/configuracion/avisos')
  revalidatePath('/fidelizacion')
  return { success: 'Plantilla creada', id: data.id }
}

export async function updateAvisoTemplateAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'ID requerido' }

  const name = String(formData.get('name') ?? '').trim()
  const subject = String(formData.get('subject') ?? '').trim() || null
  const messageTemplate = String(formData.get('messageTemplate') ?? '').trim()
  const sendOffsetMinutes = Number(formData.get('sendOffsetMinutes') ?? 0)
  const channel = String(formData.get('channel') ?? 'in_app') as Channel

  if (!name) return { error: 'El nombre es obligatorio' }
  if (!messageTemplate) return { error: 'La plantilla es obligatoria' }
  if (!VALID_CHANNELS.includes(channel)) return { error: 'Canal inválido' }
  if (channel === 'email' && !subject) return { error: 'El asunto es obligatorio para email' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('engagement_alerts')
    .update({
      name,
      channel,
      subject,
      message_template: messageTemplate,
      send_offset_minutes: sendOffsetMinutes,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/configuracion/avisos')
  revalidatePath('/fidelizacion')
  return { success: 'Plantilla guardada' }
}

export async function toggleAvisoTemplateAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  if (!id) return { error: 'ID requerido' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('engagement_alerts')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/configuracion/avisos')
  revalidatePath('/fidelizacion')
  return { success: isActive ? 'Plantilla activada' : 'Plantilla pausada' }
}

export async function deleteAvisoTemplateAction(id: string): Promise<ActionResult> {
  if (!id) return { error: 'ID requerido' }
  const supabase = await createClient()
  const { error } = await supabase.from('engagement_alerts').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/configuracion/avisos')
  revalidatePath('/fidelizacion')
  return { success: 'Plantilla eliminada' }
}

export async function createFromRecommendedAction(
  name: string,
  triggerType: TriggerType,
  triggerValue: number | null,
  channel: Channel,
  subject: string | null,
  messageTemplate: string,
  sendOffsetMinutes: number,
): Promise<ActionResult> {
  const fd = new FormData()
  fd.set('name', name)
  fd.set('triggerType', triggerType)
  fd.set('triggerValue', triggerValue === null ? '' : String(triggerValue))
  fd.set('channel', channel)
  fd.set('subject', subject ?? '')
  fd.set('messageTemplate', messageTemplate)
  fd.set('sendOffsetMinutes', String(sendOffsetMinutes))
  return createAvisoTemplateAction({}, fd)
}
