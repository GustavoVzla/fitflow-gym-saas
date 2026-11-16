import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type {
  AdminGymRow,
  AdminGymDetail,
  AdminGlobalStats,
  AdminGymUser,
  AdminAuditLogRow,
} from './types'

// Re-export client-safe types + constants so existing pages that import from `./data`
// keep working. New Client Components should import from `./types` directly.
export * from './types'
export type {
  AdminGymRow,
  AdminGymDetail,
  AdminGlobalStats,
  AdminGymUser,
  AdminAuditLogRow,
}

export const getAdminStats = cache(async (): Promise<AdminGlobalStats> => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_global_stats')
  if (error || !data || data.length === 0) {
    return {
      totalGyms: 0,
      activeGyms: 0,
      totalMembers: 0,
      totalActiveMembers: 0,
      revenueThisMonthCents: 0,
      newGymsThisMonth: 0,
    }
  }
  const r = data[0]
  return {
    totalGyms: Number(r.total_gyms ?? 0),
    activeGyms: Number(r.active_gyms ?? 0),
    totalMembers: Number(r.total_members ?? 0),
    totalActiveMembers: Number(r.total_active_members ?? 0),
    revenueThisMonthCents: Number(r.revenue_this_month_cents ?? 0),
    newGymsThisMonth: Number(r.new_gyms_this_month ?? 0),
  }
})

export const getAdminGyms = cache(async (includeDeleted: boolean = false): Promise<AdminGymRow[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_list_gyms', { p_include_deleted: includeDeleted })
  if (error) {
    console.error('[getAdminGyms]', error)
    return []
  }
  return (data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    plan: g.plan ?? 'base',
    status: g.status ?? 'active',
    ownerEmail: g.owner_email,
    ownerName: g.owner_name,
    membersCount: Number(g.members_count ?? 0),
    activeMembersCount: Number(g.active_members_count ?? 0),
    createdAt: g.created_at,
    deletedAt: g.deleted_at ?? null,
    suspendedAt: g.suspended_at ?? null,
  }))
})

export async function getAdminGymDetail(gymId: string): Promise<AdminGymDetail | null> {
  const supabase = await createClient()
  // Super-admin no tiene gym_users → query directa bloqueada por RLS.
  // Usamos RPC SECURITY DEFINER admin_get_gym_detail (migración 0014 ampliada en 0022).
  const { data, error } = await supabase.rpc('admin_get_gym_detail', { p_gym_id: gymId })
  if (error || !data || data.length === 0) return null
  const gym = data[0]

  // Owner info + members counts vía admin_list_gyms (reutiliza cache si ya lo llamamos).
  const allGyms = await getAdminGyms()
  const listed = allGyms.find((g) => g.id === gymId)

  return {
    id: gym.id,
    name: gym.name,
    slug: gym.slug,
    plan: gym.plan ?? 'base',
    status: gym.status ?? 'active',
    ownerEmail: listed?.ownerEmail ?? null,
    ownerName: listed?.ownerName ?? null,
    membersCount: listed?.membersCount ?? 0,
    activeMembersCount: listed?.activeMembersCount ?? 0,
    createdAt: gym.created_at,
    paymentMode: gym.payment_mode ?? 'manual',
    stripeOnboardedAt: gym.stripe_onboarded_at,
    feePercentSepa: Number(gym.fee_percent_sepa ?? 0),
    feePercentCard: Number(gym.fee_percent_card ?? 0),
    email: gym.email ?? null,
    phone: gym.phone ?? null,
    address: gym.address ?? null,
    city: gym.city ?? null,
    postalCode: gym.postal_code ?? null,
    country: gym.country ?? null,
    taxId: gym.tax_id ?? null,
    website: gym.website ?? null,
    timezone: gym.timezone ?? null,
    currency: gym.currency ?? null,
    suspendedAt: gym.suspended_at ?? null,
    suspendedReason: gym.suspended_reason ?? null,
    deletedAt: gym.deleted_at ?? null,
  }
}

export async function getAdminGymUsers(gymId: string): Promise<AdminGymUser[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_list_gym_users', { p_gym_id: gymId })
  if (error) {
    console.error('[getAdminGymUsers]', error)
    return []
  }
  return (data ?? []).map((u) => ({
    gymUserId: u.gym_user_id,
    userId: u.user_id,
    email: u.email,
    fullName: u.full_name,
    role: u.role,
    isActive: u.is_active,
    mustChangePassword: u.must_change_password,
    lastSignInAt: u.last_sign_in_at,
    invitedAt: u.invited_at,
    acceptedAt: u.accepted_at,
    createdAt: u.created_at,
  }))
}

export async function getAdminAuditLog(
  gymId: string | null,
  limit: number = 20,
  offset: number = 0
): Promise<AdminAuditLogRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_list_audit_log', {
    p_gym_id: gymId ?? undefined,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) {
    console.error('[getAdminAuditLog]', error)
    return []
  }
  return (data ?? []).map((l) => ({
    id: l.id,
    actorUserId: l.actor_user_id,
    actorEmail: l.actor_email,
    action: l.action,
    resourceType: l.resource_type,
    resourceId: l.resource_id,
    gymId: l.gym_id,
    metadata: (l.metadata as Record<string, unknown>) ?? {},
    createdAt: l.created_at,
  }))
}
