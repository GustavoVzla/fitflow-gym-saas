import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { studioBrand } from '../../theme'

export const dynamic = 'force-dynamic'

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?error=' + encodeURIComponent('Sesión no encontrada'))
  }

  // Buscar member row con email match (importados via internal ticket sin auth_user_id)
  const email = user.email?.toLowerCase()
  if (!email) {
    redirect('/login?error=' + encodeURIComponent('Email no encontrado en la sesión'))
  }

  const { data: existingMember } = await supabase
    .from('members')
    .select('id, auth_user_id')
    .ilike('email', email)
    .maybeSingle()

  if (!existingMember) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
        <h1 className="mb-3 font-[family-name:var(--font-display)] text-2xl font-bold text-[#f87171]">
          No te encontramos como socio
        </h1>
        <p className="mb-6 max-w-sm text-sm text-[rgba(240,240,245,0.6)]">
          Tu correo <span className="text-[#5da0ef]">{email}</span> no figura en
          la base de socios de {studioBrand.name}. Pide al gimnasio que te
          invite a la app.
        </p>
        <a
          href="/login"
          className="rounded-lg border border-[rgba(59,139,234,0.3)] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#5da0ef] hover:bg-[rgba(59,139,234,0.08)]"
        >
          Volver
        </a>
      </main>
    )
  }

  // Ya vinculado y coincide → directo
  if (existingMember.auth_user_id === user.id) {
    redirect(sp.next ?? '/inicio')
  }

  // Auth user nuevo → vincular vía RPC
  if (!existingMember.auth_user_id) {
    const { error } = await supabase.rpc('link_member_auth_user', {
      p_member_id: existingMember.id,
    })
    if (error) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
          <h1 className="mb-3 font-[family-name:var(--font-display)] text-2xl font-bold text-[#f87171]">
            No pudimos activar tu cuenta
          </h1>
          <p className="mb-6 max-w-sm text-sm text-[rgba(240,240,245,0.6)]">
            {error.message}. Contacta a {studioBrand.name}.
          </p>
        </main>
      )
    }
    redirect(sp.next ?? '/inicio')
  }

  // existe member con OTRO auth_user_id → conflicto, pedir admin manual
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="mb-3 font-[family-name:var(--font-display)] text-2xl font-bold text-[#f87171]">
        Conflicto de cuenta
      </h1>
      <p className="max-w-sm text-sm text-[rgba(240,240,245,0.6)]">
        Tu socio ya está vinculado a otra cuenta. Contacta a {studioBrand.name}.
      </p>
    </main>
  )
}
