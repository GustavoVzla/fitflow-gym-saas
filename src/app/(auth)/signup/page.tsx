import Link from 'next/link'
import { SignupForm } from './SignupForm'

export default function SignupPage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Crea tu gym</h2>
        <p className="mt-1 text-sm text-slate-600">
          Empieza con 14 días de prueba. Sin tarjeta.
        </p>
      </div>

      <SignupForm />

      <p className="mt-6 text-center text-sm text-slate-600">
        ¿Ya tienes cuenta?{' '}
        <Link
          href="/login"
          className="font-medium text-[#3b8bea] hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
