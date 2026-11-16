'use client'

import { useActionState } from 'react'
import { verifyEnrollAction, type EnrollState } from './actions'

const initialState: EnrollState = {}

export function EnrollForm({ factorId }: { factorId: string }) {
  const [state, formAction, pending] = useActionState(verifyEnrollAction, initialState)

  return (
    <form action={formAction} className="border rounded-lg p-6 bg-white space-y-4">
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
          placeholder="123456"
          className="w-full px-3 py-2 border rounded text-lg font-mono tracking-widest text-center"
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
        className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? 'Verificando...' : 'Activar 2FA'}
      </button>
    </form>
  )
}
