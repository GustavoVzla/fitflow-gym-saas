import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  Banknote,
  ExternalLink,
  Info,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

interface RecentSepaPayment {
  id: string
  amount: number
  currency: string
  status: string
  paid_at: string | null
  due_date: string | null
  description: string | null
  member_name: string
}

export default async function Page() {
  const supabase = await createClient()
  const { data: gyms } = await supabase.rpc('current_user_gyms')
  if (!gyms || gyms.length === 0) redirect('/login')

  const gymId = gyms[0].gym_id

  // Estado Stripe del gym
  const { data: gym } = await supabase
    .from('gyms')
    .select('stripe_onboarded_at, payment_mode, stripe_publishable_key')
    .eq('id', gymId)
    .single()

  // Últimas 20 SEPA
  const { data: recent } = await supabase
    .from('payments')
    .select(
      `id, amount, currency, status, paid_at, due_date, description,
       member:member_id (first_name, last_name)`
    )
    .eq('gym_id', gymId)
    .eq('method', 'sepa')
    .order('due_date', { ascending: false, nullsFirst: false })
    .limit(20)

  const payments: RecentSepaPayment[] = (recent ?? []).map((p) => {
    const m = Array.isArray(p.member) ? p.member[0] : p.member
    return {
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency ?? 'EUR',
      status: p.status,
      paid_at: p.paid_at,
      due_date: p.due_date,
      description: p.description,
      member_name: m ? `${m.first_name} ${m.last_name}`.trim() : 'Socio eliminado',
    }
  })

  const stripeOnboarded = !!gym?.stripe_onboarded_at
  const paymentMode = gym?.payment_mode ?? 'manual'
  const liveMode = gym?.stripe_publishable_key?.startsWith('pk_live_') ?? false

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Banknote className="h-6 w-6 text-[var(--brand-color,#0B4B8C)]" />
          Domiciliaciones SEPA
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Cobros recurrentes por domiciliación bancaria europea (SEPA Direct Debit).
        </p>
      </header>

      {/* Estado conexión */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Estado de la integración</h2>
        {stripeOnboarded ? (
          <div className="flex items-start gap-3 rounded-md bg-emerald-50 border border-emerald-200 p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-900">
                Stripe conectado · Modo {liveMode ? 'LIVE' : 'TEST'}
              </p>
              <p className="text-xs text-emerald-800 mt-1">
                Modo de pago:{' '}
                <code className="font-mono bg-white/60 px-1.5 py-0.5 rounded">
                  {paymentMode}
                </code>
                . SEPA Direct Debit activable desde tu dashboard Stripe.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-md bg-amber-50 border border-amber-200 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                Stripe NO conectado
              </p>
              <p className="text-xs text-amber-800 mt-1">
                Conecta tu cuenta Stripe en{' '}
                <Link
                  href="/configuracion"
                  className="underline font-medium"
                >
                  Configuración &gt; Pagos
                </Link>{' '}
                antes de activar SEPA.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Guía activación */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Info className="h-4 w-4 text-slate-500" />
          Cómo activar SEPA Direct Debit en tu cuenta Stripe
        </h2>
        <ol className="list-decimal list-inside text-sm text-slate-700 space-y-2">
          <li>Entra a tu <strong>Dashboard Stripe</strong></li>
          <li>
            Settings → <strong>Payment methods</strong> → busca{' '}
            <strong>SEPA Direct Debit</strong> y activa
          </li>
          <li>
            Completa datos fiscales y domicilio en Settings → Business info (requisito
            regulatorio SEPA)
          </li>
          <li>
            Verifica que <strong>Pago por referencia</strong> está ON (permite cobro sin
            pasar Checkout cada vez)
          </li>
          <li>
            Una vez activo, cualquier pago que crees con método <code>sepa_debit</code> en
            FitFlow se presentará al banco del socio en el siguiente ciclo (T+2 a T+5)
          </li>
        </ol>
        <div className="mt-4">
          <a
            href="https://dashboard.stripe.com/settings/payment_methods"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Abrir Dashboard Stripe — Payment methods
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      {/* Histórico remesas */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">
          Últimas domiciliaciones ({payments.length})
        </h2>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">
            Sin pagos SEPA todavía. Crea un pago con método SEPA en{' '}
            <Link href="/pagos" className="underline">
              /pagos
            </Link>{' '}
            para probar el flujo.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="text-left py-2 pr-3">Fecha</th>
                  <th className="text-left py-2 pr-3">Socio</th>
                  <th className="text-left py-2 pr-3">Concepto</th>
                  <th className="text-right py-2 pr-3">Importe</th>
                  <th className="text-left py-2 pr-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-3 text-slate-600">
                      {p.paid_at
                        ? new Date(p.paid_at).toLocaleDateString('es-ES')
                        : p.due_date
                          ? new Date(p.due_date).toLocaleDateString('es-ES')
                          : '—'}
                    </td>
                    <td className="py-2 pr-3 text-slate-900">{p.member_name}</td>
                    <td className="py-2 pr-3 text-slate-600 truncate max-w-xs">
                      {p.description ?? '—'}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-900">
                      {new Intl.NumberFormat('es-ES', {
                        style: 'currency',
                        currency: p.currency,
                      }).format(p.amount)}
                    </td>
                    <td className="py-2 pr-3">
                      {p.status === 'completed' ? (
                        <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          Cobrado
                        </span>
                      ) : p.status === 'pending' ? (
                        <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Pendiente
                        </span>
                      ) : p.status === 'failed' ? (
                        <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                          Fallido
                        </span>
                      ) : (
                        <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {p.status}
                        </span>
                      )}
                    </td>
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
