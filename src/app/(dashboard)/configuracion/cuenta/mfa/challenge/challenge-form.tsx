'use client'

import { useActionState } from 'react'
import { verifyChallengeAction, type ChallengeState } from './actions'

const initialState: ChallengeState = {}

export function ChallengeForm({ factorId }: { factorId: string }) {
  const [state, formAction, pending] = useActionState(verifyChallengeAction, initialState)

  return (
    <form action={formAction} className="border border-slate-200 rounded-lg p-6 bg-white space-y-4">
      <input type="hidden" name="factorId" value={factorId} />
      <div>
        <label htmlFor="code" className="block text-sm font-medium mb-1">
          Código de 6 dígitos
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          placeholder="123456"
          className="w-full px-3 py-2 border border-slate-300 rounded text-lg font-mono tracking-widest text-center"
        />
      </div>
      {state.error && (
        <p className="text-red-600 text-sm" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[var(--brand-color,#0B4B8C)] text-white py-2 rounded font-medium hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Verificando...' : 'Verificar'}
      </button>
    </form>
  )
}
