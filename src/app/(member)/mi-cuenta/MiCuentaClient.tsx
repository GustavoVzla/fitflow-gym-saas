'use client'

import { useState, useTransition } from 'react'
import type { MemberDashboardData, SubscriptionStatus } from './types'
import { activateSubscriptionAction, openCustomerPortalAction } from './actions'

function statusLabel(status: SubscriptionStatus): { label: string; color: string } {
  if (status === 'active') return { label: 'Domiciliación activa', color: 'emerald' }
  if (status === 'trialing') return { label: 'En periodo de prueba', color: 'indigo' }
  if (status === 'past_due') return { label: 'Pago pendiente', color: 'amber' }
  if (status === 'canceled') return { label: 'Cancelada', color: 'slate' }
  if (status === 'unpaid') return { label: 'Impago', color: 'red' }
  if (status === 'paused') return { label: 'Pausada', color: 'slate' }
  if (status === 'incomplete' || status === 'incomplete_expired')
    return { label: 'Pendiente de completar', color: 'amber' }
  return { label: 'Sin domiciliación', color: 'slate' }
}

function formatEUR(amount: number, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function MiCuentaClient({
  data,
  successFlag,
  canceledFlag,
}: {
  data: MemberDashboardData
  successFlag: string | null
  canceledFlag: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const status = statusLabel(data.subscriptionStatus)
  const hasSubscription = Boolean(data.stripeSubscriptionId)
  const hasStripeCustomer = Boolean(data.stripeCustomerId)
  const gymCanCharge = data.gymPaymentMode === 'direct_keys' && data.stripeOnboarded
  const canActivate = gymCanCharge && Boolean(data.stripePriceId) && data.tariffType === 'monthly'

  function handleActivate() {
    setError(null)
    startTransition(async () => {
      const result = await activateSubscriptionAction()
      if (result.error) {
        setError(result.error)
      } else if (result.url) {
        window.location.href = result.url
      }
    })
  }

  function handlePortal() {
    setError(null)
    startTransition(async () => {
      const result = await openCustomerPortalAction()
      if (result.error) {
        setError(result.error)
      } else if (result.url) {
        window.location.href = result.url
      }
    })
  }

  return (
    <div className="space-y-6">
      {successFlag === 'subscribed' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Domiciliación activada correctamente. A partir de ahora el cobro será automático.
        </div>
      )}
      {canceledFlag && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Has cancelado el proceso de activación. Puedes intentarlo cuando quieras.
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Gimnasio</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{data.gymName}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {data.fullName} · {data.email}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium border-${status.color}-200 bg-${status.color}-50 text-${status.color}-800`}
          >
            {status.label}
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Tu cuota</h2>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Tarifa actual</div>
            <div className="text-xl font-semibold text-slate-900">
              {data.tariffName ?? 'Sin tarifa asignada'}
            </div>
          </div>
          {data.tariffAmount != null && (
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Importe</div>
              <div className="text-xl font-semibold text-slate-900">
                {formatEUR(data.tariffAmount)}
                <span className="text-sm font-normal text-slate-500">
                  {data.tariffType === 'monthly' ? ' / mes' : ''}
                </span>
              </div>
            </div>
          )}
          {data.subscriptionCurrentPeriodEnd && (
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Próximo cobro</div>
              <div className="text-xl font-semibold text-slate-900">
                {formatDate(data.subscriptionCurrentPeriodEnd)}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {!hasSubscription && canActivate && (
            <button
              onClick={handleActivate}
              disabled={pending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {pending ? 'Abriendo Stripe…' : 'Activar domiciliación'}
            </button>
          )}
          {hasSubscription && hasStripeCustomer && (
            <button
              onClick={handlePortal}
              disabled={pending}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {pending ? 'Abriendo…' : 'Gestionar pago'}
            </button>
          )}
          {!hasSubscription && !canActivate && (
            <p className="text-sm text-slate-600">
              {!gymCanCharge
                ? 'Este gimnasio aún no acepta domiciliación automática. Tus pagos se gestionan manualmente.'
                : !data.stripePriceId
                  ? 'Tu tarifa aún no está sincronizada con Stripe. Contacta con tu gimnasio.'
                  : 'Tu tarifa no es compatible con domiciliación mensual.'}
            </p>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Historial de pagos</h2>
        {data.recentPayments.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">Todavía no hay pagos registrados.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="py-2">Fecha</th>
                  <th className="py-2">Concepto</th>
                  <th className="py-2">Origen</th>
                  <th className="py-2 text-right">Importe</th>
                  <th className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPayments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 text-slate-700">{formatDate(p.paidAt ?? p.createdAt)}</td>
                    <td className="py-3 text-slate-700">{p.description ?? 'Pago'}</td>
                    <td className="py-3 text-slate-500 text-xs">{p.paymentSource}</td>
                    <td className="py-3 text-right font-medium text-slate-900">
                      {formatEUR(p.amount, p.currency)}
                    </td>
                    <td className="py-3 text-slate-600 text-xs capitalize">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
