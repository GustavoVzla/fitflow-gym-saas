'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  User,
  CreditCard,
  CalendarDays,
  Receipt,
  ClipboardCheck,
  Users,
  FileText,
  AlertOctagon,
  Printer,
  Heart,
} from 'lucide-react'
import { unblockMemberMorososAction } from './actions'
import PerfilTab from './tabs/PerfilTab'
import TarifaTab from './tabs/TarifaTab'
import ReservasTab from './tabs/ReservasTab'
import PagosTab from './tabs/PagosTab'
import AsistenciasTab from './tabs/AsistenciasTab'
import PlaceholderTab from './tabs/PlaceholderTab'
import DocumentosTab from './tabs/DocumentosTab'
import DatosMedicosTab from './tabs/DatosMedicosTab'
import SinAccesoTab from './tabs/SinAccesoTab'
import type { AttendanceDay, MemberHealthData } from './data'
import type {
  AttendanceStats,
  BookingHistoryRow,
  ClassOption,
  ClauseTemplateOption,
  InstructorOption,
  MemberClauseRow,
  MemberDetail,
  MemberTariffHistoryRow,
  PaymentHistoryRow,
  RecurringBookingRow,
  TariffOption,
} from './types'

type TabKey =
  | 'perfil'
  | 'tarifa'
  | 'reservas'
  | 'pagos'
  | 'asistencias'
  | 'salud'
  | 'familia'
  | 'documentos'

const TABS: { key: TabKey; label: string; Icon: typeof User }[] = [
  { key: 'perfil', label: 'Perfil', Icon: User },
  { key: 'tarifa', label: 'Tarifa', Icon: CreditCard },
  { key: 'reservas', label: 'Reservas', Icon: CalendarDays },
  { key: 'pagos', label: 'Pagos', Icon: Receipt },
  { key: 'asistencias', label: 'Asistencias', Icon: ClipboardCheck },
  { key: 'salud', label: 'Datos médicos', Icon: Heart },
  { key: 'familia', label: 'Familia', Icon: Users },
  { key: 'documentos', label: 'Documentos', Icon: FileText },
]

interface Props {
  member: MemberDetail
  tariffHistory: MemberTariffHistoryRow[]
  bookings: BookingHistoryRow[]
  payments: PaymentHistoryRow[]
  recurring: RecurringBookingRow[]
  attendance: AttendanceStats
  attendanceDaily: AttendanceDay[]
  classes: ClassOption[]
  instructors: InstructorOption[]
  tariffs: TariffOption[]
  clauses: MemberClauseRow[]
  clauseTemplates: ClauseTemplateOption[]
  healthData: MemberHealthData | null
  /** rol del usuario actual en este gym ('owner' | 'admin' | 'trainer' | 'staff' | 'super_admin') */
  currentUserRole: string
}

const STATUS_STYLES: Record<MemberDetail['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  inactive: 'bg-slate-100 text-slate-500 ring-slate-200',
  blocked: 'bg-red-50 text-red-700 ring-red-200',
}

const STATUS_LABEL: Record<MemberDetail['status'], string> = {
  active: 'Activo',
  pending: 'Pendiente',
  inactive: 'Inactivo',
  blocked: 'Bloqueado',
}

function getInitials(first: string, last: string) {
  return ((first?.[0] ?? '') + (last?.[0] ?? '')).toUpperCase() || '?'
}

export default function MemberDetailClient({
  member,
  tariffHistory,
  bookings,
  payments,
  recurring,
  attendance,
  attendanceDaily,
  classes,
  instructors,
  tariffs,
  clauses,
  clauseTemplates,
  healthData,
  currentUserRole,
}: Props) {
  const canSeeHealthData =
    currentUserRole === 'owner' || currentUserRole === 'admin' || currentUserRole === 'super_admin'
  const [tab, setTab] = useState<TabKey>('perfil')
  const router = useRouter()
  const [isUnblocking, startUnblockTransition] = useTransition()
  const [unblockToast, setUnblockToast] = useState<string | null>(null)

  const fullName = [member.firstName, member.lastName, member.secondLastName]
    .filter(Boolean)
    .join(' ')

  const handleUnblock = () => {
    if (
      !confirm(
        'Desbloquear socio: permitirá de nuevo reservar clases. Confirma que has registrado el pago pendiente.'
      )
    ) {
      return
    }
    startUnblockTransition(async () => {
      const res = await unblockMemberMorososAction(member.id)
      if (res.error) {
        setUnblockToast(`Error: ${res.error}`)
      } else {
        setUnblockToast(res.success ?? 'Socio desbloqueado')
        router.refresh()
      }
      setTimeout(() => setUnblockToast(null), 3500)
    })
  }

  return (
    <div className="space-y-6">
      <Link
        href="/socios"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a socios
      </Link>

      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-start gap-4">
          {member.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.avatarUrl}
              alt={fullName}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-[18px] font-semibold text-[#3b8bea]">
              {getInitials(member.firstName, member.lastName)}
            </div>
          )}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[20px] font-bold text-slate-900">{fullName}</h1>
              <span
                className={
                  'inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium ring-1 ' +
                  STATUS_STYLES[member.status]
                }
              >
                {STATUS_LABEL[member.status]}
              </span>
              {member.authUserId && (
                <span className="inline-flex h-6 items-center rounded-full bg-indigo-50 px-2.5 text-[12px] font-medium text-indigo-700 ring-1 ring-indigo-200">
                  App activa
                </span>
              )}
              {member.blockedForMorososAt && (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-red-50 px-2.5 text-[12px] font-medium text-red-700 ring-1 ring-red-200">
                  <AlertOctagon className="h-3 w-3" />
                  Bloqueado por morosidad
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-slate-500">
              {member.email && <span>{member.email}</span>}
              {member.phone && <span>{member.phone}</span>}
              {member.taxId && <span>DNI: {member.taxId}</span>}
              <span>Alta: {new Date(member.joinDate).toLocaleDateString('es-ES')}</span>
              {member.currentTariffName && (
                <span>Tarifa: {member.currentTariffName}</span>
              )}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <a
              href={`/api/socios/${member.id}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              title="Abrir versión imprimible y guardar como PDF"
            >
              <Printer className="h-4 w-4" />
              Exportar PDF
            </a>
          </div>
        </div>
      </header>

      {member.blockedForMorososAt && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertOctagon className="h-4 w-4 text-red-600" />
            </div>
            <div className="flex-1 text-sm">
              <p className="font-semibold text-red-900">Socio bloqueado por morosidad</p>
              <p className="mt-0.5 text-xs text-red-800">
                Bloqueado automáticamente el{' '}
                {new Date(member.blockedForMorososAt).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
                . No puede reservar clases hasta desbloquear. Desbloquea tras registrar el pago
                pendiente en Pagos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleUnblock}
            disabled={isUnblocking}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
          >
            {isUnblocking ? 'Desbloqueando...' : 'Desbloquear socio'}
          </button>
        </div>
      )}

      {unblockToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {unblockToast}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-1 border-b border-slate-100 px-3 pt-3">
          {TABS.map((t) => {
            const active = t.key === tab
            const Icon = t.Icon
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={
                  'inline-flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 pb-2 pt-1 text-[13px] font-medium transition-colors ' +
                  (active
                    ? 'border-[#3b8bea] text-[#3b8bea]'
                    : 'border-transparent text-slate-500 hover:text-slate-900')
                }
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            )
          })}
        </div>

        <div className="p-5">
          {tab === 'perfil' && <PerfilTab member={member} />}
          {tab === 'tarifa' && (
            <TarifaTab member={member} history={tariffHistory} tariffs={tariffs} />
          )}
          {tab === 'reservas' && (
            <ReservasTab
              memberId={member.id}
              recurring={recurring}
              bookings={bookings}
              classes={classes}
              instructors={instructors}
            />
          )}
          {tab === 'pagos' && (
            <PagosTab memberId={member.id} payments={payments} />
          )}
          {tab === 'asistencias' && (
            <AsistenciasTab stats={attendance} daily={attendanceDaily} />
          )}
          {tab === 'salud' && (
            canSeeHealthData && healthData ? (
              <DatosMedicosTab memberId={member.id} initialData={healthData} />
            ) : (
              <SinAccesoTab reason="Los datos médicos son categoría especial RGPD Art. 9. Solo el owner o admin del gym pueden verlos. Cualquier acceso queda registrado." />
            )
          )}
          {tab === 'familia' && (
            <PlaceholderTab
              title="Familias"
              message="La gestión de familias multi-pagador llegará en el sprint del módulo CRM (sesión Panel-E). Aquí podrás vincular padres e hijos para cobros consolidados."
            />
          )}
          {tab === 'documentos' && (
            <DocumentosTab
              memberId={member.id}
              memberName={fullName}
              clauses={clauses}
              templates={clauseTemplates}
            />
          )}
        </div>
      </div>
    </div>
  )
}
