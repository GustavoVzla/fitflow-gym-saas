import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

export type MemberTariffGroup = 'Dinamico' | 'Premium' | 'Salud' | 'Personal'
export type MemberStatus = 'Activo' | 'Pendiente' | 'Inactivo' | 'Bloqueado'
export type InviteStatus = 'active' | 'pending' | 'none' | 'no_email' | 'max_reached'

export interface MemberRow {
  id: string
  name: string
  email: string
  phone: string
  tariff: string
  tariffGroup: MemberTariffGroup
  status: MemberStatus
  lastBooking: string | null
  paymentMethod: string | null
  joinDate: string
  inviteStatus: InviteStatus
  inviteSentAt: string | null
  inviteCount: number
}

// Map DB enum → UI enum (capitalizadas ES)
const STATUS_MAP: Record<string, MemberStatus> = {
  active: 'Activo',
  pending: 'Pendiente',
  inactive: 'Inactivo',
  blocked: 'Bloqueado',
}

export const DB_STATUS_MAP: Record<MemberStatus, 'active' | 'pending' | 'inactive' | 'blocked'> = {
  Activo: 'active',
  Pendiente: 'pending',
  Inactivo: 'inactive',
  Bloqueado: 'blocked',
}

// Cacheado por request — misma query desde varios components no re-ejecuta
export const getMembers = cache(async (): Promise<MemberRow[]> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('members')
    .select(
      `
      id, first_name, last_name, email, phone, status, join_date,
      current_tariff_id, auth_user_id, invite_sent_at, invite_count,
      tariffs:current_tariff_id (name, "group")
    `
    )
    .order('last_name', { ascending: true })

  if (error) {
    console.error('[getMembers] error:', error)
    return []
  }

  // Obtener última reserva por socio (query agregada)
  const memberIds = (data ?? []).map((m) => m.id)
  const lastBookings = new Map<string, string>()

  if (memberIds.length > 0) {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('member_id, booked_at')
      .in('member_id', memberIds)
      .eq('status', 'attended')
      .order('booked_at', { ascending: false })

    for (const b of bookings ?? []) {
      if (!lastBookings.has(b.member_id)) {
        lastBookings.set(b.member_id, b.booked_at)
      }
    }
  }

  return (data ?? []).map((m): MemberRow => {
    const tariff = Array.isArray(m.tariffs) ? m.tariffs[0] : m.tariffs
    const tariffGroup = (tariff?.group ?? 'Dinamico') as MemberTariffGroup
    const lastBookingAt = lastBookings.get(m.id)

    // Compute inviteStatus
    let inviteStatus: InviteStatus = 'none'
    const authUserId = (m as Record<string, unknown>).auth_user_id as string | null | undefined
    const inviteSentAt = (m as Record<string, unknown>).invite_sent_at as string | null | undefined
    const inviteCount = Number((m as Record<string, unknown>).invite_count ?? 0)
    if (authUserId) inviteStatus = 'active'
    else if (!m.email) inviteStatus = 'no_email'
    else if (inviteCount >= 3) inviteStatus = 'max_reached'
    else if (inviteSentAt) inviteStatus = 'pending'

    return {
      id: m.id,
      name: `${m.first_name} ${m.last_name}`.trim(),
      email: m.email ?? '',
      phone: m.phone ?? '',
      tariff: tariff?.name ?? 'Sin tarifa',
      tariffGroup: ['Dinamico', 'Premium', 'Salud', 'Personal'].includes(tariffGroup)
        ? tariffGroup
        : 'Dinamico',
      status: STATUS_MAP[m.status] ?? 'Pendiente',
      lastBooking: lastBookingAt
        ? new Date(lastBookingAt).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : null,
      paymentMethod: 'Manual', // placeholder — se calculará desde member_tariffs o último payment en futuras iteraciones
      inviteStatus,
      inviteSentAt: inviteSentAt ?? null,
      inviteCount,
      joinDate: new Date(m.join_date).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    }
  })
})

export const getMembersCount = cache(async (): Promise<number> => {
  const supabase = await createClient()
  const { count } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
  return count ?? 0
})

// Para el dropdown de tarifas al crear/editar socio
export const getActiveTariffs = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tariffs')
    .select('id, name, "group"')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    group: t.group ?? 'Dinamico',
  }))
})
