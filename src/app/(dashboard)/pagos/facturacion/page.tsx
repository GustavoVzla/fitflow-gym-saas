import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import FacturacionClient from './FacturacionClient'
import { getInvoices, getBillablePayments, getGymFiscalReady } from './data'

export const metadata = {
  title: 'Facturación · FitFlow',
}

export default async function FacturacionPage() {
  const [invoices, billable, fiscalReady] = await Promise.all([
    getInvoices(),
    getBillablePayments(),
    getGymFiscalReady(),
  ])

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/pagos"
          className="inline-flex w-fit items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a Pagos
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Facturación</h1>
          <p className="mt-1 text-sm text-slate-500">
            Emite facturas bajo el Real Decreto 1619/2012 a partir de pagos cobrados. El emisor, numeración y total
            quedan inmutables una vez emitida.
          </p>
        </div>
      </div>

      <FacturacionClient initialInvoices={invoices} initialBillable={billable} fiscalReady={fiscalReady} />
    </div>
  )
}
