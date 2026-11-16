import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

export type AvisoTriggerType =
  | 'welcome'
  | 'payment_due'
  | 'payment_overdue'
  | 'birthday'
  | 'booking_reminder'
  | 'booking_cancelled'
  | 'membership_expiring'
  | 'no_attendance'

export type EventContext = Record<string, string | number | null | undefined>

// Fire-and-forget enqueue.
// Nunca rompe el flujo principal (create member, booking, etc.) — solo loggea.
// El RPC `enqueue_aviso` ya valida que el caller pertenezca al gym.
export async function enqueueAviso(
  supabase: SupabaseClient,
  params: {
    gymId: string
    memberId: string
    triggerType: AvisoTriggerType
    eventContext?: EventContext
  },
): Promise<void> {
  try {
    const { error } = await supabase.rpc('enqueue_aviso', {
      p_gym_id: params.gymId,
      p_member_id: params.memberId,
      p_trigger_type: params.triggerType,
      p_event_context: (params.eventContext ?? {}) as Record<string, unknown>,
    })
    if (error) {
      console.warn('[enqueueAviso]', params.triggerType, 'failed:', error.message)
    }
  } catch (err) {
    console.warn('[enqueueAviso] unexpected:', err)
  }
}
