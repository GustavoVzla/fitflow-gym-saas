import Link from 'next/link'
import { LoginForm } from './LoginForm'
import { getHostBrand } from '@/lib/hostBrand'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const { redirect } = await searchParams
  const brand = await getHostBrand()

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Iniciar sesión</h2>
        <p className="mt-1 text-sm text-slate-600">
          {brand.isWhiteLabel ? `Accede a tu panel ${brand.name}` : 'Accede a tu panel de FitFlow'}
        </p>
      </div>

      <LoginForm redirectTo={redirect ?? '/'} />

      {!brand.isWhiteLabel && (
        <p className="mt-6 text-center text-sm text-slate-600">
          ¿No tienes cuenta?{' '}
          <Link
            href="/signup"
            className="font-medium text-[#3b8bea] hover:underline"
          >
            Crea tu gym
          </Link>
        </p>
      )}
    </div>
  )
}
