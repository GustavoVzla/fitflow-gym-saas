/**
 * Date helpers — siempre en TZ Europe/Madrid.
 *
 * BUG fix: la app y el panel viven en UTC en producción (Vercel). Si formateamos
 * sin timeZone explícito, server renderiza UTC y client re-renderiza local
 * → React #418 hydration mismatch + horas incorrectas.
 *
 * Patrón ya aplicado por Web en PR #6 dc8b270.
 */

const TZ = 'Europe/Madrid'

/**
 * "viernes, 24 de abril · 07:30"
 * Pensado para la card "Próxima clase" del demo.
 */
export function formatClassDateTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  }).format(date)
}

/**
 * "07:30" — solo hora, ej. para badges en listado clases.
 */
export function formatTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  }).format(date)
}

/**
 * "viernes 24 abril" — header de día en day-selector / agrupación clases.
 */
export function formatDayHeader(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TZ,
  }).format(date)
}

/**
 * "24 abr" — pill compacto día.
 */
export function formatDayShort(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    timeZone: TZ,
  }).format(date)
}

/**
 * "24 abr 2026" — historial pagos.
 */
export function formatDateLong(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  }).format(date)
}

/**
 * YYYY-MM-DD en TZ Madrid (clave de agrupación). NO usar el ISO substring(0,10)
 * porque eso usa UTC y descuelga clases nocturnas en el día siguiente.
 */
export function dayKeyMadrid(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  // sv-SE devuelve YYYY-MM-DD ISO-like + es lo más estable cross-runtime
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: TZ,
  }).format(date)
}

/**
 * "Mié 24" — etiqueta del day-pill (abreviatura día semana + número día).
 */
export function formatDayPill(iso: string | Date): { weekday: string; day: string } {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'short', timeZone: TZ })
    .format(date)
    .replace('.', '')
  const day = new Intl.DateTimeFormat('es-ES', { day: 'numeric', timeZone: TZ }).format(date)
  return { weekday, day }
}

/**
 * Diff ms entre 'futuro' y 'ahora'. Negativo si ya pasó.
 * Útil para countdowns sin depender de TZ (ms es absoluto).
 */
export function msUntil(iso: string | Date, from: Date = new Date()): number {
  const target = typeof iso === 'string' ? new Date(iso) : iso
  return target.getTime() - from.getTime()
}

/**
 * { hours, minutes, seconds, expired } a partir de ms.
 * Si negativo → expired=true, valores en 0.
 */
export function breakdownDuration(ms: number): {
  days: number
  hours: number
  minutes: number
  seconds: number
  expired: boolean
} {
  if (ms <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
  }
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return { days, hours, minutes, seconds, expired: false }
}

/**
 * "Vence en X días" / "Vence hoy" / "Vencido hace X días".
 * Para badges pagos pendientes.
 */
export function formatDueLabel(dueIso: string | null): {
  label: string
  status: 'overdue' | 'due-today' | 'soon' | 'later'
} {
  if (!dueIso) return { label: 'Sin fecha límite', status: 'later' }
  const ms = msUntil(dueIso)
  const days = Math.floor(ms / 86400000)
  if (days < 0) {
    const abs = Math.abs(days)
    return { label: `Vencido hace ${abs} día${abs === 1 ? '' : 's'}`, status: 'overdue' }
  }
  if (days === 0) return { label: 'Vence hoy', status: 'due-today' }
  if (days <= 7) return { label: `Vence en ${days} día${days === 1 ? '' : 's'}`, status: 'soon' }
  return { label: `Vence en ${days} días`, status: 'later' }
}

export const MADRID_TZ = TZ
