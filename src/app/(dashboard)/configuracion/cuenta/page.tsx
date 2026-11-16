import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CuentaClient from './CuentaClient'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/configuracion/cuenta')

  // Check MFA status
  const { data: factors } = await supabase.auth.mfa.listFactors()
  const verifiedTotp = factors?.totp?.find((f) => f.status === 'verified')

  return (
    <CuentaClient
      initial={{
        email: user.email ?? '',
        fullName: (user.user_metadata?.full_name as string | undefined) ?? '',
        phone: (user.user_metadata?.phone as string | undefined) ?? '',
        mfaEnabled: !!verifiedTotp,
        mfaFriendlyName: verifiedTotp?.friendly_name ?? null,
      }}
    />
  )
}
