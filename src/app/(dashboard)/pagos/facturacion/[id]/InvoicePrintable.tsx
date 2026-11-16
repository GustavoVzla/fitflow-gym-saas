import {
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_STYLES,
  formatDateEs,
  formatEurCents,
  type InvoiceDetail,
} from '../types'

export default function InvoicePrintable({ invoice }: { invoice: InvoiceDetail }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
      {/* Barra superior meta — oculta en impresión */}
      <div className="flex items-center justify-between border-b border-slate-100 px-8 py-3 print:hidden">
        <span className="text-xs text-slate-500">
          Creada el {formatDateEs(invoice.createdAt)}
          {invoice.issuedAt && ` · Emitida el ${formatDateEs(invoice.issuedAt)}`}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${INVOICE_STATUS_STYLES[invoice.status]}`}
        >
          {INVOICE_STATUS_LABEL[invoice.status]}
        </span>
      </div>

      <article className="mx-auto max-w-3xl space-y-8 px-8 py-10 text-[13px] text-slate-800 print:max-w-none print:px-6 print:py-8">
        {/* Header */}
        <header className="flex items-start justify-between border-b border-slate-300 pb-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Factura</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-slate-900">
              {invoice.invoiceNumber}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Serie {invoice.series} · Nº correlativo {invoice.sequenceNumber} / {invoice.sequenceYear}
            </p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <p>
              <span className="font-semibold text-slate-500">Fecha expedición:</span> {formatDateEs(invoice.issueDate)}
            </p>
            {invoice.operationDate && (
              <p>
                <span className="font-semibold text-slate-500">Fecha operación:</span>{' '}
                {formatDateEs(invoice.operationDate)}
              </p>
            )}
            {invoice.dueDate && (
              <p>
                <span className="font-semibold text-slate-500">Vencimiento:</span> {formatDateEs(invoice.dueDate)}
              </p>
            )}
          </div>
        </header>

        {/* Emisor / Receptor */}
        <section className="grid grid-cols-2 gap-8">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Emisor</p>
            <p className="text-sm font-semibold text-slate-900">{invoice.emitterLegalName}</p>
            <p className="mt-0.5 font-mono text-[12px] text-slate-700">NIF {invoice.emitterTaxId}</p>
            <p className="mt-1 whitespace-pre-line text-[12px] leading-snug text-slate-600">
              {invoice.emitterFiscalAddress}
              {'\n'}
              {invoice.emitterPostalCode} {invoice.emitterCity}
              {'\n'}
              {countryName(invoice.emitterCountryCode)}
            </p>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Receptor</p>
            <p className="text-sm font-semibold text-slate-900">{invoice.receiverName || 'Cliente'}</p>
            {invoice.receiverTaxId && (
              <p className="mt-0.5 font-mono text-[12px] text-slate-700">NIF {invoice.receiverTaxId}</p>
            )}
            {invoice.receiverEmail && <p className="text-[12px] text-slate-600">{invoice.receiverEmail}</p>}
            {invoice.receiverAddress && (
              <p className="mt-1 whitespace-pre-line text-[12px] leading-snug text-slate-600">
                {invoice.receiverAddress}
              </p>
            )}
          </div>
        </section>

        {/* Concepto */}
        <section>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-slate-300 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2">Descripción</th>
                <th className="w-28 py-2 text-right">Base</th>
                <th className="w-20 py-2 text-right">IVA</th>
                <th className="w-24 py-2 text-right">Cuota IVA</th>
                <th className="w-28 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-3 align-top">{invoice.description}</td>
                <td className="py-3 text-right tabular-nums">{formatEurCents(invoice.subtotalCents)}</td>
                <td className="py-3 text-right tabular-nums text-slate-500">{invoice.taxRatePct}%</td>
                <td className="py-3 text-right tabular-nums">{formatEurCents(invoice.taxCents)}</td>
                <td className="py-3 text-right font-semibold tabular-nums">{formatEurCents(invoice.totalCents)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Totales */}
        <section className="ml-auto w-80 space-y-1.5 text-[12px]">
          <Row label="Base imponible" value={formatEurCents(invoice.subtotalCents)} />
          <Row label={`IVA (${invoice.taxRatePct}%)`} value={formatEurCents(invoice.taxCents)} />
          <div className="mt-2 flex items-center justify-between border-t-2 border-slate-900 pt-2 text-base">
            <span className="font-bold">TOTAL</span>
            <span className="font-mono font-bold tabular-nums">{formatEurCents(invoice.totalCents)}</span>
          </div>
          <p className="pt-1 text-right text-[10px] text-slate-500">Moneda: {invoice.currency}</p>
        </section>

        {invoice.notes && (
          <section className="rounded-lg bg-slate-50 p-4 text-[12px] text-slate-600">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Notas</p>
            <p className="whitespace-pre-line">{invoice.notes}</p>
          </section>
        )}

        <footer className="border-t border-slate-200 pt-4 text-[10px] text-slate-500">
          <p>
            Documento emitido al amparo del Real Decreto 1619/2012 — Reglamento por el que se regulan las
            obligaciones de facturación.
          </p>
          {invoice.linkedPaymentId && (
            <p className="mt-0.5 font-mono">Ref. pago interno: {invoice.linkedPaymentId}</p>
          )}
        </footer>
      </article>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  )
}

function countryName(code: string): string {
  const map: Record<string, string> = {
    ES: 'España',
    PT: 'Portugal',
    FR: 'Francia',
    IT: 'Italia',
    DE: 'Alemania',
    GB: 'Reino Unido',
    MX: 'México',
    AR: 'Argentina',
    CO: 'Colombia',
    VE: 'Venezuela',
  }
  return map[code] ?? code
}
