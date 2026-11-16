'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Power, Trash2, X, Loader2, CalendarClock } from 'lucide-react'
import { upsertAgendaAction, deleteAgendaAction } from './actions'
import type { Agenda } from './agendas'
import type { InstructorRow } from './types'

interface Props {
  agendas: Agenda[]
  instructors: InstructorRow[]
}

const PRESET_COLORS = [
  '#3b8bea', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#a855f7', // purple
  '#ef4444', // red
  '#14b8a6', // teal
]

const inputClass =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none'
const labelClass = 'block text-[13px] font-medium text-slate-600 mb-1'

export default function AgendasTab({ agendas, instructors }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<Agenda | 'new' | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [pending, startTransition] = useTransition()

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleToggleActive = (agenda: Agenda) => {
    startTransition(async () => {
      const res = await upsertAgendaAction({
        id: agenda.id,
        name: agenda.name,
        description: agenda.description,
        durationMinutes: agenda.durationMinutes,
        defaultInstructorId: agenda.defaultInstructorId,
        color: agenda.color,
        active: !agenda.active,
        capacity: agenda.capacity,
        requiresPaymentUpfront: agenda.requiresPaymentUpfront,
        sortOrder: agenda.sortOrder,
      })
      if (res.success) {
        showToast(agenda.active ? 'Agenda desactivada' : 'Agenda activada')
        router.refresh()
      } else {
        showToast(res.error ?? 'Error', 'error')
      }
    })
  }

  const handleDelete = (agenda: Agenda) => {
    if (!confirm(`¿Eliminar la agenda "${agenda.name}"? Si hay citas futuras, se desactivará en lugar de eliminarse.`)) return
    startTransition(async () => {
      const res = await deleteAgendaAction(agenda.id)
      if (res.success) {
        showToast(res.success)
        router.refresh()
      } else {
        showToast(res.error ?? 'Error', 'error')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-slate-600">
            Agendas de citas 1:1. Cada agenda define duración, instructor por defecto y color. Reemplaza el concepto
            enum de &ldquo;Tipo&rdquo; hardcoded por una lista configurable por gym.
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          Nueva agenda
        </button>
      </div>

      {agendas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-10 text-center">
          <CalendarClock className="h-8 w-8 text-slate-400" />
          <p className="text-sm font-semibold text-slate-700">Aún no tienes agendas configuradas</p>
          <p className="text-xs text-slate-500">
            Crea al menos una agenda (ej: &ldquo;Entrenamiento personal 1h&rdquo;) para usar el modal de citas con
            configuración completa.
          </p>
          <button
            onClick={() => setEditing('new')}
            className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            Crear primera agenda
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Nombre</th>
                <th className="px-4 py-2.5">Duración</th>
                <th className="px-4 py-2.5">Instructor default</th>
                <th className="px-4 py-2.5">Capacidad</th>
                <th className="px-4 py-2.5">Pago anticipado</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agendas.map((a) => {
                const instName = instructors.find((i) => i.id === a.defaultInstructorId)?.name ?? '—'
                return (
                  <tr key={a.id} className={!a.active ? 'opacity-50' : undefined}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-3.5 w-3.5 rounded-full ring-2 ring-white"
                          style={{ backgroundColor: a.color }}
                        />
                        <span className="font-semibold text-slate-900">{a.name}</span>
                      </div>
                      {a.description && <p className="text-[11px] text-slate-500 mt-0.5">{a.description}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{a.durationMinutes} min</td>
                    <td className="px-4 py-2.5 text-slate-600">{instName}</td>
                    <td className="px-4 py-2.5 text-slate-600">{a.capacity}</td>
                    <td className="px-4 py-2.5 text-slate-600">{a.requiresPaymentUpfront ? 'Sí' : 'No'}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          a.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {a.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing(a)}
                          disabled={pending}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(a)}
                          disabled={pending}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          title={a.active ? 'Desactivar' : 'Activar'}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(a)}
                          disabled={pending}
                          className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <AgendaEditModal
          agenda={editing === 'new' ? null : editing}
          instructors={instructors}
          onClose={() => setEditing(null)}
          onSuccess={(msg) => {
            setEditing(null)
            showToast(msg)
            router.refresh()
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-5 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}

function AgendaEditModal(props: {
  agenda: Agenda | null
  instructors: InstructorRow[]
  onClose: () => void
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}) {
  const { agenda, instructors, onClose, onSuccess, onError } = props
  const [pending, startTransition] = useTransition()

  const [name, setName] = useState(agenda?.name ?? '')
  const [description, setDescription] = useState(agenda?.description ?? '')
  const [duration, setDuration] = useState(agenda?.durationMinutes ?? 60)
  const [instructorId, setInstructorId] = useState(agenda?.defaultInstructorId ?? '')
  const [color, setColor] = useState(agenda?.color ?? '#3b8bea')
  const [capacity, setCapacity] = useState(agenda?.capacity ?? 1)
  const [requiresPayment, setRequiresPayment] = useState(agenda?.requiresPaymentUpfront ?? false)
  const [active, setActive] = useState(agenda?.active ?? true)

  const handleSubmit = () => {
    if (!name.trim()) return onError('El nombre es obligatorio')
    startTransition(async () => {
      const res = await upsertAgendaAction({
        id: agenda?.id ?? null,
        name: name.trim(),
        description: description.trim() || null,
        durationMinutes: duration,
        defaultInstructorId: instructorId || null,
        color,
        active,
        capacity,
        requiresPaymentUpfront: requiresPayment,
        sortOrder: agenda?.sortOrder ?? 0,
      })
      if (res.success) onSuccess(res.success)
      else onError(res.error ?? 'Error')
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">{agenda ? 'Editar agenda' : 'Nueva agenda'}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className={labelClass}>Nombre *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Entrenamiento personal 1h"
              maxLength={80}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Descripción (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              className={`${inputClass} h-auto py-2 resize-none`}
              placeholder="Qué incluye esta agenda (ej: 60 min con instructor asignado, sala premium)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Duración (min) *</label>
              <input
                type="number"
                min={15}
                max={240}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Capacidad</label>
              <input
                type="number"
                min={1}
                max={20}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className={inputClass}
              />
              <p className="text-[10px] text-slate-400 mt-0.5">1 = cita 1:1</p>
            </div>
          </div>

          <div>
            <label className={labelClass}>Instructor por defecto</label>
            <select
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
              className={inputClass}
            >
              <option value="">Sin preferencia</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Color</label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full ring-2 transition ${
                    color === c ? 'ring-slate-900 scale-110' : 'ring-white hover:ring-slate-300'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-7 w-9 cursor-pointer rounded border border-slate-200"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresPayment}
                onChange={(e) => setRequiresPayment(e.target.checked)}
                className="h-4 w-4"
              />
              <span>Requiere pago anticipado (UX comercial)</span>
            </label>
            {agenda && (
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4"
                />
                <span>Agenda activa</span>
              </label>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            onClick={onClose}
            disabled={pending}
            className="rounded-md border border-slate-200 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={pending || !name.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {agenda ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  )
}
