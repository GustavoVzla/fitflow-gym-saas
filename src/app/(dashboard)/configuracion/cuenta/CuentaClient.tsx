'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import {
  User,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react'
import { updateOwnerContactAction, changePasswordAction } from './actions'

interface Props {
  initial: {
    email: string
    fullName: string
    phone: string
    mfaEnabled: boolean
    mfaFriendlyName: string | null
  }
}

type ActionState = { error?: string; success?: string }
const emptyState: ActionState = {}

export default function CuentaClient({ initial }: Props) {
  const [contactState, contactAction, contactPending] = useActionState(
    updateOwnerContactAction,
    emptyState
  )
  const [pwdState, pwdAction, pwdPending] = useActionState(
    changePasswordAction,
    emptyState
  )

  const [showPasswordForm, setShowPasswordForm] = useState(false)

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <User className="h-6 w-6 text-[var(--brand-color,#0B4B8C)]" />
          Cuenta del owner
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Datos personales, seguridad y autenticación de dos factores para la cuenta que administra el centro.
        </p>
      </header>

      {/* Sección 1: Datos personales */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <header className="mb-4">
          <h2 className="text-sm font-semibold text-slate-800">Datos de contacto</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Email y teléfono usados para notificaciones de la plataforma.
          </p>
        </header>

        <form action={contactAction} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Nombre completo *
            </label>
            <input
              name="full_name"
              required
              defaultValue={initial.fullName}
              maxLength={120}
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email *
              </label>
              <input
                name="email"
                type="email"
                required
                defaultValue={initial.email}
                maxLength={320}
                className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Cambiar el email disparará un correo de confirmación.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Teléfono (opcional)
              </label>
              <input
                name="phone"
                type="tel"
                defaultValue={initial.phone}
                maxLength={30}
                placeholder="+34 600 000 000"
                className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
            </div>
          </div>

          {contactState.error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
              <AlertCircle className="h-3.5 w-3.5" />
              {contactState.error}
            </div>
          )}
          {contactState.success && (
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {contactState.success}
            </div>
          )}

          <button
            type="submit"
            disabled={contactPending}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--brand-color,#0B4B8C)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {contactPending ? 'Guardando...' : 'Guardar datos'}
          </button>
        </form>
      </section>

      {/* Sección 2: Cambiar contraseña */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <header className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Lock className="h-4 w-4 text-slate-500" />
              Contraseña
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              La nueva se usará en el próximo inicio de sesión.
            </p>
          </div>
          {!showPasswordForm && (
            <button
              type="button"
              onClick={() => setShowPasswordForm(true)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
            >
              Cambiar contraseña
            </button>
          )}
        </header>

        {showPasswordForm && (
          <form action={pwdAction} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nueva contraseña *
                </label>
                <input
                  name="new_password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-1">Mínimo 8 caracteres.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Repite la contraseña *
                </label>
                <input
                  name="confirm_password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
                />
              </div>
            </div>

            {pwdState.error && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
                <AlertCircle className="h-3.5 w-3.5" />
                {pwdState.error}
              </div>
            )}
            {pwdState.success && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {pwdState.success}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pwdPending}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--brand-color,#0B4B8C)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {pwdPending ? 'Cambiando...' : 'Cambiar contraseña'}
              </button>
              <button
                type="button"
                onClick={() => setShowPasswordForm(false)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Sección 3: MFA / 2FA */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <header className="mb-4">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-slate-500" />
            Autenticación de dos factores (2FA)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Añade una capa extra con un código TOTP (Google Authenticator, 1Password, Authy).
          </p>
        </header>

        {initial.mfaEnabled ? (
          <div className="flex items-start gap-3 rounded-md bg-emerald-50 border border-emerald-200 p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-900">
                2FA activada
              </p>
              <p className="text-xs text-emerald-700 mt-1">
                Factor registrado: <code className="font-mono">{initial.mfaFriendlyName ?? 'TOTP'}</code>.
                Cada login pedirá tu código de 6 dígitos.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-md bg-amber-50 border border-amber-200 p-4">
              <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">
                  2FA no activada
                </p>
                <p className="text-xs text-amber-800 mt-1">
                  Recomendamos activarla para la cuenta owner. Si alguien obtiene tu contraseña, el código del authenticator impide el acceso.
                </p>
              </div>
            </div>

            <Link
              href="/configuracion/cuenta/mfa/enroll"
              className="inline-flex items-center gap-2 rounded-md bg-[var(--brand-color,#0B4B8C)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <ShieldCheck className="h-4 w-4" />
              Activar 2FA
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
