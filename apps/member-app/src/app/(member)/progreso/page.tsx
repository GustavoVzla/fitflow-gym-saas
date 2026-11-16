import { Flame, Calendar, Clock, TrendingUp, Award, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { dayKeyMadrid, MADRID_TZ } from '@/lib/datetime'

export const metadata = { title: 'Progreso' }
export const dynamic = 'force-dynamic'

type BookingRow = {
  id: string
  status: string
  class_instance: { start_at: string }
}

export default async function ProgresoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('members')
    .select('id, gym_id, current_tariff_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!member) return null

  const { data: tariff } = member.current_tariff_id
    ? await supabase
        .from('tariffs')
        .select('sessions_per_week')
        .eq('id', member.current_tariff_id)
        .maybeSingle()
    : { data: null }

  // Bookings últimos 60 días (para calcular racha + esta semana + mes)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString()
  const { data: bookingsRaw } = await supabase
    .from('bookings')
    .select(
      `
      id,
      status,
      class_instance:class_instances!inner ( start_at )
    `
    )
    .eq('member_id', member.id)
    .neq('status', 'cancelled')
    .gte('class_instance.start_at', sixtyDaysAgo)
    .order('class_instance(start_at)', { ascending: false })

  const bookings = (bookingsRaw ?? []) as BookingRow[]

  // Solo asistidas (start_at <= now)
  const now = Date.now()
  const past = bookings.filter((b) => new Date(b.class_instance.start_at).getTime() <= now)

  // Racha: días consecutivos hacia atrás desde hoy con al menos 1 booking past
  const pastDayKeys = new Set(past.map((b) => dayKeyMadrid(b.class_instance.start_at)))
  let streak = 0
  for (let i = 0; i < 60; i++) {
    const day = new Date(Date.now() - i * 86400000)
    const key = dayKeyMadrid(day)
    if (pastDayKeys.has(key)) {
      streak++
    } else if (i > 0) {
      break // Permite que hoy no tenga sesión sin romper la racha
    }
  }

  // Esta semana (lunes-domingo TZ Madrid)
  const startOfWeek = startOfIsoWeekMadrid(new Date())
  const endOfWeek = startOfWeek + 7 * 86400000
  const weekBookings = past.filter((b) => {
    const ts = new Date(b.class_instance.start_at).getTime()
    return ts >= startOfWeek && ts < endOfWeek
  })
  const weekHours = weekBookings.length // Aprox 1h/sesión

  // Distribución semanal por día (Lun=0..Dom=6)
  const weeklyByDay = [0, 0, 0, 0, 0, 0, 0]
  weekBookings.forEach((b) => {
    const idx = weekdayIndexMadrid(b.class_instance.start_at)
    weeklyByDay[idx]++
  })
  const maxDay = Math.max(...weeklyByDay, 1)

  // Mes actual (1 al último día)
  const monthStart = startOfMonthMadrid(new Date())
  const monthBookings = past.filter(
    (b) => new Date(b.class_instance.start_at).getTime() >= monthStart
  )
  const monthSessions = monthBookings.length
  const monthHours = monthSessions

  // % asistencia (sesiones reales vs sesiones esperadas según tarifa, mes actual)
  const targetMonth = (tariff?.sessions_per_week ?? 0) * 4
  const attendancePct = targetMonth > 0
    ? Math.min(100, Math.round((monthSessions / targetMonth) * 100))
    : null

  // Logros desbloqueados (rules simples)
  const totalSessions = past.length
  const achievements = [
    { id: 'first', label: 'Primera sesión', icon: CheckCircle2, unlocked: totalSessions >= 1 },
    { id: 'streak7', label: 'Racha 7 días', icon: Flame, unlocked: streak >= 7 },
    { id: 'sessions10', label: '10 sesiones', icon: Award, unlocked: totalSessions >= 10 },
    { id: 'sessions50', label: '50 sesiones', icon: TrendingUp, unlocked: totalSessions >= 50 },
  ]

  return (
    <div className="space-y-6">
      <h2 className="font-[family-name:var(--font-display)] text-[22px] font-bold text-[#f0f0f5]">
        Tu progreso
      </h2>

      {/* Racha hero */}
      <section className="hero-card flex items-center gap-4 p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[rgba(245,158,11,0.15)] ring-2 ring-[rgba(245,158,11,0.3)]">
          <Flame className="h-7 w-7 text-[#f59e0b]" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#f59e0b]">
            Racha activa
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-[family-name:var(--font-display)] text-[32px] font-bold leading-none text-[#f0f0f5]">
              {streak}
            </span>
            <span className="text-[13px] text-[rgba(240,240,245,0.55)]">
              {streak === 1 ? 'día' : 'días'} consecutivos
            </span>
          </div>
        </div>
      </section>

      {/* Esta semana — gráfico barras */}
      <section>
        <h3 className="mb-3 font-[family-name:var(--font-display)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(240,240,245,0.5)]">
          Esta semana
        </h3>
        <div className="glass-card p-4">
          <div className="flex items-end justify-between gap-2 h-28 mb-2">
            {weeklyByDay.map((count, i) => {
              const heightPct = maxDay > 0 ? (count / maxDay) * 100 : 0
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                  <span className="text-[10px] text-[rgba(240,240,245,0.6)] font-medium">
                    {count > 0 ? count : ''}
                  </span>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-[#3b8bea] to-[#5da0ef] min-h-[2px] transition-all"
                    style={{ height: `${Math.max(heightPct, count > 0 ? 8 : 2)}%` }}
                    aria-hidden="true"
                  />
                </div>
              )
            })}
          </div>
          <div className="flex justify-between text-[10px] uppercase tracking-[0.06em] text-[rgba(240,240,245,0.4)] font-medium">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
              <span key={d} className="flex-1 text-center">{d}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Resumen mes */}
      <section>
        <h3 className="mb-3 font-[family-name:var(--font-display)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(240,240,245,0.5)]">
          Este mes ({monthName(new Date())})
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Calendar} label="Sesiones" value={String(monthSessions)} />
          <StatCard icon={Clock} label="Tiempo" value={`${monthHours.toFixed(0)}h`} />
          {attendancePct !== null && (
            <StatCard icon={CheckCircle2} label="Asistencia" value={`${attendancePct}%`} accent="text-[#34d399]" />
          )}
          {tariff?.sessions_per_week && (
            <StatCard icon={TrendingUp} label="Plan/sem" value={String(tariff.sessions_per_week)} />
          )}
        </div>
      </section>

      {/* Logros */}
      <section>
        <h3 className="mb-3 font-[family-name:var(--font-display)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(240,240,245,0.5)]">
          Logros
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {achievements.map(({ id, label, icon: Icon, unlocked }) => (
            <div
              key={id}
              className={`glass-card flex items-center gap-3 p-3 ${
                unlocked ? '' : 'opacity-40'
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${
                  unlocked
                    ? 'bg-[rgba(232,168,56,0.15)] ring-1 ring-[rgba(232,168,56,0.3)]'
                    : 'bg-[rgba(255,255,255,0.04)]'
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${unlocked ? 'text-[#f0c060]' : 'text-[rgba(240,240,245,0.3)]'}`}
                  strokeWidth={1.8}
                />
              </div>
              <div className="text-[12px] font-semibold leading-tight text-[#f0f0f5]">
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="text-center text-[11px] text-[rgba(240,240,245,0.35)]">
        Datos calculados en tiempo real desde tus reservas.
      </p>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Calendar
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="glass-card flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(59,139,234,0.15)]">
        <Icon className={`h-5 w-5 ${accent ?? 'text-[#5da0ef]'}`} strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-[family-name:var(--font-display)] text-[20px] font-bold leading-none text-[#f0f0f5]">
          {value}
        </div>
        <div className="mt-0.5 text-[11px] text-[rgba(240,240,245,0.5)]">{label}</div>
      </div>
    </div>
  )
}

// Devuelve ms del lunes 00:00 TZ Madrid de la semana actual
function startOfIsoWeekMadrid(now: Date): number {
  const todayKey = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: MADRID_TZ,
  }).format(now)
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: MADRID_TZ,
  }).format(now)
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  const idx = map[weekday] ?? 0
  const todayMs = new Date(`${todayKey}T00:00:00+00:00`).getTime()
  return todayMs - idx * 86400000
}

// Devuelve ms del primer día del mes actual TZ Madrid (00:00)
function startOfMonthMadrid(now: Date): number {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: MADRID_TZ,
  }).format(now)
  // 'YYYY-MM' → primer día
  return new Date(`${ymd}-01T00:00:00+00:00`).getTime()
}

// Devuelve índice día semana (Lun=0..Dom=6) TZ Madrid
function weekdayIndexMadrid(iso: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: MADRID_TZ,
  }).format(new Date(iso))
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  return map[weekday] ?? 0
}

function monthName(d: Date): string {
  return new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: MADRID_TZ }).format(d)
}
