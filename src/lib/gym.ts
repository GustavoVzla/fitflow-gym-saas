import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { PlanTier } from './plans'

export interface CurrentGym {
  gymId: string
  gymName: string
  gymSlug: string
  gymLogoUrl: string | null
  gymBrandColor: string
  gymStatus: string
  gymPlan: PlanTier
  role: string
}

/**
 * Fetch the user's active gym (first of the list — multi-gym selector is not
 * implemented yet). Returns null for super-admins (no gym) or unauth users.
 *
 * Wrapped in react cache so multiple calls in the same request dedupe to one
 * RPC hit. The DashboardLayout already fetches this indirectly, pages that
 * need it again go through this helper.
 *
 * Relies on RPC `current_user_gyms` (migration 0023 extended it with gym_plan).
 */
export const getCurrentGym = cache(async (): Promise<CurrentGym | null> => {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('current_user_gyms')
    if (error) {
      console.error('[getCurrentGym] rpc error:', error)
      return null
    }
    if (!data || data.length === 0) return null
    const row = data[0]
    return {
      gymId: row.gym_id,
      gymName: row.gym_name,
      gymSlug: row.gym_slug,
      gymLogoUrl: row.gym_logo_url,
      gymBrandColor: (row as { gym_brand_color?: string }).gym_brand_color ?? '#3b8bea',
      gymStatus: row.gym_status,
      gymPlan: row.gym_plan as PlanTier,
      role: row.role,
    }
  } catch (e) {
    console.error('[getCurrentGym] exception:', e)
    return null
  }
})
