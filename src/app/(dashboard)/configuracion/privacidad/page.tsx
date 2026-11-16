import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PrivacyPanel } from '@/components/gdpr/privacy-panel'

export const dynamic = 'force-dynamic'

export default async function PrivacidadTenantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login?redirect=/configuracion/privacidad')

  return (
    <main className="mx-auto max-w-2xl p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Privacidad y datos</h1>
        <p className="text-sm text-gray-600 mt-1">
          Derechos RGPD: acceso a tus datos (Art. 15) y derecho al olvido (Art. 17).
        </p>
      </header>
      <PrivacyPanel userEmail={user.email} />
    </main>
  )
}
