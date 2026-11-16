import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GDPR Art.15 — right of access (data portability).
 * Returns all personal data the authenticated user has in the platform
 * as a downloadable JSON file.
 *
 * Auth: cookie session (createClient() — respects RLS).
 * Rate limit: auth scope (5/min per IP) to avoid scraping loops.
 */
export async function POST() {
  const rl = await rateLimit('auth')
  if (!rl.success) {
    return Response.json(
      { error: `Too many requests. Wait ${rl.retryAfter}s.` },
      { status: 429 }
    )
  }

  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Detectar si es member, tenant staff o super-admin
  const { data: memberRow } = await supabase
    .from('members')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const { data: gymUserRows } = await supabase
    .from('gym_users')
    .select('*')
    .eq('user_id', user.id)

  const { data: appAdminRow } = await supabase
    .from('app_admins')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  // Dataset del member (bookings, payments, conversations)
  let memberData: {
    bookings: unknown[]
    payments: unknown[]
    member_tariffs: unknown[]
    conversations: unknown[]
  } | null = null

  if (memberRow?.id) {
    const [bookings, payments, tariffs, conversations] = await Promise.all([
      supabase.from('bookings').select('*').eq('member_id', memberRow.id),
      supabase.from('payments').select('*').eq('member_id', memberRow.id),
      supabase.from('member_tariffs').select('*').eq('member_id', memberRow.id),
      supabase.from('conversations').select('*').eq('member_id', memberRow.id),
    ])
    memberData = {
      bookings: bookings.data ?? [],
      payments: payments.data ?? [],
      member_tariffs: tariffs.data ?? [],
      conversations: conversations.data ?? [],
    }
  }

  // Notifications siempre ligadas a user_id (auth.uid)
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)

  // Audit log entries que referencian al user
  const { data: auditLog } = await supabase
    .from('audit_log')
    .select('*')
    .eq('user_id', user.id)

  const exportData = {
    generated_at: new Date().toISOString(),
    subject_access_request: {
      user_id: user.id,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
    },
    roles: {
      is_member: Boolean(memberRow?.id),
      is_tenant_staff: (gymUserRows?.length ?? 0) > 0,
      is_app_admin: Boolean(appAdminRow?.user_id),
    },
    member_profile: memberRow,
    member_data: memberData,
    gym_users: gymUserRows ?? [],
    app_admin: appAdminRow,
    notifications: notifications ?? [],
    audit_log: auditLog ?? [],
    _metadata: {
      gdpr_article: 'Art. 15 — Right of access',
      format: 'JSON',
      controller: 'FitFlow (operated by Demo Company S.L.)',
      contact: 'soluciones@example.com',
    },
  }

  const filename = `fitflow-data-export-${new Date().toISOString().slice(0, 10)}.json`

  return new Response(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
