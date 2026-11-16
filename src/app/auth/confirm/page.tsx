import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Landing post-confirmación de email.
// Si el user confirmó su email y aún no tiene gym creado (caso email-confirm activo),
// creamos el gym aquí usando los metadatos que guardamos en el signup.
export default async function ConfirmPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // ¿Ya tiene gym asignado?
  const { data: memberships } = await supabase
    .from('gym_users')
    .select('gym_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)

  if (memberships && memberships.length > 0) {
    redirect('/')
  }

  // No tiene gym → crear desde metadatos guardados en signup
  const meta = user.user_metadata as { gym_name?: string; gym_slug?: string }
  const gymName = meta?.gym_name
  const gymSlug = meta?.gym_slug

  if (!gymName || !gymSlug) {
    // Metadatos perdidos — mandar a flow de setup manual (futuro: wizard onboarding)
    redirect('/login?error=missing_gym_data')
  }

  const { error } = await supabase.rpc('create_gym_with_owner', {
    p_name: gymName,
    p_slug: gymSlug,
    p_email: user.email ?? undefined,
  })

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-medium">No se pudo crear tu gym</p>
        <p className="mt-2">{error.message}</p>
        <p className="mt-3 text-xs">
          Si el identificador &quot;{gymSlug}&quot; ya está en uso, contacta con soporte.
        </p>
      </div>
    )
  }

  redirect('/')
}
