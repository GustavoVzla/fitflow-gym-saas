'use client'

import { useState, useTransition, useMemo } from 'react'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { registerForCompetitionAction } from './actions'

interface Props {
  competitionSlug: string
  gymId: string
  categories: string[]
}

const inputClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none'
const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5'

export default function CompetitionRegistrationForm({
  competitionSlug,
  gymId,
  categories,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{
    success?: string
    error?: string
    waitlisted?: boolean
  } | null>(null)

  // Timestamp render para anti-spam (debe pasar >=3s antes de submit)
  const renderedAt = useMemo(() => Date.now(), [])

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [category, setCategory] = useState(categories[0] ?? '')
  const [notes, setNotes] = useState('')
  const [accepted, setAccepted] = useState(false)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!accepted) {
      setResult({ error: 'Debes aceptar la política de privacidad para continuar.' })
      return
    }

    const fd = new FormData()
    fd.set('competitionSlug', competitionSlug)
    fd.set('gymId', gymId)
    fd.set('firstName', firstName)
    fd.set('lastName', lastName)
    fd.set('email', email)
    fd.set('phone', phone)
    fd.set('category', category)
    fd.set('notes', notes)
    fd.set('renderedAt', String(renderedAt))
    // Honeypot: hidden field `website` — si rellenado, bot

    startTransition(async () => {
      const res = await registerForCompetitionAction({}, fd)
      setResult(res)
    })
  }

  // Estado: inscripción exitosa → mostrar mensaje
  if (result?.success) {
    return (
      <div className="flex flex-col items-center text-center py-8">
        <CheckCircle2
          className={`h-12 w-12 mb-3 ${result.waitlisted ? 'text-amber-500' : 'text-emerald-500'}`}
        />
        <h3 className="text-lg font-bold text-slate-900">
          {result.waitlisted ? '¡Inscripción en lista de espera!' : '¡Inscripción completada!'}
        </h3>
        <p className="mt-2 text-sm text-slate-600 max-w-md">{result.success}</p>
        <p className="mt-4 text-xs text-slate-400">
          Si no recibes el email en 5 min, revisa tu carpeta de spam.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Honeypot: campo oculto que bots rellenan */}
      <div className="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          No rellenar (honeypot)
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="firstName">
            Nombre *
          </label>
          <input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            maxLength={100}
            autoComplete="given-name"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="lastName">
            Apellidos *
          </label>
          <input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            maxLength={100}
            autoComplete="family-name"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="email">
            Email *
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="tu@email.com"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="phone">
            Teléfono
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="+34 600 000 000"
            className={inputClass}
          />
        </div>
      </div>

      {categories.length > 0 && (
        <div>
          <label className={labelClass} htmlFor="category">
            Categoría *
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className={inputClass}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelClass} htmlFor="notes">
          Comentarios adicionales (opcional)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Alergias, restricciones, equipo de acompañantes..."
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none resize-none"
        />
      </div>

      <label className="flex items-start gap-2 cursor-pointer text-sm text-slate-700">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="h-4 w-4 mt-0.5 flex-shrink-0"
          required
        />
        <span className="text-xs leading-relaxed">
          Acepto la{' '}
          <a
            href="/privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3b8bea] underline"
          >
            política de privacidad
          </a>{' '}
          y el tratamiento de mis datos personales para la gestión de mi inscripción.
        </span>
      </label>

      {result?.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{result.error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={pending || !accepted}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#3b8bea] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#2a6fc7] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Enviando...
          </>
        ) : (
          'Inscribirme'
        )}
      </button>
    </form>
  )
}
