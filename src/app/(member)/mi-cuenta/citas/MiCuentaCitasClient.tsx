'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, MapPin, User, Ban, Loader2, CheckCircle2, UserX } from 'lucide-react'
import { cancelAppointmentByMemberAction } from '@/app/(dashboard)/citas/actions'

interface ApptMember {
  id: string
  startsAt: string
  endsAt: string
  status: string
  appointmentType: string
  title: string | null
  notes: string | null
  instructorName: string | null
  instructorColor: string | null
  roomName: string | null
  cancellationReason?: string | null
}

interface Props {
  memberName: string
  cancelHours: number
  upcoming: ApptMember[]
  past: ApptMember[]
}

export default function MiCuentaCitasClient({ memberName, cancelHours, upcoming, past }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ message: string; kind: 'ok' | 'err' } | null>(null)

  const showToast = (message: string, kind: 'ok' | 'err') => {
    setToast({ message, kind })
    setTimeout(() => setToast(null), 4000)
  }

  const onCancel = (id: string) => {
    if (!confirm(`¿Cancelar esta cita? Recuerda que debes hacerlo con al menos ${cancelHours} horas de antelación.`)) return
    startTransition(async () => {
      const res = await cancelAppointmentByMemberAction(id)
      if (res.ok) {
        showToast('Cita cancelada', 'ok')
        router.refresh()
      } else {
        showToast(res.error, 'err')
      }
    })
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mis citas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Hola {memberName}. Aquí ves tus entrenamientos personales y consultas 1:1 programadas.
        </p>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
        💡 Puedes cancelar tus citas con al menos <strong>{cancelHours} horas</strong> de antelación.
        Después de ese plazo, contacta con el gym para cancelar.
      </div>

      {/* Upcoming */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Próximas ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
            <Calendar className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">No tienes citas programadas</p>
            <p className="mt-1 text-xs text-slate-400">
              Cuando el gym te programe una cita la verás aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((appt) => (
              <ApptCard key={appt.id} appt={appt} cancelHours={cancelHours} onCancel={() => onCancel(appt.id)} pending={pending} />
            ))}
          </div>
        )}
      </section>

      {/* Past */}
      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Historial (últimas {past.length})</h2>
          <div className="space-y-2">
            {past.map((appt) => (
              <ApptCardPast key={appt.id} appt={appt} />
            ))}
          </div>
        </section>
      )}

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

function ApptCard({ appt, cancelHours, onCancel, pending }: { appt: ApptMember; cancelHours: number; onCancel: () => void; pending: boolean }) {
  const hoursUntil = (new Date(appt.startsAt).getTime() - Date.now()) / (1000 * 60 * 60)
  const canCancel = hoursUntil >= cancelHours && appt.status === 'scheduled'

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-4"
      style={{ borderLeft: `4px solid ${appt.instructorColor ?? '#3b8bea'}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Clock className="h-4 w-4 text-slate-400" />
            {new Date(appt.startsAt).toLocaleString('es-ES', {
              weekday: 'long',
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
          {appt.instructorName && (
            <div className="flex items-center gap-2 text-slate-600">
              <User className="h-4 w-4 text-slate-400" />
              {appt.instructorName}
            </div>
          )}
          {appt.roomName && (
            <div className="flex items-center gap-2 text-slate-600">
              <MapPin className="h-4 w-4 text-slate-400" />
              {appt.roomName}
            </div>
          )}
          {appt.notes && (
            <div className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-600">{appt.notes}</div>
          )}
        </div>
        <div>
          {canCancel ? (
            <button
              onClick={onCancel}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
              Cancelar
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">
              {hoursUntil < cancelHours ? `Menos de ${cancelHours}h` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function ApptCardPast({ appt }: { appt: ApptMember }) {
  const statusIcon = {
    completed: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />,
    cancelled: <Ban className="h-3.5 w-3.5 text-slate-400" />,
    no_show: <UserX className="h-3.5 w-3.5 text-amber-600" />,
    scheduled: <Clock className="h-3.5 w-3.5 text-slate-400" />,
  }[appt.status] ?? <Clock className="h-3.5 w-3.5 text-slate-400" />

  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-100 bg-white px-3 py-2 text-xs">
      {statusIcon}
      <div className="flex-1">
        <div className="font-medium text-slate-700">
          {new Date(appt.startsAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          {appt.instructorName && ` · ${appt.instructorName}`}
        </div>
      </div>
      <span className="text-slate-400">{appt.status}</span>
    </div>
  )
}
