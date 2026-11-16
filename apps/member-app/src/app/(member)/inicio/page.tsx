import Link from 'next/link'
import { Calendar, Clock, CreditCard, User, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  formatClassDateTime,
  dayKeyMadrid,
  formatDueLabel,
  MADRID_TZ,
} from '@/lib/datetime'
import { NextClassCountdown } from './NextClassCountdown'
import { CheckInModal } from '@/components/checkin/CheckInModal'
import { CheckInStatus } from '@/components/checkin/CheckInStatus'
import { getViewerContext } from '@/lib/viewer'
import { getActiveCheckIn, hasCheckedInToday } from '@/lib/instructor'

export const metadata = { title: 'Inicio' }
export const dynamic = 'force-dynamic'

type NextBookingShape = {
  id: string
  status: string
  class_instance: {
    id: string
    start_at: string
    end_at: string
    room: string | null
    class: { name: string }
    instructor: { name: string } | null
  }
} | null

export default async function InicioPage() {
  const viewer = await getViewerContext()
  if (!viewer || viewer.type === 'unknown') return null

  // Trainer landing — propio (sin clases reservar / pagos / progreso socio)
  if (viewer.type === 'trainer') {
    const active = await getActiveCheckIn(viewer.instructorId)
    const checkedInToday = await hasCheckedInToday(viewer.instructorId)
    return (
      <div className="space-y-6">
        <CheckInModal visible={!checkedInToday && !active} />
        <section>
          <p className="text-[14px] text-[rgba(240,240,245,0.6)]">
            Tu jornada en Demo Studio.
          </p>
        </section>
        <section>
          <h2 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(240,240,245,0.5)]">
            Fichaje
          </h2>
          <CheckInStatus activeCheckedInAt={active?.checkedInAt ?? null} />
        </section>
      </div>
    )
  }

  // Socio (member) — vista original
  const supabase = await createClient()

  const { data: member } = await supabase
    .from('members')
    .select('id, first_name, last_name, member_number, gym_id, current_tariff_id')
    .eq('auth_user_id', viewer.userId)
    .maybeSingle()

  if (!member) return null

  const { data: tariffRow } = member.current_tariff_id
    ? await supabase
        .from('tariffs')
        .select('name')
        .eq('id', member.current_tariff_id)
        .maybeSingle()
    : { data: null }

  const { data: gymRow } = await supabase
    .from('gyms')
    .select('name, slug')
    .eq('id', member.gym_id)
    .maybeSingle()

  const todayIso = new Date().toISOString()

  // Próxima reserva del socio
  const { data: nextBooking } = await supabase
    .from('bookings')
    .select(
      `
      id,
      status,
      class_instance:class_instances!inner (
        id,
        start_at,
        end_at,
        room,
        class:classes!inner ( name ),
        instructor:instructors ( name )
      )
    `
    )
    .eq('member_id', member.id)
    .neq('status', 'cancelled')
    .gte('class_instance.start_at', todayIso)
    .order('class_instance(start_at)', { ascending: true })
    .limit(1)
    .maybeSingle()

  const next = nextBooking as NextBookingShape

  // Pagos pendientes (top 1 para mostrar inline)
  const { data: pendingPayments } = await supabase
    .from('payments')
    .select('id, amount, currency, due_date, description')
    .eq('member_id', member.id)
    .eq('status', 'pending')
    .order('due_date', { ascending: true })
    .limit(3)

  const pendingCount = pendingPayments?.length ?? 0

  // Stats semana actual (hits a bookings con scope domingo a domingo Madrid)
  const startOfWeekMs = startOfIsoWeekMadrid(new Date())
  const weekStart = new Date(startOfWeekMs).toISOString()
  const weekEnd = new Date(startOfWeekMs + 7 * 86400000).toISOString()

  const { count: weekBookingsCount } = await supabase
    .from('bookings')
    .select('id, class_instance:class_instances!inner(start_at)', {
      count: 'exact',
      head: true,
    })
    .eq('member_id', member.id)
    .neq('status', 'cancelled')
    .gte('class_instance.start_at', weekStart)
    .lt('class_instance.start_at', weekEnd)

  const sessionsWeek = weekBookingsCount ?? 0

  // Aprox tiempo (asumimos 60 min/sesion default)
  const hoursWeek = (sessionsWeek * 60) / 60

  const fullName = [member.first_name, member.last_name].filter(Boolean).join(' ')
  const tariffName = tariffRow?.name ?? 'Sin tarifa'
  // YYYY-MM-DD hoy en TZ Madrid (para deeplink "Horario hoy" → /clases?day=YYYY-MM-DD)
  const todayKey = dayKeyMadrid(new Date())

  return (
    <div className="space-y-6">
      {/* Subtítulo motivacional — saludo viene del sticky header ("Hola, {member.first_name}") evita duplicado */}
      <section>
        <p className="text-[14px] text-[rgba(240,240,245,0.6)]">
          Tu cuerpo te lo agradece. Vamos.
        </p>
      </section>

      {/* HERO Próxima clase con countdown */}
      <section className="hero-card p-5">
        {next ? (
          <>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5da0ef]">
              <Clock className="h-3.5 w-3.5" />
              Próxima clase
            </div>
            <h3 className="mt-2.5 font-[family-name:var(--font-display)] text-[20px] font-bold leading-tight text-[#f0f0f5]">
              {next.class_instance.class.name}
            </h3>
            <div
              className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[rgba(240,240,245,0.6)]"
              suppressHydrationWarning
            >
              <span suppressHydrationWarning>
                {formatClassDateTime(next.class_instance.start_at)}
              </span>
              {next.class_instance.instructor && (
                <span className="opacity-60">·</span>
              )}
              {next.class_instance.instructor && (
                <span>con {next.class_instance.instructor.name}</span>
              )}
              {next.class_instance.room && (
                <span className="flex items-center gap-1 opacity-60">
                  <MapPin className="h-3 w-3" /> {next.class_instance.room}
                </span>
              )}
            </div>
            <NextClassCountdown startAtIso={next.class_instance.start_at} />
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[rgba(52,211,153,0.15)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#34d399]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" />
              {next.status === 'waitlist' ? 'En lista de espera' : 'Plaza confirmada'}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5da0ef]">
              <Calendar className="h-3.5 w-3.5" />
              Sin reservas próximas
            </div>
            <h3 className="mt-2.5 font-[family-name:var(--font-display)] text-[18px] font-bold leading-tight text-[#f0f0f5]">
              ¿Vamos al gym esta semana?
            </h3>
            <p className="mt-1 text-[13px] text-[rgba(240,240,245,0.6)]">
              Echa un vistazo al horario y reserva tu próxima clase.
            </p>
            <Link
              href="/clases"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#3b8bea] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#0d0d1a] shadow-[0_0_20px_rgba(59,139,234,0.25)] transition hover:bg-[#5da0ef]"
            >
              <Calendar className="h-3.5 w-3.5" /> Ver horario
            </Link>
          </>
        )}
      </section>

      {/* Quick actions — accesos directos sin duplicar header/tab bar */}
      <section>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction
            href="/clases"
            label="Reservar clase"
            icon={Calendar}
            iconBg="bg-[rgba(59,139,234,0.15)]"
            iconColor="text-[#3b8bea]"
          />
          <QuickAction
            href={`/clases?day=${todayKey}`}
            label="Horario hoy"
            icon={Clock}
            iconBg="bg-[rgba(96,165,250,0.15)]"
            iconColor="text-[#60a5fa]"
          />
          <QuickAction
            href="/pagos"
            label={pendingCount > 0 ? `Pagos (${pendingCount})` : 'Pagos'}
            icon={CreditCard}
            iconBg={
              pendingCount > 0
                ? 'bg-[rgba(248,113,113,0.15)]'
                : 'bg-[rgba(52,211,153,0.15)]'
            }
            iconColor={pendingCount > 0 ? 'text-[#f87171]' : 'text-[#34d399]'}
          />
          <QuickAction
            href="/cuenta"
            label="Mis datos"
            icon={User}
            iconBg="bg-[rgba(240,240,245,0.06)]"
            iconColor="text-[rgba(240,240,245,0.7)]"
          />
        </div>
      </section>

      {/* Weekly stats */}
      <section>
        <h3 className="mb-3 font-[family-name:var(--font-display)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(240,240,245,0.5)]">
          Esta semana
        </h3>
        <div className="flex gap-2.5">
          <StatPill value={String(sessionsWeek)} label="Sesiones" />
          <StatPill value={`${hoursWeek.toFixed(1)}h`} label="Tiempo" />
          <StatPill
            value={tariffName.includes('ilimitado') ? '∞' : tariffName.match(/\d+/)?.[0] ?? '—'}
            label="Plan/sem"
          />
        </div>
      </section>

      {/* Member card tipo carnet */}
      <section className="member-card p-5">
        <div className="relative z-[1] flex items-start justify-between">
          <div>
            <div className="font-[family-name:var(--font-display)] text-[16px] font-bold tracking-[0.18em] text-[#3b8bea]">
              {(gymRow?.name || 'DEMO_STUDIO').toUpperCase()}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-[rgba(240,240,245,0.45)]">
              Socio · {tariffName}
            </div>
          </div>
          <div className="rounded-full bg-[rgba(59,139,234,0.15)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#5da0ef]">
            Activo
          </div>
        </div>
        <div className="relative z-[1] mt-5">
          <div className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[#f0f0f5]">
            {fullName || 'Socio Demo Studio'}
          </div>
          <div className="mt-1 font-[family-name:var(--font-display)] text-[12px] tracking-[0.18em] text-[rgba(240,240,245,0.45)]">
            {member.member_number ?? '·····'}
          </div>
        </div>
      </section>

      {/* Si pagos pendientes — alerta inline */}
      {pendingCount > 0 && pendingPayments && (
        <section className="rounded-2xl border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.05)] p-5">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#f87171]">
            <CreditCard className="h-3.5 w-3.5" />
            {pendingCount} {pendingCount === 1 ? 'pago pendiente' : 'pagos pendientes'}
          </div>
          <ul className="space-y-2">
            {pendingPayments.map((p) => {
              const due = formatDueLabel(p.due_date)
              const dueColor =
                due.status === 'overdue'
                  ? 'text-[#f87171]'
                  : due.status === 'due-today'
                    ? 'text-[#f59e0b]'
                    : 'text-[rgba(240,240,245,0.6)]'
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between text-sm text-[#f0f0f5]"
                >
                  <span className={dueColor}>{due.label}</span>
                  <span className="font-[family-name:var(--font-display)] font-semibold">
                    {formatMoney(p.amount, p.currency)}
                  </span>
                </li>
              )
            })}
          </ul>
          <Link
            href="/pagos"
            className="mt-4 inline-block rounded-lg border border-[rgba(248,113,113,0.4)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#f87171] transition hover:bg-[rgba(248,113,113,0.08)]"
          >
            Ver todos los pagos
          </Link>
        </section>
      )}
    </div>
  )
}

function QuickAction({
  href,
  label,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  href: string
  label: string
  icon: typeof Calendar
  iconBg: string
  iconColor: string
}) {
  return (
    <Link
      href={href}
      className="glass-card flex items-center gap-3 p-4 hover:-translate-y-0.5"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${iconBg}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={1.8} />
      </div>
      <div className="text-[13px] font-semibold text-[#f0f0f5]">{label}</div>
    </Link>
  )
}

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-3.5 text-center">
      <div className="font-[family-name:var(--font-display)] text-[22px] font-bold leading-none text-[#f0f0f5]">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-[rgba(240,240,245,0.45)]">{label}</div>
    </div>
  )
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
  }).format(amount)
}

/**
 * Devuelve ms del lunes 00:00 TZ Madrid de la semana actual.
 */
function startOfIsoWeekMadrid(now: Date): number {
  // Construye día Madrid actual en formato YYYY-MM-DD
  const todayKey = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: MADRID_TZ,
  }).format(now)

  // Día semana basado en TZ Madrid (lunes=0, domingo=6 ISO)
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: MADRID_TZ,
  }).format(now)
  const weekdayMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  }
  const weekdayIdx = weekdayMap[weekday] ?? 0

  const todayMs = new Date(`${todayKey}T00:00:00+00:00`).getTime()
  // Aproximación: restamos los días desde el lunes (no compensa DST exacto pero es OK para count semanal)
  return todayMs - weekdayIdx * 86400000
}
