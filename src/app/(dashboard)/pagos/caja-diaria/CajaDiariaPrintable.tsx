type PaymentRow = {
  id: string
  memberName: string
  description: string
  amount: number
  method: string
  paidAt: string
  externalReference: string | null
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  bank_transfer: 'Transferencia',
  sepa: 'SEPA',
  stripe: 'Stripe',
  manual: 'Manual',
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

function formatDateEs(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export default function CajaDiariaPrintable({
  date,
  payments,
  gymName,
  legalName,
}: {
  date: string
  payments: PaymentRow[]
  gymName: string
  legalName: string | null
}) {
  const total = payments.reduce((s, p) => s + p.amount, 0)
  const byMethod = payments.reduce<Record<string, { count: number; amount: number }>>(
    (acc, p) => {
      const key = p.method
      acc[key] = acc[key] ?? { count: 0, amount: 0 }
      acc[key].count += 1
      acc[key].amount += p.amount
      return acc
    },
    {}
  )

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
      <article className="mx-auto max-w-3xl space-y-6 px-8 py-10 text-[13px] text-slate-800 print:max-w-none print:px-6 print:py-8">
        <header className="flex items-start justify-between border-b border-slate-300 pb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Arqueo de caja diaria
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {formatDateEs(date + 'T12:00:00')}
            </h1>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {legalName ?? gymName}
              {legalName && gymName && legalName !== gymName && ` · ${gymName}`}
            </p>
          </div>
          <div className="text-right text-[11px] text-slate-500">
            <p>
              <span className="font-semibold text-slate-700">Pagos cobrados:</span>{' '}
              {payments.length}
            </p>
            <p className="mt-0.5 text-base font-bold text-slate-900">{formatEur(total)}</p>
          </div>
        </header>

        {payments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <p className="text-sm font-semibold text-slate-700">Sin cobros en esta fecha</p>
            <p className="mt-1 text-xs text-slate-500">
              Ningún pago pasó a completado el día {formatDateEs(date + 'T12:00:00')}.
            </p>
          </div>
        ) : (
          <>
            <section>
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-slate-300 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2 w-16">Hora</th>
                    <th className="py-2">Socio</th>
                    <th className="py-2">Concepto</th>
                    <th className="py-2 w-24">Método</th>
                    <th className="py-2 w-20 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 align-top">
                      <td className="py-2 tabular-nums text-slate-500">{formatTime(p.paidAt)}</td>
                      <td className="py-2">{p.memberName}</td>
                      <td className="py-2">
                        <p>{p.description}</p>
                        {p.externalReference && (
                          <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                            Ref. {p.externalReference}
                          </p>
                        )}
                      </td>
                      <td className="py-2 text-slate-600">
                        {METHOD_LABEL[p.method] ?? p.method}
                      </td>
                      <td className="py-2 text-right font-semibold tabular-nums">
                        {formatEur(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="ml-auto w-80 space-y-1.5 text-[12px]">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Desglose por método
              </p>
              {Object.entries(byMethod).map(([method, stats]) => (
                <div key={method} className="flex items-center justify-between">
                  <span className="text-slate-600">
                    {METHOD_LABEL[method] ?? method}{' '}
                    <span className="text-slate-400">({stats.count})</span>
                  </span>
                  <span className="font-mono tabular-nums">{formatEur(stats.amount)}</span>
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between border-t-2 border-slate-900 pt-2 text-base">
                <span className="font-bold">TOTAL</span>
                <span className="font-mono font-bold tabular-nums">{formatEur(total)}</span>
              </div>
            </section>
          </>
        )}

        <footer className="border-t border-slate-200 pt-4 text-[10px] text-slate-500">
          <p>
            Arqueo generado desde FitFlow. Filtra pagos con estado <strong>completado</strong> y
            fecha de cobro (<code>paid_at</code>) dentro del día seleccionado.
          </p>
          <p className="mt-2">
            <span className="inline-block border-t border-slate-400 pt-1">
              Firma responsable de caja: ___________________________
            </span>
          </p>
        </footer>
      </article>
    </div>
  )
}
