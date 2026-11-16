'use server'

import { createClient } from '@/lib/supabase/server'

export type MarkTourSeenResult = { ok: true } | { ok: false; error: string }

/**
 * Marks a tour as seen for the current user. Called fire-and-forget from
 * FeatureTour.tsx after the tour auto-starts. Idempotent via ON CONFLICT
 * in the RPC (safe to call multiple times).
 *
 * Replaces the previous localStorage persistence — tour seen state now
 * syncs across all devices the user logs into.
 */
export async function markTourSeenAction(
  tourKey: string
): Promise<MarkTourSeenResult> {
  if (!tourKey || tourKey.length === 0 || tourKey.length > 100) {
    return { ok: false, error: 'tour_key inválido' }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_tour_seen', { p_tour_key: tourKey })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
