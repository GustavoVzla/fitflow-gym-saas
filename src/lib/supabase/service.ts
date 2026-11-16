import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Supabase client usando service_role key (bypass RLS).
 * SOLO para contextos sin usuario autenticado: webhooks, cron jobs, admin scripts.
 *
 * NUNCA usar en Server Actions ni en data.ts de paginas — ahi siempre createClient()
 * que respeta RLS via auth.uid().
 *
 * Env var obligatoria: SUPABASE_SERVICE_ROLE_KEY (nunca exponer client-side).
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL no configurado')
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY no configurado. Esta env var es obligatoria para webhooks Stripe.'
    )
  }

  return createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
