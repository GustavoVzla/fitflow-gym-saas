'use client'

import { useState, useTransition } from 'react'
import { Plus, X, Power, PowerOff, Trash2, XCircle } from 'lucide-react'
import {
  cancelBookingFromMemberAction,
  createRecurringBookingAction,
  deleteRecurringBookingAction,
  toggleRecurringBookingAction,
  type RecurringBookingInput,
} from '../actions'
import type {
  BookingHistoryRow,
  ClassOption,
  InstructorOption,
  RecurringBookingRow,
} from '../types'

const DAYS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function fmtDateTime(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const FIELD =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 shadow-sm transition-colors hover:border-slate-300 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none'
const LABEL = 'mb-1 block text-[12px] font-medium text-slate-600'

export default function ReservasTab({
  memberId,
  recurring,
  bookings,
  classes,
  instructors,
}: {
  memberId: string
  recurring: RecurringBookingRow[]
  bookings: BookingHistoryRow[]
  classes: ClassOption[]
  instructors: InstructorOption[]
}) {
  const [showModal, setShowModal] = useState(false)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [type, setType] = useState<'class' | 'appointment'>('class')

  function handleCreate(formData: FormData) {
    setMsg(null)
    const input: RecurringBookingInput = {
      type,
      classId:
        type === 'class' ? String(formData.get('class_id') ?? '') || null : null,
      instructorId:
        type === 'appointment'
          ? String(formData.get('instructor_id') ?? '') || null
          : null,
      room:
        type === 'appointment' ? String(formData.get('room') ?? '') || null : null,
      durationMinutes:
        type === 'appointment'
          ? Number(formData.get('duration_minutes') ?? 60) || 60
          : null,
      dayOfWeek: Number(formData.get('day_of_week') ?? 1),
      startTime: String(formData.get('start_time') ?? ''),
      startsOn: String(formData.get('starts_on') ?? '') || null,
      endsOn: String(formData.get('ends_on') ?? '') || null,
      notes: String(formData.get('notes') ?? '') || null,
    }
    startTransition(async () => {
      const res = await createRecurringBookingAction(memberId, input)
      if (res.error) setMsg({ type: 'err', text: res.error })
      else {
        setMsg({ type: 'ok', text: res.success ?? 'Creada' })
        setShowModal(false)
      }
    })
  }

  function handleToggle(id: string, active: boolean) {
    startTransition(async () => {
      await toggleRecurringBookingAction(memberId, id, active)
    })
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta reserva automática?')) return
    startTransition(async () => {
      await deleteRecurringBookingAction(memberId, id)
    })
  }

  function handleCancelBooking(bookingId: string) {
    if (!confirm('¿Cancelar esta reserva? El socio quedará sin plaza.')) return
    setMsg(null)
    startTransition(async () => {
      const res = await cancelBookingFromMemberAction(memberId, bookingId)
      if (res.error) setMsg({ type: 'err', text: res.error })
      else setMsg({ type: 'ok', text: res.success ?? 'Reserva cancelada' })
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <h3 className="text-[14px] font-semibold text-slate-900">
              Reservas automáticas
            </h3>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Recurrencia semanal — el sistema pre-reserva la plaza/cita cada semana.
            </p>
          </div>
          <button
            onClick={() => {
              setMsg(null)
              setShowModal(true)
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3b8bea] px-3 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7]"
          >
            <Plus className="h-4 w-4" />
            Configurar reserva automática
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 text-left text-[12px] font-medium text-slate-500">
              <tr>
                <th className="px-5 py-2.5">Tipo</th>
                <th className="px-5 py-2.5">Clase / Instructor</th>
                <th className="px-5 py-2.5">Día</th>
                <th className="px-5 py-2.5">Hora</th>
                <th className="px-5 py-2.5">Vigencia</th>
                <th className="px-5 py-2.5">Estado</th>
                <th className="px-5 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {recurring.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 text-slate-800">
                  <td className="px-5 py-2.5">
                    {r.type === 'class' ? 'Clase' : 'Cita 1:1'}
                  </td>
                  <td className="px-5 py-2.5">
                    {r.type === 'class'
                      ? r.className ?? '—'
                      : `${r.instructorName ?? 'Sin instructor'}${r.room ? ' · ' + r.room : ''}${r.durationMinutes ? ' · ' + r.durationMinutes + ' min' : ''}`}
                  </td>
                  <td className="px-5 py-2.5">{DAYS[r.dayOfWeek]}</td>
                  <td className="px-5 py-2.5">{r.startTime?.slice(0, 5)}</td>
                  <td className="px-5 py-2.5 text-[12px] text-slate-500">
                    {fmtDate(r.startsOn)} — {fmtDate(r.endsOn)}
                  </td>
                  <td className="px-5 py-2.5">
                    <span
                      className={
                        r.active
                          ? 'inline-flex h-5 items-center rounded-full bg-emerald-50 px-2 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200'
                          : 'inline-flex h-5 items-center rounded-full bg-slate-100 px-2 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200'
                      }
                    >
                      {r.active ? 'Activa' : 'Pausada'}
                    </span>
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        title={r.active ? 'Pausar' : 'Activar'}
                        onClick={() => handleToggle(r.id, !r.active)}
                        disabled={pending}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                      >
                        {r.active ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        title="Eliminar"
                        onClick={() => handleDelete(r.id)}
                        disabled={pending}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {recurring.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-8 text-center text-[13px] text-slate-400"
                  >
                    No hay reservas automáticas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {msg && (
          <div
            className={
              msg.type === 'ok'
                ? 'm-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700'
                : 'm-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700'
            }
          >
            {msg.text}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-[14px] font-semibold text-slate-900">
            Historial de reservas ({bookings.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 text-left text-[12px] font-medium text-slate-500">
              <tr>
                <th className="px-5 py-2.5">Clase</th>
                <th className="px-5 py-2.5">Fecha</th>
                <th className="px-5 py-2.5">Estado</th>
                <th className="px-5 py-2.5">Asistencia</th>
                <th className="px-5 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const cancellable =
                  b.status === 'confirmed' || b.status === 'waitlist'
                return (
                  <tr key={b.id} className="border-t border-slate-100 text-slate-800">
                    <td className="px-5 py-2.5">{b.className}</td>
                    <td className="px-5 py-2.5">{fmtDateTime(b.startAt)}</td>
                    <td className="px-5 py-2.5">{b.status}</td>
                    <td className="px-5 py-2.5">
                      {b.attended ? (
                        <span className="inline-flex h-5 items-center rounded-full bg-emerald-50 px-2 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                          Asistió
                        </span>
                      ) : (
                        <span className="text-[12px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {cancellable ? (
                        <button
                          title="Cancelar reserva"
                          onClick={() => handleCancelBooking(b.id)}
                          disabled={pending}
                          className="inline-flex h-7 items-center gap-1 rounded-md text-[11px] font-medium text-red-600 transition-colors hover:bg-red-50 px-2 disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Cancelar
                        </button>
                      ) : (
                        <span className="text-[12px] text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {bookings.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-[13px] text-slate-400"
                  >
                    Sin reservas todavía
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="relative mx-4 w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                Configurar reserva automática
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 inline-flex rounded-lg bg-slate-100 p-1">
              <button
                onClick={() => setType('class')}
                className={
                  type === 'class'
                    ? 'h-8 rounded-md bg-white px-3 text-[13px] font-medium text-slate-900 shadow-sm'
                    : 'h-8 rounded-md px-3 text-[13px] font-medium text-slate-600'
                }
              >
                Clase grupal
              </button>
              <button
                onClick={() => setType('appointment')}
                className={
                  type === 'appointment'
                    ? 'h-8 rounded-md bg-white px-3 text-[13px] font-medium text-slate-900 shadow-sm'
                    : 'h-8 rounded-md px-3 text-[13px] font-medium text-slate-600'
                }
              >
                Cita 1:1
              </button>
            </div>

            <form action={handleCreate} className="space-y-4">
              {type === 'class' ? (
                <div>
                  <label className={LABEL}>Clase recurrente *</label>
                  <select
                    name="class_id"
                    required
                    className={FIELD + ' w-full'}
                    defaultValue=""
                  >
                    <option value="">Selecciona una clase</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className={LABEL}>Instructor</label>
                      <select
                        name="instructor_id"
                        className={FIELD + ' w-full'}
                        defaultValue=""
                      >
                        <option value="">Sin asignar</option>
                        {instructors.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL}>Sala</label>
                      <input name="room" className={FIELD + ' w-full'} />
                    </div>
                  </div>
                  <div>
                    <label className={LABEL}>Duración (minutos)</label>
                    <input
                      type="number"
                      name="duration_minutes"
                      defaultValue={60}
                      min={15}
                      max={240}
                      className={FIELD + ' w-full md:w-1/3'}
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={LABEL}>Día de la semana *</label>
                  <select
                    name="day_of_week"
                    className={FIELD + ' w-full'}
                    defaultValue={1}
                  >
                    {DAYS.map((d, i) => (
                      <option key={i} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Hora inicio *</label>
                  <input
                    type="time"
                    name="start_time"
                    required
                    className={FIELD + ' w-full'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={LABEL}>Vigente desde</label>
                  <input
                    type="date"
                    name="starts_on"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className={FIELD + ' w-full'}
                  />
                </div>
                <div>
                  <label className={LABEL}>Hasta (opcional)</label>
                  <input type="date" name="ends_on" className={FIELD + ' w-full'} />
                </div>
              </div>

              <div>
                <label className={LABEL}>Notas (opcional)</label>
                <input name="notes" className={FIELD + ' w-full'} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="h-9 rounded-lg bg-[#3b8bea] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7] disabled:opacity-60"
                >
                  {pending ? 'Guardando…' : 'Crear recurrencia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
