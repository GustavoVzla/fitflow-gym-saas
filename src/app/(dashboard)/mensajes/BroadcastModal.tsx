'use client'

import { useEffect, useState, useTransition } from 'react'
import { Radio, Users, X } from 'lucide-react'
import {
  broadcastMessageAction,
  previewBroadcastTargetsAction,
  type BroadcastTargetFilters,
} from './actions'

export interface TariffOption {
  id: string
  name: string
}

const STATUS_OPTIONS: { value: 'active' | 'pending' | 'inactive' | 'blocked'; label: string }[] = [
  { value: 'active', label: 'Activos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'inactive', label: 'Inactivos' },
  { value: 'blocked', label: 'Bloqueados' },
]

export default function BroadcastModal({
  open,
  onClose,
  tariffs,
  onSent,
}: {
  open: boolean
  onClose: () => void
  tariffs: TariffOption[]
  onSent?: (sent: number) => void
}) {
  const [scope, setScope] = useState<BroadcastTargetFilters['scope']>('all')
  const [tariffIds, setTariffIds] = useState<string[]>([])
  const [statuses, setStatuses] = useState<('active' | 'pending' | 'inactive' | 'blocked')[]>([
    'active',
  ])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [count, setCount] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const filters: BroadcastTargetFilters = {
    scope,
    tariffIds: scope === 'by_tariff' ? tariffIds : undefined,
    statuses: scope === 'by_status' ? statuses : undefined,
  }

  useEffect(() => {
    if (!open) return
    let cancel = false
    previewBroadcastTargetsAction(filters).then((res) => {
      if (cancel) return
      setCount(res.error ? 0 : res.count)
    })
    return () => {
      cancel = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scope, tariffIds.join(','), statuses.join(',')])

  function reset() {
    setScope('all')
    setTariffIds([])
    setStatuses(['active'])
    setTitle('')
    setBody('')
    setMsg(null)
  }

  function handleSend() {
    setMsg(null)
    if (!title.trim()) {
      setMsg({ type: 'err', text: 'Título obligatorio' })
      return
    }
    if (!body.trim()) {
      setMsg({ type: 'err', text: 'Cuerpo obligatorio' })
      return
    }
    if (!count || count === 0) {
      setMsg({ type: 'err', text: 'Sin destinatarios. Ajusta filtros.' })
      return
    }
    if (count > 500) {
      setMsg({ type: 'err', text: `Demasiados (${count}). Límite 500.` })
      return
    }

    startTransition(async () => {
      const res = await broadcastMessageAction({ title, body, filters })
      if (!res.ok) {
        setMsg({ type: 'err', text: res.error ?? 'Error envío' })
        return
      }
      setMsg({
        type: 'ok',
        text: res.error
          ? `${res.error}. Enviados: ${res.sent}`
          : `Broadcast enviado a ${res.sent} socios`,
      })
      onSent?.(res.sent ?? 0)
      setTimeout(() => {
        reset()
        onClose()
      }, 1500)
    })
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-[var(--brand-color,#0B4B8C)]" />
            <h2 className="text-lg font-bold text-slate-900">Nuevo broadcast</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Filtros target */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-slate-600">
              Destinatarios
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['all', 'by_tariff', 'by_status', 'blocked_morosos'] as const).map((s) => (
                <label
                  key={s}
                  className={
                    'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px] ' +
                    (scope === s
                      ? 'border-[#3b8bea] bg-blue-50/40 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
                  }
                >
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === s}
                    onChange={() => setScope(s)}
                    className="h-3.5 w-3.5"
                  />
                  {s === 'all' && 'Todos los socios'}
                  {s === 'by_tariff' && 'Por tarifa'}
                  {s === 'by_status' && 'Por estado'}
                  {s === 'blocked_morosos' && 'Bloqueados por morosidad'}
                </label>
              ))}
            </div>

            {scope === 'by_tariff' && (
              <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                {tariffs.length === 0 ? (
                  <p className="text-[12px] text-slate-500">No hay tarifas activas</p>
                ) : (
                  tariffs.map((t) => (
                    <label
                      key={t.id}
                      className="flex cursor-pointer items-center gap-2 py-1 text-[13px] text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={tariffIds.includes(t.id)}
                        onChange={(e) =>
                          setTariffIds((prev) =>
                            e.target.checked
                              ? [...prev, t.id]
                              : prev.filter((id) => id !== t.id)
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300 text-[#3b8bea]"
                      />
                      {t.name}
                    </label>
                  ))
                )}
              </div>
            )}

            {scope === 'by_status' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <label
                    key={s.value}
                    className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={statuses.includes(s.value)}
                      onChange={(e) =>
                        setStatuses((prev) =>
                          e.target.checked
                            ? [...prev, s.value]
                            : prev.filter((v) => v !== s.value)
                        )
                      }
                      className="h-3.5 w-3.5 rounded border-slate-300 text-[#3b8bea]"
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Preview count */}
          <div
            className={
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] ' +
              (count === null
                ? 'border-slate-200 bg-slate-50 text-slate-500'
                : count === 0
                  ? 'border-amber-200 bg-amber-50/40 text-amber-800'
                  : count > 500
                    ? 'border-red-200 bg-red-50/40 text-red-800'
                    : 'border-emerald-200 bg-emerald-50/40 text-emerald-800')
            }
          >
            <Users className="h-4 w-4" />
            {count === null
              ? 'Calculando destinatarios…'
              : count === 0
                ? 'Sin destinatarios con esos filtros'
                : count > 500
                  ? `${count} destinatarios — excede límite 500`
                  : `${count} destinatario${count > 1 ? 's' : ''}`}
          </div>

          {/* Form */}
          <div>
            <label className="mb-1 block text-[12px] font-medium text-slate-600">Título *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Ej: Cierre festivo 1 mayo"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-slate-600">
              Mensaje * (markdown simple)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              maxLength={4000}
              placeholder="Hola **{nombre}**, te informamos que..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              {body.length} / 4000 caracteres
            </p>
          </div>

          {msg && (
            <div
              className={
                msg.type === 'ok'
                  ? 'rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700'
                  : 'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700'
              }
            >
              {msg.text}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSend}
              disabled={pending || count === 0 || count === null || (count ?? 0) > 500}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3b8bea] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7] disabled:opacity-60"
            >
              <Radio className="h-4 w-4" />
              {pending ? 'Enviando…' : `Enviar a ${count ?? 0}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
