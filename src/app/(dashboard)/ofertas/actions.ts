'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'
import type { DbDiscountType, OfferTargetAudience } from './types'
import { DISCOUNT_TYPE_DB_MAP, type UiDiscountType } from './types'

const uuidSchema = z.string().trim().uuid('ID inválido')

export type OfferActionState = {
  error?: string
  success?: string
}

async function resolveActiveGymId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('current_user_gyms')
  return data && data.length > 0 ? data[0].gym_id : null
}

const VALID_UI_TYPES: UiDiscountType[] = ['Porcentaje', 'Cantidad fija', 'Prueba gratis']
const VALID_AUDIENCES: OfferTargetAudience[] = ['all', 'active', 'new', 'churned']

function parseFormFields(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  const discountTypeUi = String(formData.get('discountType') ?? '').trim()
  const discountValueStr = String(formData.get('discountValue') ?? '').trim()
  const validFrom = String(formData.get('validFrom') ?? '').trim() || null
  const validUntil = String(formData.get('validUntil') ?? '').trim() || null
  const maxRedemptionsStr = String(formData.get('maxRedemptions') ?? '').trim()
  const code = String(formData.get('code') ?? '').trim().toUpperCase() || null
  const targetAudienceRaw = String(formData.get('targetAudience') ?? 'all').trim()
  // tariffIds viene como CSV de uuids (FormData no soporta arrays nativos bien)
  const tariffIdsCsv = String(formData.get('applicableTariffIds') ?? '').trim()

  return {
    title,
    description,
    discountTypeUi,
    discountValueStr,
    validFrom,
    validUntil,
    maxRedemptionsStr,
    code,
    targetAudienceRaw,
    tariffIdsCsv,
  }
}

function validateAndNormalize(fields: ReturnType<typeof parseFormFields>):
  | { error: string }
  | {
      title: string
      description: string | null
      discount_type: DbDiscountType | null
      discount_value: number | null
      valid_from: string | null
      valid_until: string | null
      max_redemptions: number | null
      code: string | null
      target_audience: OfferTargetAudience
      applicable_tariff_ids: string[]
    } {
  const {
    title,
    description,
    discountTypeUi,
    discountValueStr,
    validFrom,
    validUntil,
    maxRedemptionsStr,
    code,
    targetAudienceRaw,
    tariffIdsCsv,
  } = fields

  if (!title) return { error: 'El título es obligatorio' }
  if (title.length > 200) return { error: 'Título demasiado largo (máx 200)' }

  let discount_type: DbDiscountType | null = null
  let discount_value: number | null = null

  if (discountTypeUi) {
    if (!VALID_UI_TYPES.includes(discountTypeUi as UiDiscountType)) {
      return { error: 'Tipo de descuento inválido' }
    }
    discount_type = DISCOUNT_TYPE_DB_MAP[discountTypeUi as UiDiscountType]

    if (discount_type !== 'free_trial') {
      const n = Number(discountValueStr.replace(',', '.'))
      if (!Number.isFinite(n) || n < 0) return { error: 'Valor del descuento inválido' }
      if (discount_type === 'percentage' && n > 100) return { error: 'Porcentaje máximo 100' }
      discount_value = n
    }
  }

  if (validFrom && validUntil && validFrom > validUntil) {
    return { error: 'La fecha "desde" no puede ser posterior a "hasta"' }
  }

  let max_redemptions: number | null = null
  if (maxRedemptionsStr) {
    const n = Number(maxRedemptionsStr)
    if (!Number.isInteger(n) || n < 1) return { error: 'Límite de usos inválido' }
    max_redemptions = n
  }

  let normalizedCode = code
  if (normalizedCode && !/^[A-Z0-9_-]{2,30}$/.test(normalizedCode)) {
    return { error: 'Código inválido: 2-30 caracteres, solo letras mayúsculas, números, guion y guion bajo' }
  }

  // Target audience
  const target_audience: OfferTargetAudience = VALID_AUDIENCES.includes(
    targetAudienceRaw as OfferTargetAudience
  )
    ? (targetAudienceRaw as OfferTargetAudience)
    : 'all'

  // Applicable tariff ids (CSV → uuid[])
  const applicable_tariff_ids: string[] = tariffIdsCsv
    ? tariffIdsCsv
        .split(',')
        .map((s) => s.trim())
        .filter((s) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
        )
    : []

  return {
    title,
    description,
    discount_type,
    discount_value,
    valid_from: validFrom,
    valid_until: validUntil,
    max_redemptions,
    code: normalizedCode,
    target_audience,
    applicable_tariff_ids,
  }
}

export async function createOfferAction(
  _prev: OfferActionState,
  formData: FormData
): Promise<OfferActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const fields = parseFormFields(formData)
  const result = validateAndNormalize(fields)
  if ('error' in result) return { error: result.error }

  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo en la sesión' }

  const supabase = await createClient()
  // target_audience (0071) no está en tipos generados aún
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('offers') as any).insert({
    gym_id: gymId,
    ...result,
    is_active: true,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: `El código "${result.code}" ya está en uso en este gym` }
    }
    return { error: sanitizeServerError(error) }
  }

  revalidatePath('/ofertas')
  return { success: 'Oferta creada' }
}

export async function updateOfferAction(
  _prev: OfferActionState,
  formData: FormData
): Promise<OfferActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const idParsed = uuidSchema.safeParse(String(formData.get('id') ?? ''))
  if (!idParsed.success) return { error: 'ID inválido' }

  const fields = parseFormFields(formData)
  const result = validateAndNormalize(fields)
  if ('error' in result) return { error: result.error }

  const supabase = await createClient()
  // target_audience (0071) no está en tipos generados aún
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('offers') as any).update(result).eq('id', idParsed.data)

  if (error) {
    if (error.code === '23505') {
      return { error: `El código "${result.code}" ya está en uso en este gym` }
    }
    return { error: sanitizeServerError(error) }
  }

  revalidatePath('/ofertas')
  return { success: 'Oferta actualizada' }
}

export async function toggleOfferActiveAction(
  id: string,
  isActive: boolean
): Promise<OfferActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('offers')
    .update({ is_active: isActive })
    .eq('id', parsed.data)

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/ofertas')
  return { success: isActive ? 'Oferta activada' : 'Oferta desactivada' }
}
