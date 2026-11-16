'use client'

import { useState, useTransition } from 'react'
import { sendMagicLinkAction, signInWithPasswordAction } from './actions'
import { GoogleSignInButton } from './GoogleSignInButton'

type Mode = 'password' | 'magiclink'

export function LoginForm({
  redirectTo,
  initialMessage,
  initialError,
}: {
  redirectTo: string
  initialMessage?: string
  initialError?: string
}) {
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(initialMessage ?? null)
  const [error, setError] = useState<string | null>(initialError ?? null)

  function handleSubmit(formData: FormData) {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      if (mode === 'password') {
        const result = await signInWithPasswordAction(formData)
        // Si OK, server hace redirect — solo llegamos aquí en error.
        if (result.error) setError(result.error)
      } else {
        const result = await sendMagicLinkAction(formData)
        if (result.error) {
          setError(result.error)
        } else {
          setMessage(
            result.message ?? 'Te hemos enviado un enlace de acceso. Revisa tu correo.'
          )
          setEmail('')
        }
      }
    })
  }

  function switchMode(newMode: Mode) {
    setMode(newMode)
    setMessage(null)
    setError(null)
  }

  return (
    <div className="flex flex-col gap-5">
      <GoogleSignInButton redirectTo={redirectTo} />

      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-[rgba(255,255,255,0.08)]" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgba(240,240,245,0.4)]">
          o accede con tu correo
        </span>
        <div className="h-px flex-1 bg-[rgba(255,255,255,0.08)]" />
      </div>

      <form action={handleSubmit} className="flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />

      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-xs font-medium text-[rgba(240,240,245,0.6)]"
        >
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="tu@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-3.5 text-base text-[#f0f0f5] placeholder-[rgba(240,240,245,0.25)] outline-none transition focus:border-[rgba(59,139,234,0.6)] focus:ring-2 focus:ring-[rgba(59,139,234,0.15)] disabled:opacity-50"
        />
      </div>

      {mode === 'password' && (
        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-xs font-medium text-[rgba(240,240,245,0.6)]"
          >
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
            className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-3.5 text-base text-[#f0f0f5] placeholder-[rgba(240,240,245,0.25)] outline-none transition focus:border-[rgba(59,139,234,0.6)] focus:ring-2 focus:ring-[rgba(59,139,234,0.15)] disabled:opacity-50"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={pending || !email || (mode === 'password' && !password)}
        className="mt-2 rounded-xl bg-[#3b8bea] px-4 py-3.5 text-sm font-semibold uppercase tracking-wider text-[#0d0d1a] transition hover:bg-[#5da0ef] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending
          ? mode === 'password'
            ? 'Entrando…'
            : 'Enviando…'
          : mode === 'password'
            ? 'Acceder'
            : 'Enviar enlace de acceso'}
      </button>

      <button
        type="button"
        onClick={() => switchMode(mode === 'password' ? 'magiclink' : 'password')}
        disabled={pending}
        className="text-center text-xs text-[rgba(240,240,245,0.5)] underline-offset-2 hover:text-[#5da0ef] hover:underline disabled:opacity-50"
      >
        {mode === 'password'
          ? '¿Prefieres recibir un enlace por correo?'
          : 'Volver a acceso con contraseña'}
      </button>

      {message ? (
        <div className="mt-2 rounded-lg border border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.08)] px-4 py-3 text-sm text-[#34d399]">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-2 rounded-lg border border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.08)] px-4 py-3 text-sm text-[#f87171]">
          {error}
        </div>
      ) : null}
      </form>
    </div>
  )
}
