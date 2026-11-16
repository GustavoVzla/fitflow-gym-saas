'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarDays,
  Plus,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Ban,
  UserX,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  MapPin,
} from 'lucide-react'
import {
  cancelAppointmentAction,
  completeAppointmentAction,
  markNoShowAppointmentAction,
  type Appointment,
} from './actions'
import NuevaCitaModalSplit from './NuevaCitaModalSplit'
import BloquearHuecosModal from './BloquearHuecosModal'

interface Instructor {
  id: string
  name: string
  color: string
}

interface Room {
  id: string
  name: string
}

interface Member {
  id: string
  name: string
}

interface Props {
  gymId: string
  focusedDateISO: string
  weekStartISO: string
  weekEndISO: string
  initialAppointments: Appointment[]
  instructors: Instructor[]
  rooms: Room[]
  members: Member[]
}

const WEEK_DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

export default function CitasClient(props: Props) {
  const router = useRouter()
  const { gymId, focusedDateISO, weekStartISO, weekEndISO, initialAppointments, instructors, rooms, members } = props
  const focusedDate = new Date(focusedDateISO)
  const weekStart = new Date(weekStartISO)
  const [appointments] = useState<Appointment[]>(initialAppointments)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [toast, setToast] = useState<{ message: string; kind: 'ok' | 'err' } | null>(null)
  const [pending, startTransition] = useTransition()

  // Grouped by day + instructor
  const byDayInstructor = useMemo(() => {
    const map = new Map<string, Map<string, Appointment[]>>()
    for (const appt of appointments) {
      const dayKey = appt.startsAt.slice(0, 10)
      if (!map.has(dayKey)) map.set(dayKey, new Map())
      const instMap = map.get(dayKey)!
      const instKey = appt.instructorId
      if (!instMap.has(instKey)) instMap.set(instKey, [])
      instMap.get(instKey)!.push(appt)
    }
    return map
  }, [appointments])

  const navigateWeek = (offsetDays: number) => {
    const newDate = new Date(focusedDate)
    newDate.setDate(focusedDate.getDate() + offsetDays)
    const dateStr = newDate.toISOString().slice(0, 10)
    router.push(`/citas?fecha=${dateStr}`)
  }

  const showToast = (message: string, kind: 'ok' | 'err') => {
    setToast({ message, kind })
    setTimeout(() => setToast(null), 4000)
  }

  const refresh = () => router.refresh()

  // Week days computed
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const formatDateLabel = (d: Date) =>
    d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  // Empty state helpers
  const totalScheduled = appointments.filter((a) => a.status === 'scheduled').length

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Citas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Entrenamientos personales, consultas y evaluaciones 1:1 con tus socios
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBlockModal(true)}
            disabled={instructors.length === 0}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 text-[13px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            <Ban className="h-4 w-4" />
            Bloquear huecos
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            disabled={members.length === 0 || instructors.length === 0}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-[13px] font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Nueva cita
          </button>
        </div>
      </div>

      {/* Prerequisites warnings */}
      {members.length === 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
          <div className="text-amber-900">
            <div className="font-semibold">Aún no hay socios</div>
            <div>Añade socios antes de programar citas.</div>
          </div>
        </div>
      )}
      {instructors.length === 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
          <div className="text-amber-900">
            <div className="font-semibold">No hay instructores activos</div>
            <div>Añade instructores en Clases y Tarifas antes de programar citas.</div>
          </div>
        </div>
      )}

      {/* Week navigator */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
        <button
          onClick={() => navigateWeek(-7)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Semana anterior
        </button>
        <div className="text-sm font-semibold text-slate-900">
          {formatDateLabel(days[0])} — {formatDateLabel(days[6])}
          <span className="ml-3 text-xs font-medium text-slate-500">{totalScheduled} citas programadas</span>
        </div>
        <button
          onClick={() => navigateWeek(7)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Legend instructors */}
      {instructors.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-slate-500">Instructores:</span>
          {instructors.map((i) => (
            <div key={i.id} className="flex items-center gap-1.5 text-xs text-slate-700">
              <span className="inline-block h-3 w-3 rounded-full ring-2 ring-white" style={{ backgroundColor: i.color }} />
              {i.name}
            </div>
          ))}
        </div>
      )}

      {/* Week grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {days.map((day) => {
          const dayKey = day.toISOString().slice(0, 10)
          const dayAppointments = Array.from(byDayInstructor.get(dayKey)?.values() ?? [])
            .flat()
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
          const isToday = day.toDateString() === new Date().toDateString()

          return (
            <div
              key={dayKey}
              className={`rounded-xl border bg-white p-3 min-h-[240px] ${
                isToday ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase text-slate-500">
                    {WEEK_DAYS[day.getDay()]}
                  </div>
                  <div className="text-xl font-bold text-slate-900">{day.getDate()}</div>
                </div>
                {dayAppointments.length > 0 && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                    {dayAppointments.length}
                  </span>
                )}
              </div>
              {dayAppointments.length === 0 ? (
                <p className="mt-4 text-center text-xs text-slate-400">—</p>
              ) : (
                <div className="space-y-2">
                  {dayAppointments.map((appt) => (
                    <AppointmentCard
                      key={appt.id}
                      appt={appt}
                      onClick={() => setSelectedAppt(appt)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* NuevaCitaModalSplit (con panel disponibilidad instructor) */}
      {showNewModal && (
        <NuevaCitaModalSplit
          gymId={gymId}
          focusedDate={focusedDate}
          instructors={instructors}
          rooms={rooms}
          members={members}
          onClose={() => setShowNewModal(false)}
          onSuccess={(msg) => {
            setShowNewModal(false)
            showToast(msg, 'ok')
            refresh()
          }}
          onError={(msg) => showToast(msg, 'err')}
        />
      )}

      {/* BloquearHuecosModal */}
      {showBlockModal && (
        <BloquearHuecosModal
          instructors={instructors}
          defaultDate={focusedDate}
          onClose={() => setShowBlockModal(false)}
          onSuccess={(msg) => {
            setShowBlockModal(false)
            showToast(msg, 'ok')
            refresh()
          }}
          onError={(msg) => showToast(msg, 'err')}
        />
      )}

      {/* AppointmentDetailModal */}
      {selectedAppt && (
        <AppointmentDetailModal
          appt={selectedAppt}
          onClose={() => setSelectedAppt(null)}
          onAction={(action, opts) => {
            const id = selectedAppt.id
            startTransition(async () => {
              let res
              switch (action) {
                case 'cancel':
                  res = await cancelAppointmentAction(id, opts?.reason)
                  break
                case 'complete':
                  res = await completeAppointmentAction(id, opts?.consumeSession ?? false)
                  break
                case 'no_show':
                  res = await markNoShowAppointmentAction(id)
                  break
              }
              if (res?.ok) {
                const actionLabels: Record<string, string> = {
                  cancel: 'Cita cancelada',
                  complete: 'Cita marcada completada',
                  no_show: 'Cita marcada como no-show',
                }
                showToast(actionLabels[action] ?? 'OK', 'ok')
                setSelectedAppt(null)
                refresh()
              } else {
                showToast(res?.error ?? 'Error desconocido', 'err')
              }
            })
          }}
          pending={pending}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.kind === 'ok' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// AppointmentCard
// ============================================================================

function AppointmentCard({ appt, onClick }: { appt: Appointment; onClick: () => void }) {
  const color = appt.instructorColor ?? '#3b8bea'
  const startTime = new Date(appt.startsAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const endTime = new Date(appt.endsAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  const statusBadge = {
    scheduled: null,
    completed: <span className="text-[9px] font-bold uppercase bg-emerald-100 text-emerald-700 px-1 rounded">OK</span>,
    cancelled: <span className="text-[9px] font-bold uppercase bg-slate-200 text-slate-500 px-1 rounded">CANC</span>,
    no_show: <span className="text-[9px] font-bold uppercase bg-amber-100 text-amber-700 px-1 rounded">NO-SHOW</span>,
  }[appt.status]

  const isCancelled = appt.status === 'cancelled' || appt.status === 'no_show'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-md px-2 py-1.5 ring-1 transition hover:ring-2 ${
        isCancelled
          ? 'bg-slate-50 ring-slate-200 opacity-60 line-through'
          : 'bg-white ring-slate-200 hover:ring-indigo-300'
      }`}
      style={isCancelled ? {} : { borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-mono font-semibold text-slate-700">
          {startTime}–{endTime}
        </span>
        {statusBadge}
      </div>
      <div className="mt-0.5 truncate text-xs font-semibold text-slate-900">
        {appt.memberName ?? '(socio)'}
      </div>
      <div className="truncate text-[10px] text-slate-500">
        {appt.instructorName}
        {appt.roomName && ` · ${appt.roomName}`}
      </div>
    </button>
  )
}


// ============================================================================
// AppointmentDetailModal
// ============================================================================

function AppointmentDetailModal(props: {
  appt: Appointment
  onClose: () => void
  onAction: (action: 'cancel' | 'complete' | 'no_show', opts?: { reason?: string; consumeSession?: boolean }) => void
  pending: boolean
}) {
  const { appt, onClose, onAction, pending } = props
  const [cancelReason, setCancelReason] = useState('')
  const [consumeSession, setConsumeSession] = useState(false)
  const isActionable = appt.status === 'scheduled'

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('es-ES', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-bold text-slate-900">Detalle de cita</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-slate-400" />
            <span className="font-semibold text-slate-900">{appt.memberName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="text-slate-700">{formatDateTime(appt.startsAt)} · {appt.durationMinutes} min</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: appt.instructorColor ?? '#3b8bea' }} />
            <span className="text-slate-700">{appt.instructorName}</span>
          </div>
          {appt.roomName && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span className="text-slate-700">{appt.roomName}</span>
            </div>
          )}
          {appt.notes && (
            <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">
              <div className="mb-0.5 font-semibold text-slate-500">Notas</div>
              {appt.notes}
            </div>
          )}
          {appt.status === 'cancelled' && appt.cancellationReason && (
            <div className="rounded-md bg-red-50 p-2 text-xs text-red-700 ring-1 ring-red-200">
              <div className="mb-0.5 font-semibold">Motivo cancelación</div>
              {appt.cancellationReason}
            </div>
          )}
        </div>

        {isActionable && (
          <div className="border-t border-slate-200 px-5 py-4 space-y-3">
            <button
              onClick={() => onAction('complete', { consumeSession })}
              disabled={pending}
              className="flex w-full items-center justify-between gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Marcar completada
              </span>
              <label className="flex items-center gap-1 text-[10px] font-normal" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={consumeSession}
                  onChange={(e) => setConsumeSession(e.target.checked)}
                  className="h-3 w-3"
                />
                consume sesión
              </label>
            </button>
            <button
              onClick={() => onAction('no_show')}
              disabled={pending}
              className="flex w-full items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100 disabled:opacity-50"
            >
              <UserX className="h-4 w-4" />
              Marcar no-show
            </button>
            <div className="space-y-2 rounded-md bg-slate-50 p-2 ring-1 ring-slate-200">
              <label className="text-[11px] font-semibold text-slate-600">Motivo de cancelación (opcional)</label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ej: socio enfermo"
                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
              />
              <button
                onClick={() => onAction('cancel', { reason: cancelReason || undefined })}
                disabled={pending}
                className="flex w-full items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50"
              >
                <Ban className="h-4 w-4" />
                Cancelar cita
              </button>
            </div>
          </div>
        )}

        {!isActionable && (
          <div className="border-t border-slate-200 px-5 py-4">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <CalendarDays className="h-3.5 w-3.5" />
              Esta cita está en estado <strong>{appt.status}</strong>, no se puede modificar.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
