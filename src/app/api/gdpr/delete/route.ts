import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { rateLimit } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GDPR Art.17 — right to erasure (right to be forgotten).
 *
 * Flujo:
 *  1. Verificar auth + password (re-auth para prevenir CSRF / account hijack).
 *  2. audit_log entry ANTES de borrar (rastro inmutable del delete request).
 *  3. Anonymize member row si aplica — NO hard delete porque payments RESTRICT
 *     y quiero preservar trazabilidad fiscal. Ver docs/GDPR_CASCADE_AUDIT.md.
 *  4. UPDATE-to-NULL FKs NO ACTION que bloquearían deleteUser (gym_users.invited_by,
 *     workouts.published_by).
 *  5. supabase.auth.admin.deleteUser() — cascade SET NULL resto de FKs.
 *  6. signOut + respuesta.
 *
 * Rate limit auth scope (5/min por IP).
 */
export async function POST(req: Request) {
  const rl = await rateLimit('auth')
  if (!rl.success) {
    return Response.json(
      { error: `Too many requests. Wait ${rl.retryAfter}s.` },
      { status: 429 }
    )
  }

  let body: { password?: string } = {}
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const password = typeof body.password === 'string' ? body.password : ''
  if (!password) {
    return Response.json({ error: 'Password required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user || !user.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Re-auth: valida password del user actual
  const { error: reauthErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  })
  if (reauthErr) {
    return Response.json({ error: 'Password incorrect' }, { status: 401 })
  }

  const userId = user.id
  const userEmail = user.email
  const service = createServiceRoleClient()

  // 1. audit_log entry ANTES del delete (inmutable por diseño — no hay DELETE policy public)
  await service.from('audit_log').insert({
    user_id: userId,
    action: 'gdpr_self_delete',
    resource_type: 'auth.users',
    resource_id: userId,
    metadata: {
      email: userEmail,
      reason: 'gdpr_art17_self_service',
      initiated_via: 'api/gdpr/delete',
    },
  })

  // 2. Anonymize member row si aplica (preserva ID para audit contable de payments)
  const { data: memberRow } = await service
    .from('members')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (memberRow?.id) {
    await service
      .from('members')
      .update({
        auth_user_id: null,
        first_name: 'Usuario',
        last_name: 'eliminado (GDPR)',
        email: null,
        phone: null,
        address: null,
        city: null,
        postal_code: null,
        birth_date: null,
        tax_id: null,
        notes: null,
        avatar_url: null,
        medical_info: null,
        tags: null,
      })
      .eq('id', memberRow.id)
  }

  // 3. UPDATE-to-NULL FKs NO ACTION que bloquearían deleteUser
  await service.from('gym_users').update({ invited_by: null }).eq('invited_by', userId)
  await service.from('workouts').update({ published_by: null }).eq('published_by', userId)

  // 4. deleteUser — cascade en identities/sessions/mfa_factors/gym_users.user_id/
  //    notifications/app_admins; SET NULL en el resto (ver docs/GDPR_CASCADE_AUDIT.md)
  const { error: delErr } = await service.auth.admin.deleteUser(userId)
  if (delErr) {
    return Response.json(
      { error: `Delete failed: ${delErr.message}` },
      { status: 500 }
    )
  }

  // 5. Invalidar sesión del cliente
  await supabase.auth.signOut()

  return Response.json({
    ok: true,
    message: 'Cuenta y datos asociados eliminados. Conservamos registros fiscales anonimizados por obligación contable.',
  })
}
