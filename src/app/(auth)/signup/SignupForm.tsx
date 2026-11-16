'use client'

import { useActionState, useState } from 'react'
import { signupAction, type AuthState } from '../actions'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'

const initialState: AuthState = {}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initialState)
  const [gymName, setGymName] = useState('')
  const [gymSlug, setGymSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)

  const handleGymNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setGymName(value)
    if (!slugEdited) {
      setGymSlug(slugify(value))
    }
  }

  return (
    <div className="space-y-4">
      <GoogleSignInButton redirectTo="/auth/confirm" label="Registrarse con Google" />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-slate-500">o con email</span>
        </div>
      </div>

      <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
          placeholder="tu@gym.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
        />
        <p className="mt-1 text-xs text-slate-500">Mínimo 8 caracteres</p>
      </div>

      <div className="my-4 border-t border-slate-200 pt-4">
        <p className="mb-3 text-sm font-medium text-slate-700">Datos del gym</p>
      </div>

      <div>
        <label htmlFor="gymName" className="block text-sm font-medium text-slate-700">
          Nombre del gym
        </label>
        <input
          id="gymName"
          name="gymName"
          type="text"
          required
          maxLength={100}
          value={gymName}
          onChange={handleGymNameChange}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
          placeholder="Demo Studio Madrid"
        />
      </div>

      <div>
        <label htmlFor="gymSlug" className="block text-sm font-medium text-slate-700">
          Identificador (URL)
        </label>
        <div className="mt-1 flex items-center rounded-lg border border-slate-300 focus-within:border-[#3b8bea] focus-within:ring-1 focus-within:ring-[#3b8bea]">
          <span className="px-3 text-sm text-slate-500">fitflow.app/</span>
          <input
            id="gymSlug"
            name="gymSlug"
            type="text"
            required
            pattern="[a-z0-9-]{3,50}"
            value={gymSlug}
            onChange={(e) => {
              setSlugEdited(true)
              setGymSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
            }}
            className="block w-full rounded-r-lg px-0 py-2 text-sm focus:outline-none"
            placeholder="demo-studio-madrid"
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          3-50 caracteres. Solo minúsculas, números y guiones.
        </p>
      </div>

      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state.success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {state.success}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[#3b8bea] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#2d7ad8] focus:outline-none focus:ring-2 focus:ring-[#3b8bea] focus:ring-offset-2 disabled:opacity-60"
      >
        {pending ? 'Creando cuenta...' : 'Crear cuenta'}
      </button>
      </form>
    </div>
  )
}
