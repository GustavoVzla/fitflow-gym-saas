'use client'

import { useState, useTransition } from 'react'
import { Briefcase, Clock } from 'lucide-react'
import { endCheckInAction, startCheckInAction } from '@/app/(member)/_actions/check-in'

type Props = {
  /** ISO timestamp del fichaje abierto, o null si no hay sesión activa. */
  activeCheckedInAt: string | null
}

/**
 * Sección de jornada en /cuenta para trainers.
 * - Si hay sesión activa → muestra "Trabajando desde HH:MM" + botón "Finalizar jornada"
 * - Si no hay sesión → muestra "Sin fichar hoy" + botón "Iniciar jornada"
 *
 * Toda interacción usa Server Actions con sanitize errors.
 */
export function CheckInStatus({ activeCheckedInAt }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isActive = !!activeCheckedInAt
  const startedAtLabel = activeCheckedInAt
    ? new Intl.DateTimeFormat('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Madrid',
      }).format(new Date(activeCheckedInAt))
    : null

  function handleStart() {
    setError(null)
    startTransition(async () => {
      const result = await startCheckInAction(new FormData())
      if (!result.ok) setError(result.error)
    })
  }

  function handleEnd() {
    setError(null)
    startTransition(async () => {
      const result = await endCheckInAction()
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {isActive ? (
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          ) : (
            <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
          )}
          <div>
            <p className="text-sm font-medium text-white">
              {isActive ? 'Jornada activa' : 'Sin fichar hoy'}
            </p>
            <p className="mt-0.5 text-xs text-white/50">
              {isActive
                ? `Trabajando desde las ${startedAtLabel}.`
                : 'Inicia tu jornada cuando llegues al estudio.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={isActive ? handleEnd : handleStart}
          disabled={pending}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
            isActive
              ? 'bg-white/10 text-white/80 hover:bg-white/15'
              : 'bg-brand text-white hover:bg-brand/90'
          }`}
        >
          {pending ? '…' : isActive ? 'Finalizar' : 'Iniciar'}
        </button>
      </div>
      {error ? (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p>
      ) : null}
    </div>
  )
}
