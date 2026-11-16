import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ChallengeForm } from './challenge-form'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: factors } = await supabase.auth.mfa.listFactors()
  const verifiedTotp = factors?.totp?.find((f) => f.status === 'verified')
  if (!verifiedTotp) redirect('/configuracion/cuenta/mfa/enroll')

  return (
    <main className="mx-auto max-w-md p-4 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Verifica tu código 2FA</h1>
        <p className="text-sm text-slate-600 mt-1">
          Introduce el código de 6 dígitos de tu authenticator app.
        </p>
      </header>
      <ChallengeForm factorId={verifiedTotp.id} />
    </main>
  )
}
