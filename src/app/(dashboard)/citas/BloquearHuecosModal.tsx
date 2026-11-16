'use client'

import { useState, useTransition } from 'react'
import { X, Ban, Loader2 } from 'lucide-react'
import {
  createInstructorBlockAction,
  type InstructorBlockReason,
} from './actions'

interface Instructor {
  id: string
  name: string
  color: string
}

interface Props {
  instructors: Instructor[]
  defaultDate: Date
  onClose: () => void
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

const REASON_OPTIONS: { value: InstructorBlockReason; label: string; color: string }[] = [
  { value: 'vacation', label: 'Vacaciones', color: 'bg-sky-100 text-sky-800' },
  { value: 'sick', label: 'Enfermedad', color: 'bg-rose-100 text-rose-800' },
  { value: 'personal', label: 'Tiempo personal', color: 'bg-amber-100 text-amber-800' },
  { value: 'other', label: 'Otro', color: 'bg-slate-100 text-slate-800' },
]

function toLocalISO(dateStr: string, timeStr: string): string {
  const [hh, mm] = timeStr.split(':').map(Number)
  const d = new Date(dateStr + 'T00:00:00')
  d.setHours(hh, mm, 0, 0)
  return d.toISOString()
}

export default function BloquearHuecosModal(props: Props) {
  const { instructors, defaultDate, onClose, onSuccess, onError } = props
  const [pending, startTransition] = useTransition()

  const defaultStr = defaultDate.toISOString().slice(0, 10)
  const [instructorId, setInstructorId] = useState(instructors[0]?.id ?? '')
  const [fromDate, setFromDate] = useState(defaultStr)
  const [fromTime, setFromTime] = useState('00:00')
  const [toDate, setToDate] = useState(defaultStr)
  const [toTime, setToTime] = useState('23:59')
  const [reason, setReason] = useState<InstructorBlockReason>('vacation')
  const [description, setDescription] = useState('')
  const [fullDay, setFullDay] = useState(true)
  const [recurring, setRecurring] = useState(false)

  const handleSubmit = () => {
    if (!instructorId) return onError('Selecciona un instructor')

    const effectiveFromTime = fullDay ? '00:00' : fromTime
    const effectiveToTime = fullDay ? '23:59' : toTime

    const startsISO = toLocalISO(fromDate, effectiveFromTime)
    const endsISO = toLocalISO(toDate, effectiveToTime)

    if (new Date(endsISO).getTime() <= new Date(startsISO).getTime()) {
      return onError('La fecha/hora "Hasta" debe ser posterior a "Desde"')
    }

    // Recurrencia básica: si recurring y toDate > fromDate, usamos rrule FREQ=WEEKLY
    // como placeholder. La expansión real queda para sprint Q2.
    const recurrenceRule = recurring ? 'FREQ=WEEKLY;COUNT=4' : null

    startTransition(async () => {
      const res = await createInstructorBlockAction({
        instructorId,
        startsAt: startsISO,
        endsAt: endsISO,
        reason,
        description: description.trim() || null,
        recurrenceRule,
      })
      if (res.ok) onSuccess('Bloqueo creado correctamente')
      else onError(res.error)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">Bloquear huecos</h2>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-xs text-slate-500">
            Marca al instructor como NO disponible en un rango. Se respeta en el panel de disponibilidad y
            bloquea la creación de citas solapadas.
          </p>

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
            <label className="text-xs font-semibold text-slate-700">Motivo</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {REASON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setReason(opt.value)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                    reason === opt.value
                      ? `${opt.color} border-current ring-2 ring-offset-1 ring-indigo-300`
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={fullDay}
              onChange={(e) => setFullDay(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            <span>Día(s) completo(s)</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Desde</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
              />
              {!fullDay && (
                <input
                  type="time"
                  value={fromTime}
                  onChange={(e) => setFromTime(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
                />
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Hasta</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
              />
              {!fullDay && (
                <input
                  type="time"
                  value={toTime}
                  onChange={(e) => setToTime(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
                />
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Descripción (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm resize-none"
              placeholder="Ej: viaje familiar, congreso, operación..."
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              className="h-3.5 w-3.5 mt-0.5"
            />
            <span className="flex-1">
              Repetir semanal durante 4 semanas
              <span className="block text-[10px] text-slate-400">
                Expansión completa de recurrencia prevista en Q2
              </span>
            </span>
          </label>
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
            disabled={pending || !instructorId}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
            Bloquear
          </button>
        </div>
      </div>
    </div>
  )
}
