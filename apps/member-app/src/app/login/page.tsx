import { LoginForm } from './LoginForm'
import { studioBrand } from '../theme'

export const metadata = {
  title: 'Acceder',
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; message?: string; error?: string }>
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <div className="rounded-full border border-[rgba(59,139,234,0.25)] bg-[rgba(59,139,234,0.08)] px-4 py-1 text-xs font-semibold uppercase tracking-wider text-[#5da0ef]">
            Tu app de socio
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[#5da0ef]">
            {studioBrand.name}
          </h1>
          <p className="text-sm text-[rgba(240,240,245,0.6)]">
            Reserva clases, gestiona tus pagos y consulta tu actividad.
          </p>
        </div>

        <LoginFormWrapper searchParams={searchParams} />

        <p className="mt-8 text-center text-xs text-[rgba(240,240,245,0.35)]">
          ¿No tienes cuenta? Contacta a tu gimnasio para que te invite a la app.
        </p>

        <nav className="mt-6 flex justify-center gap-x-4 gap-y-2 text-[10px] text-[rgba(240,240,245,0.4)]" aria-label="Información legal">
          <a href="/privacidad" className="hover:text-[rgba(240,240,245,0.7)]">Privacidad</a>
          <span aria-hidden>·</span>
          <a href="/terminos" className="hover:text-[rgba(240,240,245,0.7)]">Términos</a>
          <span aria-hidden>·</span>
          <a href="/cookies" className="hover:text-[rgba(240,240,245,0.7)]">Cookies</a>
          <span aria-hidden>·</span>
          <a href="/aviso-legal" className="hover:text-[rgba(240,240,245,0.7)]">Aviso Legal</a>
        </nav>
      </div>
    </main>
  )
}

async function LoginFormWrapper({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; message?: string; error?: string }>
}) {
  const sp = await searchParams
  return (
    <LoginForm
      redirectTo={sp.redirect ?? '/inicio'}
      initialMessage={sp.message}
      initialError={sp.error}
    />
  )
}
