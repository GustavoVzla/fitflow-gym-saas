import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { OfferRow, DbDiscountType, OfferTargetAudience } from './types'
import {
  AUDIENCE_LABELS,
  computeDiscountLabel,
  computeValidityLabel,
  computeStatus,
  computeRedemptionsLabel,
} from './types'

export type { OfferRow, DbDiscountType } from './types'

export interface TariffOption {
  id: string
  name: string
}

export const getOffers = cache(async (): Promise<OfferRow[]> => {
  const supabase = await createClient()

  // select * para leer columnas 0071 (target_audience + applicable_tariff_ids)
  // sin depender de regeneración de types. Cast any localizado.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('offers') as any)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getOffers] error:', error)
    return []
  }

  // Fetch tariff names para mostrar etiqueta human-friendly
  const tariffIdSet = new Set<string>()
  ;((data ?? []) as Record<string, unknown>[]).forEach((o) => {
    const ids = Array.isArray(o.applicable_tariff_ids) ? (o.applicable_tariff_ids as string[]) : []
    ids.forEach((id) => tariffIdSet.add(id))
  })

  const tariffIds = Array.from(tariffIdSet)
  const tariffNameById = new Map<string, string>()
  if (tariffIds.length > 0) {
    const { data: tariffs } = await supabase
      .from('tariffs')
      .select('id, name')
      .in('id', tariffIds)
    ;(tariffs ?? []).forEach((t) => tariffNameById.set(t.id, t.name))
  }

  return ((data ?? []) as Record<string, unknown>[]).map((o): OfferRow => {
    const discountValue = o.discount_value != null ? Number(o.discount_value) : null
    const applicableTariffIds = Array.isArray(o.applicable_tariff_ids)
      ? (o.applicable_tariff_ids as string[])
      : []
    const targetAudience = ((o.target_audience as OfferTargetAudience | null) ?? 'all') as OfferTargetAudience

    let tariffsLabel = 'Todas las tarifas'
    if (applicableTariffIds.length === 1) {
      tariffsLabel = tariffNameById.get(applicableTariffIds[0]!) ?? '1 tarifa'
    } else if (applicableTariffIds.length > 1) {
      tariffsLabel = `${applicableTariffIds.length} tarifas`
    }

    return {
      id: o.id as string,
      title: o.title as string,
      description: (o.description as string | null) ?? null,
      discountType: o.discount_type as DbDiscountType | null,
      discountValue,
      validFrom: (o.valid_from as string | null) ?? null,
      validUntil: (o.valid_until as string | null) ?? null,
      maxRedemptions: (o.max_redemptions as number | null) ?? null,
      currentRedemptions: (o.current_redemptions as number) ?? 0,
      code: (o.code as string | null) ?? null,
      isActive: (o.is_active as boolean) ?? true,
      createdAt: o.created_at as string,
      targetAudience,
      applicableTariffIds,
      discountLabel: computeDiscountLabel(
        o.discount_type as DbDiscountType | null,
        discountValue
      ),
      validityLabel: computeValidityLabel(
        (o.valid_from as string | null) ?? null,
        (o.valid_until as string | null) ?? null
      ),
      statusLabel: computeStatus(
        (o.is_active as boolean) ?? true,
        (o.valid_from as string | null) ?? null,
        (o.valid_until as string | null) ?? null,
        (o.current_redemptions as number) ?? 0,
        (o.max_redemptions as number | null) ?? null
      ),
      redemptionsLabel: computeRedemptionsLabel(
        (o.current_redemptions as number) ?? 0,
        (o.max_redemptions as number | null) ?? null
      ),
      audienceLabel: AUDIENCE_LABELS[targetAudience],
      tariffsLabel,
    }
  })
})

/** Para el form de crear/editar: lista tarifas activas del gym. */
export const getActiveTariffOptions = cache(async (): Promise<TariffOption[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tariffs')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error || !data) return []
  return data.map((t) => ({ id: t.id, name: t.name }))
})
