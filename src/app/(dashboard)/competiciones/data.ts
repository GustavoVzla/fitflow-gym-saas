import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { CompetitionRow } from './types'
import { computeStatus, computeRangeLabel } from './types'

export type { CompetitionRow } from './types'

export const getCompetitions = cache(async (): Promise<CompetitionRow[]> => {
  const supabase = await createClient()
  // Columnas 0067 pueden no estar en tipos generados aún; select * simplifica
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('competitions') as any)
    .select('*')
    .order('start_date', { ascending: false })

  if (error) {
    console.error('[getCompetitions] error:', error)
    return []
  }

  return ((data ?? []) as Record<string, unknown>[]).map((c): CompetitionRow => {
    const participants = Array.isArray(c.participants) ? c.participants : []
    const categories = Array.isArray(c.categories) ? (c.categories as string[]) : []
    return {
      id: c.id as string,
      name: c.name as string,
      description: (c.description as string | null) ?? null,
      startDate: c.start_date as string,
      endDate: c.end_date as string,
      type: (c.type as string | null) ?? null,
      participantsCount: participants.length,
      isActive: c.is_active as boolean,
      createdAt: c.created_at as string,

      // Campos 0067
      slug: (c.slug as string | null) ?? null,
      coverImageUrl: (c.cover_image_url as string | null) ?? null,
      conditions: (c.conditions as string | null) ?? null,
      onlineRegistrationEnabled: (c.online_registration_enabled as boolean) ?? false,
      priceCents: (c.price_cents as number | null) ?? null,
      taxPercent: c.tax_percent != null ? Number(c.tax_percent) : null,
      maxRegistrations: (c.max_registrations as number | null) ?? null,
      waitlistEnabled: (c.waitlist_enabled as boolean) ?? false,
      categories,
      contactEmail: (c.contact_email as string | null) ?? null,
      contactPhone: (c.contact_phone as string | null) ?? null,
      locationAddress: (c.location_address as string | null) ?? null,
      latitude: c.latitude != null ? Number(c.latitude) : null,
      longitude: c.longitude != null ? Number(c.longitude) : null,

      // Computados
      statusLabel: computeStatus(c.start_date as string, c.end_date as string, c.is_active as boolean),
      rangeLabel: computeRangeLabel(c.start_date as string, c.end_date as string),
    }
  })
})
