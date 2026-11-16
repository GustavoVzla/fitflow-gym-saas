'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Users, Clock, MapPin, Filter, X } from 'lucide-react'
import type { ClassListItem } from './data'
import { bookClassAction, cancelBookingAction } from './actions'
import {
  formatTime,
  formatDayHeader,
  formatDayPill,
  dayKeyMadrid,
} from '@/lib/datetime'

type Filters = {
  instructors: { id: string; name: string }[]
  classTypes: string[]
}

export function ClasesClient({
  initialClasses,
  filters,
  activeInstructor,
  activeType,
  activeDay,
}: {
  initialClasses: ClassListItem[]
  filters: Filters
  activeInstructor: string | null
  activeType: string | null
  activeDay: string | null
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [showFilters, setShowFilters] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(
    null
  )

  // Agrupar por día (key YYYY-MM-DD en TZ Madrid, no UTC)
  const grouped = useMemo(() => {
    const map = new Map<string, ClassListItem[]>()
    for (const c of initialClasses) {
      const key = dayKeyMadrid(c.startAt)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return Array.from(map.entries())
  }, [initialClasses])

  // Day-selector: días únicos disponibles + ISO original para navegación
  const dayOptions = useMemo(() => {
    return grouped.map(([key, items]) => ({
      key,
      iso: items[0].startAt,
      pill: formatDayPill(items[0].startAt),
      count: items.length,
    }))
  }, [grouped])

  function updateFilter(key: 'instructor' | 'type' | 'day', value: string | null) {
    const sp = new URLSearchParams(params)
    if (value) sp.set(key, value)
    else sp.delete(key)
    router.push(`/clases?${sp.toString()}`)
  }

  function clearFilters() {
    setShowFilters(false)
    router.push('/clases')
  }

  function handleBook(instanceId: string) {
    setToast(null)
    const fd = new FormData()
    fd.set('instanceId', instanceId)
    startTransition(async () => {
      const res = await bookClassAction(fd)
      if (res.ok) {
        setToast({
          type: 'success',
          msg:
            res.status === 'waitlist'
              ? 'Estás en lista de espera. Te avisaremos si entras.'
              : 'Reserva confirmada.',
        })
        router.refresh()
      } else {
        setToast({ type: 'error', msg: res.error ?? 'Error al reservar' })
      }
    })
  }

  function handleCancel(bookingId: string) {
    setToast(null)
    const fd = new FormData()
    fd.set('bookingId', bookingId)
    startTransition(async () => {
      const res = await cancelBookingAction(fd)
      if (res.ok) {
        setToast({ type: 'success', msg: 'Reserva cancelada.' })
        router.refresh()
      } else {
        setToast({ type: 'error', msg: res.error ?? 'Error al cancelar' })
      }
    })
  }

  const hasFilters = Boolean(activeInstructor || activeType || activeDay)
  const activeDayKey = activeDay
    ? dayKeyMadrid(new Date(activeDay + 'T12:00:00'))
    : null

  return (
    <div className="space-y-5">
      {/* Header sección */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[22px] font-bold text-[#f0f0f5]">
            Reservar
          </h2>
          <p className="text-[13px] text-[rgba(240,240,245,0.55)]">
            Próximos 7 días en tu gym
          </p>
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
            hasFilters || showFilters
              ? 'border-[rgba(59,139,234,0.4)] bg-[rgba(59,139,234,0.1)] text-[#5da0ef]'
              : 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[rgba(240,240,245,0.6)]'
          }`}
          aria-label="Filtros"
        >
          <Filter className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </div>

      {/* Day-selector pills horizontales */}
      {dayOptions.length > 0 && (
        <div className="day-selector -mx-2 flex gap-2 overflow-x-auto px-2 pb-1.5">
          <button
            onClick={() => updateFilter('day', null)}
            className={`flex shrink-0 flex-col items-center justify-center rounded-2xl border px-3.5 py-2.5 text-center transition ${
              !activeDayKey
                ? 'border-[rgba(59,139,234,0.5)] bg-[rgba(59,139,234,0.12)] text-[#5da0ef]'
                : 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[rgba(240,240,245,0.6)] hover:bg-[rgba(255,255,255,0.07)]'
            }`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
              Todo
            </span>
            <span className="font-[family-name:var(--font-display)] text-[16px] font-bold leading-tight">
              {initialClasses.length}
            </span>
          </button>
          {dayOptions.map(({ key, iso, pill, count }) => {
            const isActive = activeDayKey === key
            return (
              <button
                key={key}
                onClick={() => updateFilter('day', isoDayInput(iso))}
                className={`flex min-w-[60px] shrink-0 flex-col items-center justify-center rounded-2xl border px-2.5 py-2.5 text-center transition ${
                  isActive
                    ? 'border-[rgba(59,139,234,0.5)] bg-[rgba(59,139,234,0.12)] text-[#5da0ef]'
                    : 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[rgba(240,240,245,0.6)] hover:bg-[rgba(255,255,255,0.07)]'
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
                  {pill.weekday}
                </span>
                <span className="font-[family-name:var(--font-display)] text-[18px] font-bold leading-tight">
                  {pill.day}
                </span>
                <span className="mt-0.5 text-[9px] uppercase tracking-[0.05em] text-[rgba(240,240,245,0.4)]">
                  {count} clase{count === 1 ? '' : 's'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Panel filtros desplegable */}
      {showFilters && (
        <section className="space-y-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeInstructor ?? ''}
              onChange={(e) => updateFilter('instructor', e.target.value || null)}
              className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-xs text-[#f0f0f5] outline-none focus:border-[rgba(59,139,234,0.4)]"
            >
              <option value="">Todos los instructores</option>
              {filters.instructors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
            <select
              value={activeType ?? ''}
              onChange={(e) => updateFilter('type', e.target.value || null)}
              className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-xs text-[#f0f0f5] outline-none focus:border-[rgba(59,139,234,0.4)]"
            >
              <option value="">Todos los tipos</option>
              {filters.classTypes.map((t) => (
                <option key={t} value={t}>
                  {labelType(t)}
                </option>
              ))}
            </select>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 rounded-lg border border-[rgba(248,113,113,0.3)] px-3 py-2 text-xs text-[#f87171] hover:bg-[rgba(248,113,113,0.08)]"
              >
                <X className="h-3 w-3" /> Limpiar
              </button>
            )}
          </div>
        </section>
      )}

      {toast && (
        <div
          className={
            toast.type === 'success'
              ? 'rounded-xl border border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.08)] px-4 py-3 text-sm text-[#34d399]'
              : 'rounded-xl border border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.08)] px-4 py-3 text-sm text-[#f87171]'
          }
        >
          {toast.msg}
        </div>
      )}

      {/* Listado */}
      {grouped.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="text-sm text-[rgba(240,240,245,0.5)]">
            {hasFilters
              ? 'No hay clases con estos filtros.'
              : 'No hay clases programadas próximamente.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([dayKey, items]) => (
            <section key={dayKey}>
              <h3
                className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5da0ef]"
                suppressHydrationWarning
              >
                {formatDayHeader(items[0].startAt)}
              </h3>
              <ul className="space-y-2">
                {items.map((c) => (
                  <ClassCard
                    key={c.instanceId}
                    c={c}
                    pending={pending}
                    onBook={() => handleBook(c.instanceId)}
                    onCancel={() => c.myBookingId && handleCancel(c.myBookingId)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function ClassCard({
  c,
  pending,
  onBook,
  onCancel,
}: {
  c: ClassListItem
  pending: boolean
  onBook: () => void
  onCancel: () => void
}) {
  const isFull = c.maxSpots != null && c.bookedCount >= c.maxSpots
  const myBooking = c.myBookingStatus !== null
  const occupancyRatio = c.maxSpots ? c.bookedCount / c.maxSpots : 0

  // Color semántico de plazas
  const spotsColor =
    isFull
      ? 'text-[#f87171] bg-[rgba(248,113,113,0.1)] border-[rgba(248,113,113,0.3)]'
      : occupancyRatio >= 0.7
        ? 'text-[#f59e0b] bg-[rgba(245,158,11,0.1)] border-[rgba(245,158,11,0.3)]'
        : 'text-[#34d399] bg-[rgba(52,211,153,0.1)] border-[rgba(52,211,153,0.3)]'

  return (
    <li className="glass-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {c.color && (
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: c.color }}
              />
            )}
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[rgba(240,240,245,0.4)]">
              {labelType(c.classType)}
            </span>
          </div>
          <h3 className="mt-1 font-[family-name:var(--font-display)] text-[16px] font-semibold leading-tight text-[#f0f0f5]">
            {c.className}
          </h3>
          <div
            className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[rgba(240,240,245,0.55)]"
            suppressHydrationWarning
          >
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" strokeWidth={1.8} />
              {formatTime(c.startAt)} – {formatTime(c.endAt)}
            </span>
            {c.instructorName && <span>{c.instructorName}</span>}
            {c.room && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" strokeWidth={1.8} /> {c.room}
              </span>
            )}
          </div>
          {c.maxSpots != null && (
            <div className="mt-2 inline-flex items-center gap-1.5">
              <span
                className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${spotsColor}`}
              >
                <Users className="h-2.5 w-2.5" strokeWidth={2} />
                {isFull ? 'Lleno' : `${c.maxSpots - c.bookedCount} libres`}
              </span>
              {c.waitlistCount > 0 && (
                <span className="text-[10px] text-[rgba(240,240,245,0.45)]">
                  +{c.waitlistCount} en espera
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {myBooking ? (
            <>
              <span
                className={
                  c.myBookingStatus === 'waitlist'
                    ? 'rounded-full bg-[rgba(245,158,11,0.15)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#f59e0b]'
                    : 'rounded-full bg-[rgba(52,211,153,0.15)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#34d399]'
                }
              >
                {c.myBookingStatus === 'waitlist' ? 'En espera' : 'Reservado'}
              </span>
              <button
                onClick={onCancel}
                disabled={pending}
                className="rounded-lg border border-[rgba(248,113,113,0.3)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#f87171] transition hover:bg-[rgba(248,113,113,0.08)] disabled:opacity-50"
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={onBook}
              disabled={pending}
              className={
                isFull
                  ? 'rounded-lg border border-[rgba(245,158,11,0.4)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#f59e0b] transition hover:bg-[rgba(245,158,11,0.08)] disabled:opacity-50'
                  : 'rounded-lg bg-[#3b8bea] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0d0d1a] shadow-[0_0_12px_rgba(59,139,234,0.2)] transition hover:bg-[#5da0ef] disabled:opacity-50'
              }
            >
              {isFull ? 'Lista espera' : pending ? 'Reservando…' : 'Reservar'}
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

/**
 * Devuelve YYYY-MM-DD que el `<input type="date">` acepta en value,
 * en TZ Madrid (no UTC). Reusa dayKeyMadrid del shared lib.
 */
function isoDayInput(iso: string): string {
  return dayKeyMadrid(iso)
}

function labelType(type: string): string {
  const map: Record<string, string> = {
    crossfit: 'CrossFit',
    yoga: 'Yoga',
    pilates: 'Pilates',
    spinning: 'Spinning',
    funcional: 'Funcional',
    boxeo: 'Boxeo',
    barras: 'Barras',
    animal_flow: 'Animal Flow',
    entrenamiento_personal: 'PT',
    grupal: 'Grupal',
    clase: 'Clase',
  }
  return map[type] ?? type
}
