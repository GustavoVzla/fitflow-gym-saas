'use client'

import { useState, useTransition } from 'react'
import { Edit3, X } from 'lucide-react'
import { changeMemberTariffAction } from '../actions'
import type { MemberDetail, MemberTariffHistoryRow, TariffOption } from '../types'

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function TarifaTab({
  member,
  history,
  tariffs,
}: {
  member: MemberDetail
  history: MemberTariffHistoryRow[]
  tariffs: TariffOption[]
}) {
  const [showModal, setShowModal] = useState(false)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [selected, setSelected] = useState<string>(member.currentTariffId ?? '')

  function handleChange() {
    setMsg(null)
    startTransition(async () => {
      const res = await changeMemberTariffAction(
        member.id,
        selected || null
      )
      if (res.error) setMsg({ type: 'err', text: res.error })
      else {
        setMsg({ type: 'ok', text: res.success ?? 'Tarifa actualizada' })
        setShowModal(false)
      }
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-slate-900">Tarifa actual</h3>
          <button
            onClick={() => {
              setSelected(member.currentTariffId ?? '')
              setMsg(null)
              setShowModal(true)
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Cambiar tarifa
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Stat label="Tarifa" value={member.currentTariffName ?? 'Sin tarifa'} />
          <Stat
            label="Precio"
            value={
              member.currentTariffPrice != null
                ? new Intl.NumberFormat('es-ES', {
                    style: 'currency',
                    currency: 'EUR',
                  }).format(member.currentTariffPrice)
                : '—'
            }
          />
          <Stat
            label="Próximo cobro"
            value={fmtDate(member.currentTariffNextChargeAt)}
          />
        </div>
        {msg && (
          <div
            className={
              msg.type === 'ok'
                ? 'mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700'
                : 'mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700'
            }
          >
            {msg.text}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-[14px] font-semibold text-slate-900">
            Historial de tarifas ({history.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 text-left text-[12px] font-medium text-slate-500">
              <tr>
                <th className="px-5 py-2.5">Tarifa</th>
                <th className="px-5 py-2.5">Importe</th>
                <th className="px-5 py-2.5">Activo desde</th>
                <th className="px-5 py-2.5">Activo hasta</th>
                <th className="px-5 py-2.5">Estado</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-slate-100 text-slate-800"
                >
                  <td className="px-5 py-2.5">{row.tariffName}</td>
                  <td className="px-5 py-2.5">
                    {row.amount != null
                      ? new Intl.NumberFormat('es-ES', {
                          style: 'currency',
                          currency: 'EUR',
                        }).format(row.amount)
                      : '—'}
                  </td>
                  <td className="px-5 py-2.5">{fmtDate(row.startsAt)}</td>
                  <td className="px-5 py-2.5">{fmtDate(row.endsAt)}</td>
                  <td className="px-5 py-2.5">
                    <span
                      className={
                        row.status === 'active'
                          ? 'inline-flex h-5 items-center rounded-full bg-emerald-50 px-2 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200'
                          : 'inline-flex h-5 items-center rounded-full bg-slate-100 px-2 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200'
                      }
                    >
                      {row.status === 'active' ? 'Activo' : 'Histórico'}
                    </span>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-[13px] text-slate-400"
                  >
                    No hay historial de tarifas
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
            className="relative mx-4 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Cambiar tarifa</h2>
              <button
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-[13px] text-slate-600">
                Cambia la tarifa activa del socio. El histórico se mantiene
                intacto. Para asignar una tarifa nueva con condiciones (fechas,
                créditos, etc.) usa <code className="rounded bg-slate-100 px-1">/clases-tarifas</code>.
              </p>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-600">
                  Nueva tarifa
                </label>
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                >
                  <option value="">Sin tarifa</option>
                  {tariffs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.group ? ` (${t.group})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleChange}
                disabled={pending}
                className="h-9 rounded-lg bg-[#3b8bea] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7] disabled:opacity-60"
              >
                {pending ? 'Guardando…' : 'Aplicar cambio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <p className="text-[12px] font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-[14px] font-semibold text-slate-900">{value}</p>
    </div>
  )
}
