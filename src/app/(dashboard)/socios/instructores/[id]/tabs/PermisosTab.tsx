'use client'

import { useState, useTransition } from 'react'
import { RotateCcw, ShieldCheck } from 'lucide-react'
import { savePermissionsAction } from '../../actions'
import { PERMISSION_MATRIX, type PermissionDefinition } from '../../types'

interface Props {
  instructorId: string
  initialPermissions: Record<string, number>
}

export default function PermisosTab({ instructorId, initialPermissions }: Props) {
  const initial = applyDefaults(initialPermissions)
  const [perms, setPerms] = useState<Record<string, number>>(initial)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [dirty, setDirty] = useState(false)

  function setLevel(key: string, level: number) {
    setPerms((prev) => ({ ...prev, [key]: level }))
    setDirty(true)
  }

  function reset() {
    setPerms(initial)
    setDirty(false)
    setMsg(null)
  }

  function save() {
    setMsg(null)
    const arr = PERMISSION_MATRIX.map((p) => ({ key: p.key, level: perms[p.key] ?? 0 }))
    startTransition(async () => {
      const res = await savePermissionsAction(instructorId, arr)
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
        <p className="font-medium text-slate-900">
          Matriz de permisos ({PERMISSION_MATRIX.length})
        </p>
        <p className="mt-0.5 text-[12px] text-slate-500">
          Configura qué puede hacer este instructor desde el panel y la app.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ul className="divide-y divide-slate-100">
          {PERMISSION_MATRIX.map((p) => (
            <PermissionRow
              key={p.key}
              perm={p}
              level={perms[p.key] ?? 0}
              onChange={(l) => setLevel(p.key, l)}
            />
          ))}
        </ul>
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
          <ShieldCheck className="h-4 w-4" />
          {pending ? 'Guardando…' : 'Guardar permisos'}
        </button>
      </div>
    </div>
  )
}

function PermissionRow({
  perm,
  level,
  onChange,
}: {
  perm: PermissionDefinition
  level: number
  onChange: (level: number) => void
}) {
  return (
    <li className="grid grid-cols-1 gap-3 px-5 py-3 md:grid-cols-[260px_1fr]">
      <div>
        <p className="text-[13px] font-medium text-slate-900">{perm.label}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {perm.levels.map((opt) => {
          const active = level === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={
                'inline-flex h-8 items-center rounded-full px-3 text-[12px] font-medium transition-colors ' +
                (active
                  ? 'bg-[#3b8bea] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
              }
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </li>
  )
}

function applyDefaults(stored: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of PERMISSION_MATRIX) {
    out[p.key] = stored[p.key] ?? 0
  }
  return out
}
