'use client'

import { useEffect, useState } from 'react'
import { Clock, Download, Loader2 } from 'lucide-react'

export interface CheckInRow {
  id: string
  checkedInAt: string
  checkedOutAt: string | null
  durationMinutes: number | null
  source: 'webapp' | 'pwa' | 'manual'
  cancelled: boolean
}

interface Props {
  instructorId: string
  initialEntries: CheckInRow[]
  monthTotalMinutes: number
  monthSessions: number
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function fmtDuration(minutes: number | null) {
  if (minutes == null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

function exportCsv(entries: CheckInRow[]) {
  const header = ['Fecha entrada', 'Fecha salida', 'Duración (min)', 'Origen', 'Anulado']
  const rows = entries.map((e) => [
    fmtDateTime(e.checkedInAt),
    e.checkedOutAt ? fmtDateTime(e.checkedOutAt) : 'En curso',
    e.durationMinutes ?? '',
    e.source,
    e.cancelled ? 'Sí' : 'No',
  ])
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fichado_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function FichadoTab({
  instructorId,
  initialEntries,
  monthTotalMinutes,
  monthSessions,
}: Props) {
  const [entries, setEntries] = useState<CheckInRow[]>(initialEntries)
  const [pending, setPending] = useState(false)
  const [monthFilter, setMonthFilter] = useState<string>(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  )

  // Re-fetch al cambiar mes
  useEffect(() => {
    if (monthFilter === new Date().toISOString().slice(0, 7)) return
    setPending(true)
    fetch(`/api/instructors/${instructorId}/check-ins?month=${monthFilter}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setEntries(d.entries)
      })
      .catch(() => {})
      .finally(() => setPending(false))
  }, [monthFilter, instructorId])

  const totalH = Math.floor(monthTotalMinutes / 60)
  const totalM = monthTotalMinutes % 60

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-100 bg-blue-50/40 px-4 py-3 text-[13px] text-slate-700">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#3b8bea]" />
          <div>
            <p className="font-medium text-slate-900">
              Registro horario laboral (RD-ley 8/2019)
            </p>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Obligatorio España. El instructor ficha al abrir la app y se cierra
              automáticamente al fichar de nuevo. Cualquier corrección manual queda
              registrada.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Stat label="Total mes" value={`${totalH}h ${totalM.toString().padStart(2, '0')}m`} tone="ok" />
        <Stat label="Sesiones cerradas" value={String(monthSessions)} />
        <Stat
          label="Promedio sesión"
          value={
            monthSessions > 0
              ? fmtDuration(Math.round(monthTotalMinutes / monthSessions))
              : '—'
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[12px] font-medium text-slate-600">
          Mes:
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="ml-2 h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
          />
        </label>
        <button
          onClick={() => exportCsv(entries)}
          disabled={entries.length === 0}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-left text-[12px] font-medium text-slate-500">
            <tr>
              <th className="px-5 py-3">Fecha</th>
              <th className="px-5 py-3">Entrada</th>
              <th className="px-5 py-3">Salida</th>
              <th className="px-5 py-3">Duración</th>
              <th className="px-5 py-3">Origen</th>
            </tr>
          </thead>
          <tbody>
            {pending && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-[13px] text-slate-400">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            )}
            {!pending &&
              entries.map((e) => (
                <tr
                  key={e.id}
                  className={
                    'border-t border-slate-100 ' +
                    (e.cancelled ? 'text-slate-400 line-through' : 'text-slate-800')
                  }
                >
                  <td className="px-5 py-2.5">{fmtDate(e.checkedInAt)}</td>
                  <td className="px-5 py-2.5">{new Date(e.checkedInAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-5 py-2.5">
                    {e.checkedOutAt
                      ? new Date(e.checkedOutAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                      : <span className="text-emerald-600 text-[12px]">En curso</span>}
                  </td>
                  <td className="px-5 py-2.5">{fmtDuration(e.durationMinutes)}</td>
                  <td className="px-5 py-2.5">
                    <span className="inline-flex h-5 items-center rounded-full bg-slate-100 px-2 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                      {e.source}
                    </span>
                  </td>
                </tr>
              ))}
            {!pending && entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-[13px] text-slate-400">
                  Sin entradas en este mes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  tone = 'mute',
}: {
  label: string
  value: string
  tone?: 'ok' | 'mute'
}) {
  const cls =
    tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50/40'
      : 'border-slate-200 bg-slate-50'
  return (
    <div className={`rounded-lg border ${cls} px-4 py-3`}>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-[18px] font-semibold text-slate-900">{value}</p>
    </div>
  )
}
