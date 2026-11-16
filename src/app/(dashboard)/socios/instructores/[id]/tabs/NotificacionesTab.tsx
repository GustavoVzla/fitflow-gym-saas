'use client'

import { useState, useTransition } from 'react'
import { Bell, RotateCcw, Save } from 'lucide-react'
import { saveNotificationPrefsAction } from '../../actions'
import {
  DELIVERY_OPTIONS,
  NOTIFICATION_CATEGORIES,
  type NotifDelivery,
} from '../../types'

interface Props {
  instructorId: string
  initialPrefs: Record<string, NotifDelivery>
}

export default function NotificacionesTab({ instructorId, initialPrefs }: Props) {
  const initial = applyDefaults(initialPrefs)
  const [prefs, setPrefs] = useState<Record<string, NotifDelivery>>(initial)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [dirty, setDirty] = useState(false)

  function setDelivery(category: string, delivery: NotifDelivery) {
    setPrefs((prev) => ({ ...prev, [category]: delivery }))
    setDirty(true)
  }

  function reset() {
    setPrefs(initial)
    setDirty(false)
    setMsg(null)
  }

  function save() {
    setMsg(null)
    const arr = NOTIFICATION_CATEGORIES.map((c) => ({
      category: c.key,
      delivery: prefs[c.key] ?? 'none',
    }))
    startTransition(async () => {
      const res = await saveNotificationPrefsAction(instructorId, arr)
      if (res.error) setMsg({ type: 'err', text: res.error })
      else {
        setMsg({ type: 'ok', text: res.success ?? 'Guardado' })
        setDirty(false)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-100 bg-blue-50/40 px-4 py-3 text-[13px] text-slate-700">
        <div className="flex items-start gap-2">
          <Bell className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#3b8bea]" />
          <div>
            <p className="font-medium text-slate-900">
              Notificaciones internas del staff
            </p>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Configura cómo notificar a este instructor cuando ocurran eventos
              en el gym. Push requiere que el instructor tenga la app instalada
              y haya aceptado notificaciones.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-[13px]">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr className="text-left text-[12px] font-medium text-slate-500">
              <th className="px-5 py-3">Evento</th>
              {DELIVERY_OPTIONS.map((opt) => (
                <th key={opt.value} className="px-3 py-3 text-center">
                  {opt.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_CATEGORIES.map((cat) => {
              const current = prefs[cat.key] ?? 'none'
              return (
                <tr key={cat.key} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-5 py-3 align-top">
                    <p className="font-medium text-slate-900">{cat.label}</p>
                    {cat.description && (
                      <p className="mt-0.5 text-[12px] text-slate-500">
                        {cat.description}
                      </p>
                    )}
                  </td>
                  {DELIVERY_OPTIONS.map((opt) => (
                    <td key={opt.value} className="px-3 py-3 text-center align-top">
                      <label className="inline-flex cursor-pointer items-center justify-center">
                        <input
                          type="radio"
                          name={`notif-${cat.key}`}
                          checked={current === opt.value}
                          onChange={() => setDelivery(cat.key, opt.value)}
                          className="h-4 w-4 cursor-pointer border-slate-300 text-[#3b8bea] focus:ring-[#3b8bea]"
                        />
                      </label>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
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

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          onClick={reset}
          disabled={!dirty || pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          Descartar
        </button>
        <button
          onClick={save}
          disabled={!dirty || pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3b8bea] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7] disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {pending ? 'Guardando…' : 'Guardar preferencias'}
        </button>
      </div>
    </div>
  )
}

function applyDefaults(stored: Record<string, NotifDelivery>): Record<string, NotifDelivery> {
  const out: Record<string, NotifDelivery> = {}
  for (const c of NOTIFICATION_CATEGORIES) {
    out[c.key] = stored[c.key] ?? 'none'
  }
  return out
}
