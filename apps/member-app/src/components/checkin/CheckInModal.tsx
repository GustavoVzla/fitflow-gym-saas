'use client'

import { useState, useTransition } from 'react'
import { Briefcase, X } from 'lucide-react'
import { startCheckInAction } from '@/app/(member)/_actions/check-in'

type Props = {
  visible: boolean
  /** Si true, intentamos pedir geolocation antes del POST. Decisión owner pendiente. */
  requestGeolocation?: boolean
}

/**
 * Modal "¿Comenzar tu jornada?" para trainers en /inicio. El server decide
 * `visible` (trainer + sin check-in hoy + no hay sesión abierta).
 *
 * sessionStorage persiste dismiss para no reaparecer hasta refresh manual.
 */
export function CheckInModal({ visible, requestGeolocation = false }: Props) {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return visible
    return visible && sessionStorage.getItem('checkin:dismissed') !== '1'
  })
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!open || !visible) return null

  function handleStart() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      if (requestGeolocation && 'geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          })
          fd.set('lat', String(pos.coords.latitude))
          fd.set('lng', String(pos.coords.longitude))
        } catch {
          // Sin permiso o timeout → continuamos sin geo
        }
      }
      const result = await startCheckInAction(fd)
      if (result.ok) {
        setOpen(false)
      } else {
        setError(result.error)
      }
    })
  }

  function dismiss() {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('checkin:dismissed', '1')
    }
    setOpen(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 cursor-default"
        onClick={dismiss}
      />
      <div className="relative w-full max-w-sm rounded-3xl bg-[#161628] p-6 shadow-2xl ring-1 ring-white/10">
        <button
          type="button"
          aria-label="Cerrar"
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/15 text-brand">
          <Briefcase className="h-5 w-5" />
        </div>
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-white">
          ¿Comenzar tu jornada?
        </h3>
        <p className="mt-1 text-sm text-white/60">
          Registra tu inicio de jornada en Demo Studio. Podrás cerrarla desde tu perfil al terminar.
        </p>

        {error ? (
          <p className="mt-3 rounded-xl bg-red-500/15 px-3 py-2 text-xs text-red-200">{error}</p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={handleStart}
            disabled={pending}
            className="flex-1 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand/90 disabled:opacity-60"
          >
            {pending ? 'Registrando…' : 'Comenzar jornada'}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full bg-white/10 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/20"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  )
}
