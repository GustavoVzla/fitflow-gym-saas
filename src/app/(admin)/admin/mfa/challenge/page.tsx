import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ChallengeForm } from './challenge-form'

export const dynamic = 'force-dynamic'

export default async function MfaChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next: nextParam } = await searchParams
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/admin'

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=${encodeURIComponent(`/admin/mfa/challenge?next=${next}`)}`)

  const { data: isAdmin } = await supabase.rpc('is_app_admin')
  if (isAdmin !== true) redirect('/')

  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
  if (factorsError) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-semibold mb-4">Verifica 2FA</h1>
        <p className="text-red-600">Error al consultar factores: {factorsError.message}</p>
      </main>
    )
  }

  const totp = factors?.totp?.find((f) => f.status === 'verified')
  if (!totp) redirect('/admin/mfa/enroll')

  return (
    <main className="mx-auto max-w-xl p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Verifica tu 2FA</h1>
        <p className="text-sm text-gray-600 mt-1">
          Introduce el código de 6 dígitos de tu authenticator app para acceder al panel super-admin.
        </p>
      </header>
      <ChallengeForm factorId={totp.id} next={next} />
    </main>
  )
}
