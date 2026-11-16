'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'
import { slugify } from './types'

const uuidSchema = z.string().trim().uuid('ID inválido')

export type CompActionState = { error?: string; success?: string; slug?: string }

async function resolveActiveGymId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('current_user_gyms')
  return data && data.length > 0 ? data[0].gym_id : null
}

interface CompetitionPayload {
  name: string
  description: string | null
  start_date: string
  end_date: string
  type: string | null
  slug: string | null
  cover_image_url: string | null
  conditions: string | null
  online_registration_enabled: boolean
  price_cents: number | null
  tax_percent: number | null
  max_registrations: number | null
  waitlist_enabled: boolean
  categories: string[]
  contact_email: string | null
  contact_phone: string | null
  location_address: string | null
  latitude: number | null
  longitude: number | null
}

function parseAndValidate(
  formData: FormData
): { error: string } | CompetitionPayload {
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  const startDate = String(formData.get('startDate') ?? '').trim()
  const endDate = String(formData.get('endDate') ?? '').trim()
  const type = String(formData.get('type') ?? '').trim() || null

  // Sección 1 extra: slug + cover + conditions
  const slugRaw = String(formData.get('slug') ?? '').trim()
  const slug = slugRaw ? slugify(slugRaw) : null
  const coverImageUrl = String(formData.get('coverImageUrl') ?? '').trim() || null
  const conditions = String(formData.get('conditions') ?? '').trim() || null

  // Sección 2: inscripción online
  const onlineRegistrationEnabled = formData.get('onlineRegistrationEnabled') === 'on' || formData.get('onlineRegistrationEnabled') === 'true'
  const priceStr = String(formData.get('priceCents') ?? '').trim()
  const taxStr = String(formData.get('taxPercent') ?? '').trim()
  const maxStr = String(formData.get('maxRegistrations') ?? '').trim()
  const waitlistEnabled = formData.get('waitlistEnabled') === 'on' || formData.get('waitlistEnabled') === 'true'
  const categoriesRaw = String(formData.get('categories') ?? '').trim()

  // Sección 3: contacto + ubicación
  const contactEmail = String(formData.get('contactEmail') ?? '').trim() || null
  const contactPhone = String(formData.get('contactPhone') ?? '').trim() || null
  const locationAddress = String(formData.get('locationAddress') ?? '').trim() || null
  const latStr = String(formData.get('latitude') ?? '').trim()
  const lngStr = String(formData.get('longitude') ?? '').trim()

  // Validaciones obligatorias
  if (!name) return { error: 'El nombre es obligatorio' }
  if (name.length > 200) return { error: 'Nombre demasiado largo (máx 200)' }
  if (!startDate) return { error: 'Fecha de inicio obligatoria' }
  if (!endDate) return { error: 'Fecha de fin obligatoria' }
  if (endDate < startDate) return { error: 'La fecha de fin no puede ser anterior a la de inicio' }

  // Price
  let priceCents: number | null = null
  if (priceStr) {
    const eurosNum = Number(priceStr.replace(',', '.'))
    if (!Number.isFinite(eurosNum) || eurosNum < 0) return { error: 'Precio inválido' }
    priceCents = Math.round(eurosNum * 100)
  }

  // Tax
  let taxPercent: number | null = null
  if (taxStr) {
    const n = Number(taxStr.replace(',', '.'))
    if (!Number.isFinite(n) || n < 0 || n > 100) return { error: 'IVA inválido (0-100)' }
    taxPercent = n
  }

  // Max registrations
  let maxRegistrations: number | null = null
  if (maxStr) {
    const n = Number(maxStr)
    if (!Number.isInteger(n) || n < 1) return { error: 'Límite de inscripciones inválido' }
    maxRegistrations = n
  }

  // Categories (separadas por coma)
  const categories: string[] = categoriesRaw
    ? categoriesRaw.split(',').map((c) => c.trim()).filter(Boolean)
    : []

  // Contact email regex básica (backend hace CHECK adicional)
  if (contactEmail && !/^[^@]+@[^@]+\.[^@]+$/.test(contactEmail)) {
    return { error: 'Email de contacto inválido' }
  }

  // Geo coordinates
  let latitude: number | null = null
  let longitude: number | null = null
  if (latStr) {
    const n = Number(latStr.replace(',', '.'))
    if (!Number.isFinite(n) || n < -90 || n > 90) return { error: 'Latitud inválida (-90 a 90)' }
    latitude = n
  }
  if (lngStr) {
    const n = Number(lngStr.replace(',', '.'))
    if (!Number.isFinite(n) || n < -180 || n > 180) return { error: 'Longitud inválida (-180 a 180)' }
    longitude = n
  }

  // Si inscripción online activa, obligar max_registrations + precio (o explícitamente gratis)
  if (onlineRegistrationEnabled) {
    if (!slug) return { error: 'Si activas inscripción online, el slug público es obligatorio' }
  }

  return {
    name,
    description,
    start_date: startDate,
    end_date: endDate,
    type,
    slug,
    cover_image_url: coverImageUrl,
    conditions,
    online_registration_enabled: onlineRegistrationEnabled,
    price_cents: priceCents,
    tax_percent: taxPercent,
    max_registrations: maxRegistrations,
    waitlist_enabled: waitlistEnabled,
    categories,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    location_address: locationAddress,
    latitude,
    longitude,
  }
}

export async function createCompetitionAction(
  _prev: CompActionState,
  formData: FormData
): Promise<CompActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const result = parseAndValidate(formData)
  if ('error' in result) return { error: result.error }

  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo en la sesión' }

  const supabase = await createClient()
  // Columnas 0067 pueden no estar en tipos generados aún
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('competitions') as any).insert({
    gym_id: gymId,
    ...result,
    is_active: true,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: `El slug "${result.slug}" ya está en uso en este gym` }
    }
    return { error: sanitizeServerError(error) }
  }

  revalidatePath('/competiciones')
  return { success: 'Competición creada', slug: result.slug ?? undefined }
}

export async function updateCompetitionAction(
  _prev: CompActionState,
  formData: FormData
): Promise<CompActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const idParsed = uuidSchema.safeParse(String(formData.get('id') ?? ''))
  if (!idParsed.success) return { error: 'ID inválido' }

  const result = parseAndValidate(formData)
  if ('error' in result) return { error: result.error }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('competitions') as any)
    .update(result)
    .eq('id', idParsed.data)

  if (error) {
    if (error.code === '23505') {
      return { error: `El slug "${result.slug}" ya está en uso en este gym` }
    }
    return { error: sanitizeServerError(error) }
  }

  revalidatePath('/competiciones')
  return { success: 'Competición actualizada', slug: result.slug ?? undefined }
}

export async function toggleCompetitionActiveAction(
  id: string,
  isActive: boolean
): Promise<CompActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('competitions')
    .update({ is_active: isActive })
    .eq('id', parsed.data)

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/competiciones')
  return { success: isActive ? 'Competición activada' : 'Competición desactivada' }
}
