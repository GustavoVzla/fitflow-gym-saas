'use client'

import { useActionState } from 'react'
import { loginAction, type AuthState } from '../actions'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'

const initialState: AuthState = {}

// Política PO (24-abr-2026): "todo debe tener Google Auth".
// El botón queda siempre visible. Si el redirect OAuth falla es B5 backend
// (PO resuelve en paralelo creando OAuth Client nuevo en GCP
// accesible + update Supabase Auth Provider Google).
// Runbook: (internal docs, not included)
const SHOW_GOOGLE_OAUTH = true

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState)

  return (
    <div className="space-y-4">
      {SHOW_GOOGLE_OAUTH && (
        <>
          <GoogleSignInButton redirectTo={redirectTo} />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-slate-500">o con email</span>
            </div>
          </div>
        </>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="redirect" value={redirectTo} />

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-slate-700"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
          placeholder="tu@email.com"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-slate-700"
        >
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
        />
      </div>

      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[#3b8bea] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#2d7ad8] focus:outline-none focus:ring-2 focus:ring-[#3b8bea] focus:ring-offset-2 disabled:opacity-60"
      >
        {pending ? 'Entrando...' : 'Entrar'}
      </button>
      </form>
    </div>
  )
}
