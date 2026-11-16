'use client'

import { useState, useTransition } from 'react'
import { Plus, X } from 'lucide-react'
import { createQuickPaymentAction } from '../actions'
import type { PaymentHistoryRow } from '../types'

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  failed: 'bg-red-50 text-red-700 ring-red-200',
  cancelled: 'bg-slate-100 text-slate-500 ring-slate-200',
  refunded: 'bg-purple-50 text-purple-700 ring-purple-200',
}

export default function PagosTab({
  memberId,
  payments,
}: {
  memberId: string
  payments: PaymentHistoryRow[]
}) {
  const [showModal, setShowModal] = useState(false)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const pendingPayments = payments.filter((p) => p.status === 'pending')
  const completed = payments.filter((p) => p.status === 'completed')
  const otros = payments.filter(
    (p) => !['pending', 'completed'].includes(p.status)
  )

  const totalPaid = completed.reduce((acc, p) => acc + p.amount, 0)
  const totalPending = pendingPayments.reduce((acc, p) => acc + p.amount, 0)

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)

  function handleQuickPay(formData: FormData) {
    setMsg(null)
    const amount = Number(formData.get('amount') ?? 0)
    const description = String(formData.get('description') ?? '').trim()
    const method = (String(formData.get('method') ?? 'manual')) as
      | 'manual'
      | 'sepa'
      | 'card'
      | 'stripe'
    const markPaid = String(formData.get('mark_paid') ?? 'true') === 'true'

    startTransition(async () => {
      const res = await createQuickPaymentAction(memberId, {
        amount,
        description,
        method,
        markPaid,
      })
      if (res.error) setMsg({ type: 'err', text: res.error })
      else {
        setMsg({ type: 'ok', text: res.success ?? 'Creado' })
        setShowModal(false)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
          <KpiCard label="Pagado total" value={fmtCurrency(totalPaid)} tone="ok" />
          <KpiCard
            label="Pendiente"
            value={fmtCurrency(totalPending)}
            tone={totalPending > 0 ? 'warn' : 'mute'}
          />
          <KpiCard
            label="Movimientos"
            value={String(payments.length)}
            tone="mute"
          />
        </div>
        <button
          onClick={() => {
            setMsg(null)
            setShowModal(true)
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3b8bea] px-3 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7]"
        >
          <Plus className="h-4 w-4" />
          Nuevo pago manual
        </button>
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

      {pendingPayments.length > 0 && (
        <Section title={`Pendientes (${pendingPayments.length})`}>
          <PaymentTable rows={pendingPayments} />
        </Section>
      )}

      <Section title={`Historial completado (${completed.length})`}>
        <PaymentTable rows={completed} />
      </Section>

      {otros.length > 0 && (
        <Section title={`Otros movimientos (${otros.length})`}>
          <PaymentTable rows={otros} />
        </Section>
      )}

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
              <h2 className="text-lg font-bold text-slate-900">Nuevo pago manual</h2>
              <button
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form action={handleQuickPay} className="space-y-4">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-600">
                  Concepto / descripción *
                </label>
                <input
                  name="description"
                  required
                  placeholder="Ej: Cuota mensual abril, bono 10 sesiones..."
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-slate-600">
                    Importe (€) *
                  </label>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-slate-600">
                    Método
                  </label>
                  <select
                    name="method"
                    defaultValue="manual"
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  >
                    <option value="manual">Efectivo / manual</option>
                    <option value="sepa">SEPA / transferencia</option>
                    <option value="card">Tarjeta (datafono)</option>
                    <option value="stripe">Stripe (online)</option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <label className="flex items-start gap-2 text-[13px] text-slate-700">
                  <input
                    type="radio"
                    name="mark_paid"
                    value="true"
                    defaultChecked
                    className="mt-0.5 h-4 w-4 border-slate-300 text-[#3b8bea] focus:ring-[#3b8bea]"
                  />
                  <span>
                    <strong>Pago ya recibido</strong> — marcar como completado ahora.
                  </span>
                </label>
                <label className="mt-1 flex items-start gap-2 text-[13px] text-slate-700">
                  <input
                    type="radio"
                    name="mark_paid"
                    value="false"
                    className="mt-0.5 h-4 w-4 border-slate-300 text-[#3b8bea] focus:ring-[#3b8bea]"
                  />
                  <span>
                    <strong>Pendiente</strong> — registrar deuda sin marcar como pagado.
                  </span>
                </label>
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
                  {pending ? 'Creando…' : 'Crear pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'ok' | 'warn' | 'mute'
}) {
  const cls =
    tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50/40'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50/40'
        : 'border-slate-200 bg-white'
  return (
    <div className={`rounded-xl border ${cls} px-5 py-4 shadow-sm`}>
      <p className="text-[12px] font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-[18px] font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3">
        <h3 className="text-[14px] font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  )
}

function PaymentTable({ rows }: { rows: PaymentHistoryRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead className="bg-slate-50 text-left text-[12px] font-medium text-slate-500">
          <tr>
            <th className="px-5 py-2.5">Concepto</th>
            <th className="px-5 py-2.5">Importe</th>
            <th className="px-5 py-2.5">Método</th>
            <th className="px-5 py-2.5">Vencimiento</th>
            <th className="px-5 py-2.5">Pagado</th>
            <th className="px-5 py-2.5">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-slate-100 text-slate-800">
              <td className="px-5 py-2.5">
                {p.description ?? p.concept ?? '—'}
              </td>
              <td className="px-5 py-2.5 font-medium">
                {new Intl.NumberFormat('es-ES', {
                  style: 'currency',
                  currency: p.currency || 'EUR',
                }).format(p.amount)}
              </td>
              <td className="px-5 py-2.5 text-slate-500">{p.method ?? '—'}</td>
              <td className="px-5 py-2.5 text-slate-500">
                {fmtDate(p.dueDate)}
              </td>
              <td className="px-5 py-2.5 text-slate-500">
                {fmtDate(p.paidAt)}
              </td>
              <td className="px-5 py-2.5">
                <span
                  className={
                    'inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium ring-1 ' +
                    (STATUS_STYLES[p.status] ??
                      'bg-slate-100 text-slate-500 ring-slate-200')
                  }
                >
                  {p.status}
                </span>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="px-5 py-8 text-center text-[13px] text-slate-400"
              >
                Sin movimientos
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
