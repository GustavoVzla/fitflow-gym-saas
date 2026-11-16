import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EnrollForm } from './enroll-form'

export const dynamic = 'force-dynamic'

export default async function MfaEnrollPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin/mfa/enroll')

  const { data: isAdmin } = await supabase.rpc('is_app_admin')
  if (isAdmin !== true) redirect('/')

  // Si ya hay TOTP verificado, no tiene sentido volver a enrollar → challenge
  const { data: factors } = await supabase.auth.mfa.listFactors()
  const verifiedTotp = factors?.totp?.find((f) => f.status === 'verified')
  if (verifiedTotp) redirect('/admin/mfa/challenge')

  // Limpia factores previos no verificados para evitar basura acumulada.
  // NOTE: listFactors() por defecto solo devuelve verified. Los unverified
  // pueden persistir en auth.mfa_factors y bloquear el nuevo enroll si el
  // friendlyName colisiona. Por eso además de limpiar lo que veamos, usamos
  // un friendlyName único por timestamp-ms en cada render.
  const unverified = factors?.totp?.filter((f) => f.status !== 'verified') ?? []
  for (const f of unverified) {
    await supabase.auth.mfa.unenroll({ factorId: f.id })
  }

  const now = new Date()
  const uniqueSuffix = `${now.toISOString().slice(0, 10)} · ${now.getTime().toString().slice(-6)}`
  const { data: enroll, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `FitFlow Admin ${uniqueSuffix}`,
  })

  if (error || !enroll) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-semibold mb-4">Configurar 2FA</h1>
        <p className="text-red-600">Error al generar el factor TOTP: {error?.message ?? 'desconocido'}</p>
      </main>
    )
  }

  // Sanitiza el secret para mostrarlo en bloques legibles (cada 4 chars)
  const secret = enroll.totp.secret
  const secretBlocks = secret.match(/.{1,4}/g)?.join(' ') ?? secret

  return (
    <main className="mx-auto max-w-xl p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Configura 2FA para super-admin</h1>
        <p className="text-sm text-gray-600 mt-1">
          Escanea el QR con Google Authenticator, 1Password, Authy o similar e introduce el código de 6 dígitos para activar.
        </p>
      </header>

      <section className="border rounded-lg p-6 bg-white space-y-4">
        <div className="flex flex-col items-center gap-4">
          {/* qr_code de Supabase ya viene como data URL completo SVG inline.
              NO wrappear con data: + encodeURIComponent (double-encoding produce
              imagen rota de 0x0). Ver bug 2026-04-22 + Supabase docs:
              https://supabase.com/docs/reference/javascript/auth-mfa-enroll */}
          <img
            src={enroll.totp.qr_code}
            alt="Código QR TOTP"
            width={220}
            height={220}
            className="border rounded"
          />
        </div>
        <div className="border-t border-gray-200 pt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">
            O introduce este código manualmente en tu authenticator:
          </p>
          <code className="block p-3 bg-gray-50 border border-gray-200 rounded font-mono text-sm break-all select-all">
            {secretBlocks}
          </code>
          <p className="text-xs text-gray-500 mt-2">
            Úsalo si no puedes escanear el QR (authenticator en otro dispositivo, cámara no disponible, etc.).
          </p>
        </div>
      </section>

      <EnrollForm factorId={enroll.id} />
    </main>
  )
}
