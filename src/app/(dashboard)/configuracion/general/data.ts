import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_SETTINGS, type SettingsGeneral } from './types'

export async function getSettingsGeneral(): Promise<{
  gymId: string
  settings: SettingsGeneral
} | null> {
  const supabase = await createClient()
  const { data: gyms } = await supabase.rpc('current_user_gyms')
  if (!gyms || gyms.length === 0) return null

  const gymId = gyms[0].gym_id

  const { data, error } = await supabase
    .from('gyms')
    .select('id, settings_general')
    .eq('id', gymId)
    .single()

  if (error || !data) return null

  // Merge con DEFAULT_SETTINGS para tolerar shape incompleto (migraciones anteriores).
  const raw = (data.settings_general ?? {}) as Partial<SettingsGeneral>
  const settings: SettingsGeneral = {
    reservas: { ...DEFAULT_SETTINGS.reservas, ...(raw.reservas ?? {}) },
    visibilidad: { ...DEFAULT_SETTINGS.visibilidad, ...(raw.visibilidad ?? {}) },
    calendario: { ...DEFAULT_SETTINGS.calendario, ...(raw.calendario ?? {}) },
    login: { ...DEFAULT_SETTINGS.login, ...(raw.login ?? {}) },
    factura: { ...DEFAULT_SETTINGS.factura, ...(raw.factura ?? {}) },
    notificaciones: { ...DEFAULT_SETTINGS.notificaciones, ...(raw.notificaciones ?? {}) },
    privacidad: { ...DEFAULT_SETTINGS.privacidad, ...(raw.privacidad ?? {}) },
  }

  return { gymId: data.id, settings }
}
