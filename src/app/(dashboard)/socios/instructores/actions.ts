'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type InstructorActionState = {
  error?: string
  success?: string
}

export async function savePermissionsAction(
  instructorId: string,
  perms: { key: string; level: number }[]
): Promise<InstructorActionState> {
  if (!instructorId) return { error: 'Falta id del instructor' }
  if (!Array.isArray(perms)) return { error: 'Permisos inválidos' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('bulk_set_instructor_permissions', {
    p_instructor_id: instructorId,
    p_perms: perms,
  })

  if (error) return { error: error.message }

  revalidatePath(`/socios/instructores/${instructorId}`)
  revalidatePath('/socios/instructores')
  return { success: 'Permisos guardados' }
}

export async function saveNotificationPrefsAction(
  instructorId: string,
  prefs: { category: string; delivery: 'none' | 'email' | 'push' | 'both' }[]
): Promise<InstructorActionState> {
  if (!instructorId) return { error: 'Falta id del instructor' }
  if (!Array.isArray(prefs)) return { error: 'Preferencias inválidas' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('bulk_set_instructor_notif_prefs', {
    p_instructor_id: instructorId,
    p_prefs: prefs,
  })

  if (error) return { error: error.message }

  revalidatePath(`/socios/instructores/${instructorId}`)
  return { success: 'Preferencias guardadas' }
}

export async function updateInstructorProfileAction(
  instructorId: string,
  formData: FormData
): Promise<InstructorActionState> {
  if (!instructorId) return { error: 'Falta id del instructor' }

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'El nombre es obligatorio' }

  const colorRaw = String(formData.get('color') ?? '').trim() || '#3b8bea'
  const color = /^#[0-9a-fA-F]{6}$/.test(colorRaw) ? colorRaw : '#3b8bea'

  const specialtiesRaw = String(formData.get('specialties') ?? '').trim()
  const specialties = specialtiesRaw
    ? specialtiesRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const isActive = String(formData.get('is_active') ?? 'true') === 'true'

  const payload = {
    name,
    email: String(formData.get('email') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    bio: String(formData.get('bio') ?? '').trim() || null,
    color,
    specialties,
    is_active: isActive,
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('instructors')
    .update(payload)
    .eq('id', instructorId)

  if (error) return { error: error.message }

  revalidatePath(`/socios/instructores/${instructorId}`)
  revalidatePath('/socios/instructores')
  return { success: 'Datos guardados' }
}
