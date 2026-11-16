import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EnrollForm } from './enroll-form'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/configuracion/cuenta/mfa/enroll')

  // Si ya hay TOTP verificado, no tiene sentido volver a enrollar
  const { data: factors } = await supabase.auth.mfa.listFactors()
  const verifiedTotp = factors?.totp?.find((f) => f.status === 'verified')
  if (verifiedTotp) redirect('/configuracion/cuenta')

  // Limpiar factores previos no verificados (evita friendlyName collision)
  const unverified = factors?.totp?.filter((f) => f.status !== 'verified') ?? []
  for (const f of unverified) {
    await supabase.auth.mfa.unenroll({ factorId: f.id })
  }

  // FriendlyName único por render (ms timestamp)
  const now = new Date()
  const uniqueSuffix = `${now.toISOString().slice(0, 10)} · ${now.getTime().toString().slice(-6)}`
  const { data: enroll, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `FitFlow Owner ${uniqueSuffix}`,
  })

  if (error || !enroll) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-semibold mb-4">Configurar 2FA</h1>
        <p className="text-red-600">
          Error al generar el factor TOTP: {error?.message ?? 'desconocido'}
        </p>
      </main>
    )
  }

  const secret = enroll.totp.secret
  const secretBlocks = secret.match(/.{1,4}/g)?.join(' ') ?? secret

  return (
    <main className="mx-auto max-w-xl p-4 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Activar 2FA</h1>
        <p className="text-sm text-slate-600 mt-1">
          Escanea el QR con Google Authenticator, 1Password, Authy o similar e introduce el código
          de 6 dígitos para activar.
        </p>
      </header>

      <section className="border border-slate-200 rounded-lg p-6 bg-white space-y-4">
        <div className="flex flex-col items-center gap-4">
          {/* qr_code viene como data URL SVG. NO wrappear con data: encodeURIComponent
              (double-encoding rompe). Ver bug sesión 8 MFA admin. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enroll.totp.qr_code}
            alt="Código QR TOTP"
            width={220}
            height={220}
            className="border border-slate-200 rounded"
          />
        </div>
        <div className="border-t border-slate-200 pt-4">
          <p className="text-sm font-medium text-slate-700 mb-2">
            O introduce este código manualmente en tu authenticator:
          </p>
          <code className="block p-3 bg-slate-50 border border-slate-200 rounded font-mono text-sm break-all select-all">
            {secretBlocks}
          </code>
          <p className="text-xs text-slate-500 mt-2">
            Úsalo si no puedes escanear el QR (authenticator en otro dispositivo, cámara no
            disponible, etc.).
          </p>
        </div>
      </section>

      <EnrollForm factorId={enroll.id} />
    </main>
  )
}
