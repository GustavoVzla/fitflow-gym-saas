'use client'

import { useMemo, useState } from 'react'
import type { AttendanceStats } from '../types'
import type { AttendanceDay } from '../data'

type RangeKey = 30 | 90 | 365

export default function AsistenciasTab({
  stats,
  daily,
}: {
  stats: AttendanceStats
  daily: AttendanceDay[]
}) {
  const [range, setRange] = useState<RangeKey>(90)

  const pct = Math.round(stats.attendanceRate * 100)
  const last30Pct =
    stats.last30Reserved > 0
      ? Math.round((stats.last30Attended / stats.last30Reserved) * 100)
      : 0

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-[14px] font-semibold text-slate-900">
          Asistencia general
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Reservas totales" value={String(stats.reservedTotal)} />
          <Stat
            label="Asistencias"
            value={String(stats.attendedTotal)}
            tone="ok"
          />
          <Stat
            label="Canceladas"
            value={String(stats.cancelledTotal)}
            tone="warn"
          />
          <Stat
            label="No-show"
            value={String(stats.noShowTotal)}
            tone={stats.noShowTotal > 0 ? 'err' : 'mute'}
          />
        </div>

        <div className="mt-6">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[12px] font-medium text-slate-600">
              Tasa de asistencia
            </span>
            <span className="text-[12px] font-semibold text-slate-900">{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-slate-900">
            Calendario de actividad
          </h3>
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            {([30, 90, 365] as const).map((d) => (
              <button
                key={d}
                onClick={() => setRange(d)}
                className={
                  range === d
                    ? 'h-7 rounded-md bg-white px-3 text-[12px] font-medium text-slate-900 shadow-sm'
                    : 'h-7 rounded-md px-3 text-[12px] font-medium text-slate-600 hover:text-slate-900'
                }
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        <Heatmap daily={daily} daysBack={range} />
        <Legend />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-[14px] font-semibold text-slate-900">
          Últimos 30 días
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Reservas" value={String(stats.last30Reserved)} />
          <Stat
            label="Asistencias"
            value={String(stats.last30Attended)}
            tone="ok"
          />
          <Stat label="Tasa" value={`${last30Pct}%`} />
        </div>
      </section>
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
  tone?: 'ok' | 'warn' | 'err' | 'mute'
}) {
  const cls =
    tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50/40 text-emerald-900'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50/40 text-amber-900'
        : tone === 'err'
          ? 'border-red-200 bg-red-50/40 text-red-900'
          : 'border-slate-200 bg-slate-50 text-slate-900'
  return (
    <div className={`rounded-lg border ${cls} px-4 py-3`}>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-[18px] font-semibold">{value}</p>
    </div>
  )
}

// ===========================================================================
// Heatmap SVG custom (sin deps npm) — grid 7 (filas semana) × N columnas
// ===========================================================================

const CELL = 12 // px per cell
const GAP = 2

function colorFor(count: number): string {
  if (count <= 0) return '#f1f5f9' // slate-100
  if (count === 1) return '#bbf7d0' // emerald-200
  if (count === 2) return '#86efac' // emerald-300
  if (count === 3) return '#4ade80' // emerald-400
  if (count <= 5) return '#22c55e' // emerald-500
  return '#15803d' // emerald-700
}

function Heatmap({ daily, daysBack }: { daily: AttendanceDay[]; daysBack: number }) {
  const dataMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of daily) m.set(d.date, d.count)
    return m
  }, [daily])

  const cells = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(today)
    start.setDate(today.getDate() - daysBack + 1)

    // Alinear al lunes anterior (ISO week starts Monday = 1; getDay() Sun=0)
    const startDay = start.getDay() // 0..6
    const offset = startDay === 0 ? 6 : startDay - 1
    start.setDate(start.getDate() - offset)

    const out: { date: string; count: number; col: number; row: number; inRange: boolean }[] = []
    const cursor = new Date(start)
    let col = 0
    while (cursor <= today) {
      const isoDate = cursor.toISOString().slice(0, 10)
      const day = cursor.getDay()
      const row = day === 0 ? 6 : day - 1 // 0=lunes ... 6=domingo
      const count = dataMap.get(isoDate) ?? 0
      const inRange = cursor >= new Date(today.getTime() - daysBack * 86400000)
      out.push({ date: isoDate, count, col, row, inRange })
      cursor.setDate(cursor.getDate() + 1)
      if (row === 6) col++
    }
    return out
  }, [dataMap, daysBack])

  const cols = Math.max(...cells.map((c) => c.col)) + 1
  const width = cols * (CELL + GAP) + 30 // +30 left labels
  const height = 7 * (CELL + GAP) + 20 // +20 bottom labels

  const totalActive = cells.filter((c) => c.inRange && c.count > 0).length
  const totalSessions = cells.filter((c) => c.inRange).reduce((acc, c) => acc + c.count, 0)

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-slate-500">
        <span className="font-semibold text-slate-900">{totalActive}</span> días con
        actividad ·{' '}
        <span className="font-semibold text-slate-900">{totalSessions}</span> sesiones
        en los últimos <span className="font-semibold text-slate-900">{daysBack}</span> días
      </p>
      <div className="overflow-x-auto">
        <svg width={width} height={height} className="text-slate-400">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => (
            <text
              key={d}
              x={4}
              y={i * (CELL + GAP) + CELL - 1}
              fontSize={9}
              fill="currentColor"
            >
              {d}
            </text>
          ))}
          {cells.map((c) => (
            <rect
              key={c.date}
              x={30 + c.col * (CELL + GAP)}
              y={c.row * (CELL + GAP)}
              width={CELL}
              height={CELL}
              rx={2}
              fill={c.inRange ? colorFor(c.count) : '#f8fafc'}
              opacity={c.inRange ? 1 : 0.4}
            >
              <title>
                {new Date(c.date).toLocaleDateString('es-ES', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
                {' — '}
                {c.count === 0 ? 'Sin actividad' : `${c.count} clase${c.count > 1 ? 's' : ''}`}
              </title>
            </rect>
          ))}
        </svg>
      </div>
    </div>
  )
}

function Legend() {
  return (
    <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
      <span>Menos</span>
      {[0, 1, 2, 3, 5, 8].map((n) => (
        <span
          key={n}
          className="inline-block h-3 w-3 rounded-sm"
          style={{ background: colorFor(n) }}
        />
      ))}
      <span>Más</span>
    </div>
  )
}
