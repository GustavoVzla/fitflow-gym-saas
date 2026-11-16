import { CalendarDays, Phone, MapPin, Mail, Hash, LogOut, Building2, CreditCard, ChevronRight, FileText, Shield } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOutAction } from './actions'
import { studioBrand } from '../../theme'
import { PushNotificationsToggle } from '@/components/pwa/PushNotificationsToggle'
import { CheckInStatus } from '@/components/checkin/CheckInStatus'
import { getViewerContext } from '@/lib/viewer'
import { getActiveCheckIn } from '@/lib/instructor'

export const metadata = { title: 'Mi cuenta' }
export const dynamic = 'force-dynamic'

export default async function CuentaPage() {
  const viewer = await getViewerContext()
  if (!viewer || viewer.type === 'unknown') return null

  // Trainer: vista propia con check-in status + sign out (sin tarifas, pagos, RGPD socio)
  if (viewer.type === 'trainer') {
    const active = await getActiveCheckIn(viewer.instructorId)
    return (
      <div className="space-y-6">
        <h2 className="font-[family-name:var(--font-display)] text-[22px] font-bold text-[#f0f0f5]">
          Mi cuenta
        </h2>

        <section className="glass-card p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3b8bea] to-[#5da0ef] text-2xl font-bold uppercase text-[#0d0d1a]">
              {(viewer.firstName?.charAt(0) ?? 'E').toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[16px] font-semibold text-[#f0f0f5]">
                {viewer.fullName}
              </p>
              <p className="text-[12px] text-[rgba(240,240,245,0.5)]">Entrenador</p>
              {viewer.email ? (
                <p className="mt-1 truncate text-[12px] text-[rgba(240,240,245,0.4)]">{viewer.email}</p>
              ) : null}
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(240,240,245,0.5)]">
            Fichaje de jornada
          </h3>
          <CheckInStatus activeCheckedInAt={active?.checkedInAt ?? null} />
        </section>

        <section>
          <h3 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(240,240,245,0.5)]">
            Sesión
          </h3>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/[0.05]"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </form>
        </section>
      </div>
    )
  }

  // Socio (member) — vista original completa
  const supabase = await createClient()

  const { data: member } = await supabase
    .from('members')
    .select(
      'id, first_name, last_name, email, phone, birth_date, address, postal_code, city, member_number, gym_id, current_tariff_id, join_date'
    )
    .eq('auth_user_id', viewer.userId)
    .maybeSingle()

  if (!member) return null

  const { data: tariff } = member.current_tariff_id
    ? await supabase
        .from('tariffs')
        .select('name, price')
        .eq('id', member.current_tariff_id)
        .maybeSingle()
    : { data: null }

  const { data: gym } = await supabase
    .from('gyms')
    .select('name')
    .eq('id', member.gym_id)
    .maybeSingle()

  const fullName = [member.first_name, member.last_name].filter(Boolean).join(' ')
  const initials = (
    (member.first_name?.charAt(0) ?? '') + (member.last_name?.charAt(0) ?? '')
  )
    .toUpperCase()
    .padEnd(1, 'S')

  return (
    <div className="space-y-6">
      <h2 className="font-[family-name:var(--font-display)] text-[22px] font-bold text-[#f0f0f5]">
        Mi cuenta
      </h2>

      {/* Profile header */}
      <section className="glass-card p-5">
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold uppercase text-[#0d0d1a] shadow-[0_0_20px_rgba(59,139,234,0.3)]"
            style={{
              background:
                'linear-gradient(135deg, #5da0ef 0%, #3b8bea 50%, #c8901a 100%)',
            }}
          >
            {initials.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <h3 className="font-[family-name:var(--font-display)] text-[20px] font-semibold leading-tight text-[#f0f0f5]">
              {fullName || 'Socio Demo Studio'}
            </h3>
            {tariff && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[rgba(59,139,234,0.15)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#5da0ef]">
                {tariff.name}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Datos personales */}
      <section>
        <h3 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(240,240,245,0.5)]">
          Datos de contacto
        </h3>
        <dl className="glass-card divide-y divide-[rgba(255,255,255,0.06)]">
          <Row icon={Mail} label="Correo" value={member.email ?? viewer.email ?? '—'} />
          {member.phone && <Row icon={Phone} label="Teléfono" value={member.phone} />}
          {member.address && (
            <Row
              icon={MapPin}
              label="Dirección"
              value={[member.address, member.postal_code, member.city]
                .filter(Boolean)
                .join(', ')}
            />
          )}
        </dl>
      </section>

      <section>
        <h3 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(240,240,245,0.5)]">
          Tu cuenta
        </h3>
        <dl className="glass-card divide-y divide-[rgba(255,255,255,0.06)]">
          {member.member_number && (
            <Row icon={Hash} label="Nº socio" value={member.member_number} />
          )}
          {gym?.name && <Row icon={Building2} label="Gimnasio" value={gym.name} />}
          {member.join_date && (
            <Row
              icon={CalendarDays}
              label="Socio desde"
              value={formatJoinDate(member.join_date)}
            />
          )}
        </dl>
        <p className="mt-2 px-1 text-[11px] text-[rgba(240,240,245,0.4)]">
          Para modificar estos datos, contacta a {gym?.name ?? studioBrand.name}.
        </p>
      </section>

      {/* Notificaciones push — Bloque 2 sprint paridad 100% */}
      <section>
        <h3 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(240,240,245,0.5)]">
          Notificaciones
        </h3>
        <PushNotificationsToggle vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
      </section>

      {/* Pagos (consolidado en Perfil — antes era tab independiente) */}
      <section>
        <h3 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(240,240,245,0.5)]">
          Gestión
        </h3>
        <nav className="glass-card divide-y divide-[rgba(255,255,255,0.06)]">
          <Link
            href="/pagos"
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-[rgba(255,255,255,0.04)] transition"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(59,139,234,0.15)]">
              <CreditCard className="h-4 w-4 text-[#5da0ef]" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-[#f0f0f5]">Pagos</div>
              <div className="text-[11px] text-[rgba(240,240,245,0.5)]">Pendientes y historial</div>
            </div>
            <ChevronRight className="h-4 w-4 text-[rgba(240,240,245,0.4)]" />
          </Link>
        </nav>
      </section>

      {/* Información legal */}
      <section>
        <h3 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(240,240,245,0.5)]">
          Información legal
        </h3>
        <nav className="glass-card divide-y divide-[rgba(255,255,255,0.06)]">
          <a href="/privacidad" className="flex items-center gap-3 px-4 py-3.5 hover:bg-[rgba(255,255,255,0.04)] transition">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(255,255,255,0.04)]">
              <Shield className="h-4 w-4 text-[rgba(240,240,245,0.6)]" strokeWidth={1.8} />
            </div>
            <div className="flex-1 text-[14px] text-[#f0f0f5]">Privacidad y cookies</div>
            <ChevronRight className="h-4 w-4 text-[rgba(240,240,245,0.4)]" />
          </a>
          <a href="/terminos" className="flex items-center gap-3 px-4 py-3.5 hover:bg-[rgba(255,255,255,0.04)] transition">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(255,255,255,0.04)]">
              <FileText className="h-4 w-4 text-[rgba(240,240,245,0.6)]" strokeWidth={1.8} />
            </div>
            <div className="flex-1 text-[14px] text-[#f0f0f5]">Términos y aviso legal</div>
            <ChevronRight className="h-4 w-4 text-[rgba(240,240,245,0.4)]" />
          </a>
        </nav>
      </section>

      <form action={signOutAction}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.04)] px-4 py-3.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#f87171] transition hover:bg-[rgba(248,113,113,0.1)]"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.8} />
          Cerrar sesión
        </button>
      </form>
    </div>
  )
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(255,255,255,0.04)]">
        <Icon className="h-4 w-4 text-[rgba(240,240,245,0.6)]" strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[rgba(240,240,245,0.4)]">
          {label}
        </div>
        <div className="mt-0.5 truncate text-[14px] text-[#f0f0f5]">{value}</div>
      </div>
    </div>
  )
}

/**
 * Date-only field — usa UTC para el día (no se necesita TZ Madrid porque
 * birth_date / join_date son DATE puros sin timezone).
 */
function formatJoinDate(dateStr: string): string {
  // dateStr formato YYYY-MM-DD. Anclar a mediodia UTC para evitar drift TZ
  const date = new Date(dateStr + 'T12:00:00Z')
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}
