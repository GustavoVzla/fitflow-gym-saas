import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Fetches the list of tour keys the current user has already seen.
 * Uses react cache so multiple pages in the same request share the fetch.
 *
 * Backend source: RPC `public.get_tours_seen()` (migration 0025).
 * Returns empty array on error or when unauthenticated.
 */
export const getSeenTourKeys = cache(async (): Promise<string[]> => {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_tours_seen')
    if (error) {
      console.error('[getSeenTourKeys] rpc error:', error)
      return []
    }
    // RPC returns setof text → data is string[] | null
    return (data as string[] | null) ?? []
  } catch (e) {
    console.error('[getSeenTourKeys] exception:', e)
    return []
  }
})
