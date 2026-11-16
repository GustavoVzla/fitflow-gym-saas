'use client'

import { useEffect, useState } from 'react'
import { breakdownDuration, msUntil } from '@/lib/datetime'

/**
 * Timer "tic-tac" client-only para countdown a próxima clase.
 *
 * Se renderiza vacío en SSR (suppressHydrationWarning + condition isClient)
 * para evitar React #418 hydration mismatch con `Date.now()` server vs client.
 */
export function NextClassCountdown({ startAtIso }: { startAtIso: string }) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    // Marca primer tick client-only — evita mismatch SSR/hydrate
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Render placeholder estable en SSR
  if (!now) {
    return (
      <div className="mt-4 flex gap-2.5">
        <Block num="--" label="Días" />
        <Block num="--" label="Horas" />
        <Block num="--" label="Min" />
        <Block num="--" label="Seg" />
      </div>
    )
  }

  const ms = msUntil(startAtIso, now)
  const { days, hours, minutes, seconds, expired } = breakdownDuration(ms)

  if (expired) {
    return (
      <div className="mt-4 inline-block rounded-full border border-[rgba(59,139,234,0.3)] bg-[rgba(59,139,234,0.08)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#5da0ef]">
        Tu clase ha empezado
      </div>
    )
  }

  return (
    <div className="mt-4 flex gap-2.5">
      {days > 0 && <Block num={pad(days)} label="Días" />}
      <Block num={pad(hours)} label="Horas" />
      <Block num={pad(minutes)} label="Min" />
      <Block num={pad(seconds)} label="Seg" />
    </div>
  )
}

function Block({ num, label }: { num: string; label: string }) {
  return (
    <div
      className="min-w-[52px] rounded-lg bg-[rgba(0,0,0,0.3)] px-3.5 py-2 text-center"
      suppressHydrationWarning
    >
      <div className="font-[family-name:var(--font-display)] text-[22px] font-bold leading-none text-[#5da0ef]">
        {num}
      </div>
      <div className="mt-1 text-[9px] uppercase tracking-[0.05em] text-[rgba(240,240,245,0.35)]">
        {label}
      </div>
    </div>
  )
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}
