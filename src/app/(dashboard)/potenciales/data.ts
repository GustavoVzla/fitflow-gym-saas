import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { ProspectRow, ProspectStatus, TariffOption } from './types'

export type { ProspectRow, ProspectStatus, TariffOption } from './types'

export const getProspects = cache(async (): Promise<ProspectRow[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('prospects')
    .select(
      'id, name, email, phone, source, interest, status, notes, last_contact_at, conversion_member_id, lost_reason, created_at, updated_at'
    )
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[getProspects] error:', error)
    return []
  }

  return (data ?? []).map((p): ProspectRow => ({
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    source: p.source,
    interest: p.interest,
    status: p.status as ProspectStatus,
    notes: p.notes,
    lastContactAt: p.last_contact_at,
    conversionMemberId: p.conversion_member_id,
    lostReason: p.lost_reason,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }))
})

export const getActiveTariffs = cache(async (): Promise<TariffOption[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tariffs')
    .select('id, name, price')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    price: Number(t.price),
  }))
})
