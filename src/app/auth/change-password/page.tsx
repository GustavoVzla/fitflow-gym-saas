import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChangePasswordForm from './ChangePasswordForm'

export default async function ChangePasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/auth/change-password')

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">FitFlow</h1>
          <p className="mt-1 text-sm text-slate-500">Primer acceso — establece tu contraseña</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900">
              Cambia tu contraseña temporal
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Por seguridad, debes elegir una contraseña propia antes de entrar al panel.
              <br />
              Cuenta: <span className="font-mono text-slate-700">{user.email}</span>
            </p>
          </div>
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  )
}
