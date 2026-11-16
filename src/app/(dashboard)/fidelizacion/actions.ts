'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'

type ActionState = { error?: string; success?: string; id?: string }

async function resolveGymId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('current_user_gyms')
  return data && data.length > 0 ? data[0].gym_id : null
}

const TRIGGER_TYPES = ['no_attendance_x_days', 'birthday', 'subscription_expires_x_days'] as const
const CHANNELS = ['email', 'message'] as const

const createAlertSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  triggerType: z.string().refine(
    (v) => (TRIGGER_TYPES as readonly string[]).includes(v),
    'Tipo de disparador inválido'
  ),
  triggerValue: z.string().refine(
    (v) => {
      const n = Number(v)
      return Number.isFinite(n) && n >= 0 && n <= 3650
    },
    'Valor de disparador inválido'
  ).optional(),
  channel: z.string().refine(
    (v) => (CHANNELS as readonly string[]).includes(v),
    'Canal inválido'
  ),
  messageTemplate: z.string().trim().min(1, 'La plantilla de mensaje es obligatoria').max(2000),
})

const uuidSchema = z.string().trim().uuid('ID inválido')

export async function createAlertAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = createAlertSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const gymId = await resolveGymId()
  if (!gymId) return { error: 'No hay gym activo' }

  const triggerType = parsed.data.triggerType
  const triggerValue = triggerType === 'birthday' ? null : Number(parsed.data.triggerValue ?? 0)

  const { data, error } = await supabase
    .from('engagement_alerts')
    .insert({
      gym_id: gymId,
      name: parsed.data.name,
      trigger_type: triggerType,
      trigger_value: triggerValue,
      channel: parsed.data.channel,
      message_template: parsed.data.messageTemplate,
      is_active: true,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !data) return { error: sanitizeServerError(error, 'Error al crear el aviso') }

  revalidatePath('/fidelizacion')
  return { success: 'Aviso creado', id: data.id }
}

export async function toggleAlertAction(id: string, isActive: boolean): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'ID requerido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('engagement_alerts')
    .update({ is_active: isActive })
    .eq('id', parsed.data)
  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/fidelizacion')
  return { success: isActive ? 'Aviso activado' : 'Aviso pausado' }
}

export async function deleteAlertAction(id: string): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'ID requerido' }

  const supabase = await createClient()
  const { error } = await supabase.from('engagement_alerts').delete().eq('id', parsed.data)
  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/fidelizacion')
  return { success: 'Aviso eliminado' }
}
