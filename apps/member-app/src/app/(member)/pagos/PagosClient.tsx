'use client'

import { useState, useTransition } from 'react'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  FileText,
  CreditCard,
  AlertTriangle,
} from 'lucide-react'
import type { PaymentRow } from './data'
import { startPaymentCheckoutAction } from './actions'
import { formatDateLong, formatDueLabel } from '@/lib/datetime'

export function PagosClient({
  pending,
  history,
  paymentMode,
  flashStatus,
}: {
  pending: PaymentRow[]
  history: PaymentRow[]
  paymentMode: string | null
  flashStatus: string | null
}) {
  const [tab, setTab] = useState<'pending' | 'history'>(
    pending.length > 0 ? 'pending' : 'history'
  )
  const [pendingTx, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(
    flashStatus === 'success'
      ? 'Pago realizado correctamente. Si no aparece marcado todavía, espera unos segundos y refresca.'
      : flashStatus === 'cancelled'
        ? 'Has cancelado el pago. Puedes reintentar cuando quieras.'
        : null
  )

  const canPayOnline = paymentMode === 'direct_keys'

  const totalPending = pending.reduce((acc, p) => acc + p.amount, 0)
  const currency = pending[0]?.currency ?? history[0]?.currency ?? 'EUR'

  function handlePay(paymentId: string) {
    setError(null)
    setFlash(null)
    const fd = new FormData()
    fd.set('paymentId', paymentId)
    startTransition(async () => {
      const res = await startPaymentCheckoutAction(fd)
      if (res.ok) {
        window.location.href = res.checkoutUrl
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-[22px] font-bold text-[#f0f0f5]">
          Pagos
        </h2>
        <p className="text-[13px] text-[rgba(240,240,245,0.55)]">
          {pending.length === 0
            ? 'Sin pagos pendientes — todo al día'
            : `${pending.length} ${pending.length === 1 ? 'pago pendiente' : 'pagos pendientes'} · ${formatMoney(totalPending, currency)} en total`}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-1">
        <button
          onClick={() => setTab('pending')}
          className={
            tab === 'pending'
              ? 'flex-1 rounded-lg bg-[rgba(59,139,234,0.15)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5da0ef]'
              : 'flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[rgba(240,240,245,0.45)] hover:text-[rgba(240,240,245,0.7)]'
          }
        >
          Pendientes ({pending.length})
        </button>
        <button
          onClick={() => setTab('history')}
          className={
            tab === 'history'
              ? 'flex-1 rounded-lg bg-[rgba(59,139,234,0.15)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5da0ef]'
              : 'flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[rgba(240,240,245,0.45)] hover:text-[rgba(240,240,245,0.7)]'
          }
        >
          Historial ({history.length})
        </button>
      </div>

      {flash && (
        <div className="rounded-xl border border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.08)] px-4 py-3 text-sm text-[#34d399]">
          {flash}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.08)] px-4 py-3 text-sm text-[#f87171]">
          {error}
        </div>
      )}

      {tab === 'pending' ? (
        pending.length === 0 ? (
          <Empty
            icon={CheckCircle2}
            iconColor="text-[#34d399]"
            msg="No tienes pagos pendientes"
            sub="Todo al día. Buen trabajo."
          />
        ) : (
          <>
            <ul className="space-y-2.5">
              {pending.map((p) => (
                <PaymentCard
                  key={p.id}
                  p={p}
                  canPay={canPayOnline}
                  pending={pendingTx}
                  onPay={() => handlePay(p.id)}
                />
              ))}
            </ul>
            {!canPayOnline && (
              <div className="flex items-start gap-2 rounded-xl border border-[rgba(96,165,250,0.25)] bg-[rgba(96,165,250,0.05)] p-4 text-[12px] text-[#60a5fa]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
                <p>
                  Tu gimnasio gestiona los pagos manualmente. Pasa por recepción
                  o contacta para regularizarlos.
                </p>
              </div>
            )}
          </>
        )
      ) : history.length === 0 ? (
        <Empty
          icon={FileText}
          iconColor="text-[#60a5fa]"
          msg="Aún no tienes pagos en tu historial"
          sub="Cuando se completen pagos los verás aquí."
        />
      ) : (
        <ul className="space-y-2.5">
          {history.map((p) => (
            <PaymentCard key={p.id} p={p} canPay={false} pending={false} />
          ))}
        </ul>
      )}
    </div>
  )
}

function PaymentCard({
  p,
  canPay,
  pending,
  onPay,
}: {
  p: PaymentRow
  canPay: boolean
  pending: boolean
  onPay?: () => void
}) {
  const status = statusInfo(p.status)
  const due = p.status === 'pending' ? formatDueLabel(p.dueDate) : null
  const dueCardBorder = !due
    ? ''
    : due.status === 'overdue'
      ? 'border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.04)]'
      : due.status === 'due-today'
        ? 'border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.04)]'
        : ''

  return (
    <li
      className={`glass-card p-4 ${dueCardBorder}`}
      suppressHydrationWarning
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <status.Icon className={`h-4 w-4 ${status.color}`} strokeWidth={1.8} />
            <span
              className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${status.color}`}
            >
              {status.label}
            </span>
          </div>
          <h3 className="mt-1.5 text-[14px] font-semibold text-[#f0f0f5]">
            {p.description}
          </h3>
          <div
            className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[rgba(240,240,245,0.5)]"
            suppressHydrationWarning
          >
            {p.status === 'pending' && due && (
              <span
                className={
                  due.status === 'overdue'
                    ? 'flex items-center gap-1 font-semibold text-[#f87171]'
                    : due.status === 'due-today'
                      ? 'flex items-center gap-1 font-semibold text-[#f59e0b]'
                      : ''
                }
              >
                {due.status === 'overdue' && (
                  <AlertTriangle className="h-3 w-3" strokeWidth={2} />
                )}
                {due.label}
              </span>
            )}
            {p.status === 'completed' && p.paidAt && (
              <span>Pagado {formatDateLong(p.paidAt)}</span>
            )}
            {p.invoiceNumber && <span>· #{p.invoiceNumber}</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="font-[family-name:var(--font-display)] text-[18px] font-bold leading-none text-[#f0f0f5]">
            {formatMoney(p.amount, p.currency)}
          </span>
          {p.status === 'pending' && canPay && onPay && (
            <button
              onClick={onPay}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-lg bg-[#3b8bea] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#0d0d1a] shadow-[0_0_12px_rgba(59,139,234,0.2)] transition hover:bg-[#5da0ef] disabled:opacity-50"
            >
              <CreditCard className="h-3 w-3" strokeWidth={2} />
              {pending ? 'Cargando…' : 'Pagar'}
            </button>
          )}
          {p.invoiceUrl && (
            <a
              href={p.invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg border border-[rgba(255,255,255,0.08)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[rgba(240,240,245,0.6)] hover:bg-[rgba(255,255,255,0.04)]"
            >
              <FileText className="h-3 w-3" strokeWidth={1.8} />
              Factura
              <ExternalLink className="h-2.5 w-2.5" strokeWidth={1.8} />
            </a>
          )}
        </div>
      </div>
    </li>
  )
}

function Empty({
  icon: Icon,
  iconColor,
  msg,
  sub,
}: {
  icon: typeof CheckCircle2
  iconColor: string
  msg: string
  sub: string
}) {
  return (
    <div className="glass-card flex flex-col items-center gap-3 px-8 py-12 text-center">
      <Icon className={`h-10 w-10 ${iconColor}`} strokeWidth={1.5} />
      <h3 className="font-[family-name:var(--font-display)] text-[16px] font-semibold text-[#f0f0f5]">
        {msg}
      </h3>
      <p className="text-[13px] text-[rgba(240,240,245,0.5)]">{sub}</p>
    </div>
  )
}

function statusInfo(status: string) {
  if (status === 'completed') {
    return { Icon: CheckCircle2, color: 'text-[#34d399]', label: 'Pagado' }
  }
  if (status === 'failed') {
    return { Icon: AlertCircle, color: 'text-[#f87171]', label: 'Fallido' }
  }
  return { Icon: Clock, color: 'text-[#f59e0b]', label: 'Pendiente' }
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
  }).format(amount)
}
