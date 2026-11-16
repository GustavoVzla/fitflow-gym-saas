'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { X, Plus, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import {
  createAppointmentAction,
  getInstructorAvailabilityAction,
  type AppointmentType,
  type AvailabilitySlot,
} from './actions'

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
  focusedDate: Date
  instructors: Instructor[]
  rooms: Room[]
  members: Member[]
  onClose: () => void
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

const APPOINTMENT_TYPE_OPTIONS: { value: AppointmentType; label: string }[] = [
  { value: 'personal_training', label: 'Entrenamiento personal' },
  { value: 'consultation', label: 'Consulta' },
  { value: 'assessment', label: 'Evaluación' },
  { value: 'nutrition', label: 'Nutrición' },
  { value: 'other', label: 'Otro' },
]

const TIMELINE_START_HOUR = 7
const TIMELINE_END_HOUR = 22
const TIMELINE_TOTAL_MIN = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60

function toLocalISO(dateStr: string, timeStr: string): string {
  const [hh, mm] = timeStr.split(':').map(Number)
  const d = new Date(dateStr + 'T00:00:00')
  d.setHours(hh, mm, 0, 0)
  return d.toISOString()
}

function buildDayRangeISO(dateStr: string): { from: string; to: string } {
  const d = new Date(dateStr + 'T00:00:00')
  d.setHours(0, 0, 0, 0)
  const from = new Date(d)
  const to = new Date(d)
  to.setDate(to.getDate() + 1)
  return { from: from.toISOString(), to: to.toISOString() }
}

export default function NuevaCitaModalSplit(props: Props) {
  const { gymId, focusedDate, instructors, rooms, members, onClose, onSuccess, onError } = props
  const [pending, startTransition] = useTransition()

  const [memberId, setMemberId] = useState('')
  const [memberQuery, setMemberQuery] = useState('')
  const [instructorId, setInstructorId] = useState(instructors[0]?.id ?? '')
  const [roomId, setRoomId] = useState('')
  const [appointmentType, setAppointmentType] = useState<AppointmentType>('personal_training')
  const [dateStr, setDateStr] = useState(focusedDate.toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('10:00')
  const [duration, setDuration] = useState<number>(60)
  const [notes, setNotes] = useState('')

  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [loadingAvailability, setLoadingAvailability] = useState(false)

  // Load disponibilidad al cambiar instructor o fecha
  useEffect(() => {
    if (!instructorId || !dateStr) return
    const { from, to } = buildDayRangeISO(dateStr)
    setLoadingAvailability(true)
    getInstructorAvailabilityAction(instructorId, gymId, from, to)
      .then((slots) => setAvailability(slots))
      .catch(() => setAvailability([]))
      .finally(() => setLoadingAvailability(false))
  }, [instructorId, dateStr, gymId])

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    if (!q) return members.slice(0, 50)
    return members.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 50)
  }, [memberQuery, members])

  const selectedMember = members.find((m) => m.id === memberId) ?? null
  const selectedInstructor = instructors.find((i) => i.id === instructorId) ?? null

  // Calcular si el slot propuesto se solapa con la disponibilidad
  const proposedStartISO = toLocalISO(dateStr, startTime)
  const proposedEndISO = new Date(new Date(proposedStartISO).getTime() + duration * 60_000).toISOString()
  const overlapsExisting = useMemo(() => {
    const ps = new Date(proposedStartISO).getTime()
    const pe = new Date(proposedEndISO).getTime()
    return availability.some((slot) => {
      const s = new Date(slot.startsAt).getTime()
      const e = new Date(slot.endsAt).getTime()
      return ps < e && pe > s
    })
  }, [availability, proposedStartISO, proposedEndISO])

  const handleSubmit = () => {
    if (!memberId) return onError('Selecciona un socio')
    if (!instructorId) return onError('Selecciona un instructor')
    if (overlapsExisting) return onError('Ese horario ya está ocupado para el instructor seleccionado')

    startTransition(async () => {
      const res = await createAppointmentAction({
        memberId,
        instructorId,
        roomId: roomId || null,
        startsAt: proposedStartISO,
        endsAt: proposedEndISO,
        appointmentType,
        notes: notes.trim() || null,
      })
      if (res.ok) onSuccess('Cita creada correctamente')
      else onError(res.error)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-xl bg-white shadow-xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Nueva cita</h2>
            <p className="text-[11px] text-slate-500">
              Selecciona instructor y fecha para ver su disponibilidad
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid flex-1 overflow-y-auto md:grid-cols-2">
          {/* Columna izquierda: form */}
          <div className="space-y-3 border-b md:border-b-0 md:border-r border-slate-200 px-5 py-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Socio *</label>
              <input
                type="text"
                value={selectedMember ? selectedMember.name : memberQuery}
                onChange={(e) => {
                  setMemberQuery(e.target.value)
                  setMemberId('')
                }}
                placeholder="Buscar socio por nombre..."
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
              />
              {!selectedMember && memberQuery.length > 0 && (
                <div className="mt-1 max-h-36 overflow-y-auto rounded-md border border-slate-200 bg-white text-sm shadow-sm">
                  {filteredMembers.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-400">Sin resultados</div>
                  ) : (
                    filteredMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setMemberId(m.id)
                          setMemberQuery('')
                        }}
                        className="block w-full px-3 py-1.5 text-left hover:bg-indigo-50"
                      >
                        {m.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Instructor *</label>
                <select
                  value={instructorId}
                  onChange={(e) => setInstructorId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
                >
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Tipo</label>
                <select
                  value={appointmentType}
                  onChange={(e) => setAppointmentType(e.target.value as AppointmentType)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
                >
                  {APPOINTMENT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {rooms.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-slate-700">Sala</label>
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
                >
                  <option value="">Sin sala asignada</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Fecha *</label>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Hora *</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Duración</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
                >
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min</option>
                  <option value={120}>120 min</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm resize-none"
                placeholder="Objetivos, recordatorios, preferencias..."
              />
            </div>

            {overlapsExisting && !loadingAvailability && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  Ese horario ya está ocupado para {selectedInstructor?.name ?? 'este instructor'}. Revisa el panel de
                  disponibilidad.
                </span>
              </div>
            )}

            {!overlapsExisting && !loadingAvailability && instructorId && (
              <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Horario disponible para {selectedInstructor?.name ?? 'este instructor'}.</span>
              </div>
            )}
          </div>

          {/* Columna derecha: disponibilidad instructor */}
          <div className="px-5 py-4 bg-slate-50/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Disponibilidad ·{' '}
                <span className="text-slate-500 font-normal">
                  {new Date(dateStr + 'T00:00:00').toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
              </h3>
              {selectedInstructor && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span
                    className="inline-block h-3 w-3 rounded-full ring-2 ring-white"
                    style={{ backgroundColor: selectedInstructor.color }}
                  />
                  {selectedInstructor.name}
                </div>
              )}
            </div>

            {!instructorId ? (
              <div className="flex h-48 items-center justify-center text-center text-xs text-slate-400">
                Selecciona un instructor para ver su disponibilidad
              </div>
            ) : loadingAvailability ? (
              <div className="flex h-48 items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando disponibilidad...
              </div>
            ) : (
              <AvailabilityTimeline
                availability={availability}
                dateStr={dateStr}
                proposedStartISO={proposedStartISO}
                proposedEndISO={proposedEndISO}
                instructorColor={selectedInstructor?.color ?? '#3b8bea'}
              />
            )}

            {availability.length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">
                  Ocupado ({availability.length})
                </div>
                {availability.map((slot) => {
                  const s = new Date(slot.startsAt).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  const e = new Date(slot.endsAt).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  const badge =
                    slot.source === 'appointment'
                      ? 'bg-indigo-100 text-indigo-700'
                      : slot.source === 'class'
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-amber-100 text-amber-700'
                  const label =
                    slot.source === 'appointment'
                      ? 'Cita'
                      : slot.source === 'class'
                        ? 'Clase'
                        : 'Bloqueo'
                  return (
                    <div
                      key={slot.refId}
                      className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1 text-[11px]"
                    >
                      <span className={`rounded px-1.5 py-0.5 font-semibold uppercase text-[9px] ${badge}`}>
                        {label}
                      </span>
                      <span className="font-mono text-slate-600">
                        {s}–{e}
                      </span>
                      <span className="truncate text-slate-700">{slot.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            onClick={onClose}
            disabled={pending}
            className="rounded-md border border-slate-200 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={pending || !memberId || !instructorId || overlapsExisting}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Crear cita
          </button>
        </div>
      </div>
    </div>
  )
}

function AvailabilityTimeline(props: {
  availability: AvailabilitySlot[]
  dateStr: string
  proposedStartISO: string
  proposedEndISO: string
  instructorColor: string
}) {
  const { availability, dateStr, proposedStartISO, proposedEndISO } = props

  const dayStart = new Date(dateStr + 'T00:00:00')
  dayStart.setHours(TIMELINE_START_HOUR, 0, 0, 0)
  const startMs = dayStart.getTime()

  const toPercent = (iso: string) => {
    const t = new Date(iso).getTime()
    const min = (t - startMs) / 60_000
    const pct = (min / TIMELINE_TOTAL_MIN) * 100
    return Math.max(0, Math.min(100, pct))
  }

  const hourMarks = Array.from(
    { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 },
    (_, i) => TIMELINE_START_HOUR + i
  )

  const proposedStartPct = toPercent(proposedStartISO)
  const proposedEndPct = toPercent(proposedEndISO)

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="relative h-48">
        {/* Hour marks */}
        <div className="absolute inset-0 flex flex-col justify-between">
          {hourMarks.map((h) => (
            <div key={h} className="flex items-center gap-1 text-[9px] text-slate-400">
              <span className="w-8 text-right font-mono">{String(h).padStart(2, '0')}:00</span>
              <div className="flex-1 border-t border-dashed border-slate-200" />
            </div>
          ))}
        </div>

        {/* Proposed slot (vertical layout: top=early, bottom=late) */}
        <div
          className="absolute left-10 right-2 rounded bg-indigo-500/25 ring-2 ring-indigo-500 pointer-events-none"
          style={{
            top: `${proposedStartPct}%`,
            height: `${Math.max(1, proposedEndPct - proposedStartPct)}%`,
          }}
        >
          <div className="px-1 py-0.5 text-[9px] font-semibold text-indigo-800">Nueva cita</div>
        </div>

        {/* Occupied slots */}
        {availability.map((slot) => {
          const sp = toPercent(slot.startsAt)
          const ep = toPercent(slot.endsAt)
          const bg =
            slot.source === 'appointment'
              ? 'bg-indigo-200/70 ring-indigo-300'
              : slot.source === 'class'
                ? 'bg-sky-200/70 ring-sky-300'
                : 'bg-amber-200/70 ring-amber-300'
          return (
            <div
              key={slot.refId}
              className={`absolute left-10 right-2 rounded ring-1 ${bg} overflow-hidden`}
              style={{
                top: `${sp}%`,
                height: `${Math.max(1, ep - sp)}%`,
              }}
              title={`${slot.label} (${new Date(slot.startsAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}–${new Date(slot.endsAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })})`}
            >
              <div className="px-1 py-0.5 text-[9px] font-semibold text-slate-800 truncate">
                {slot.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
