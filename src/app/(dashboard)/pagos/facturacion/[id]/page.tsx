import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getInvoiceById } from '../data'
import InvoicePrintable from './InvoicePrintable'
import PrintButton from './PrintButton'

type Props = {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: 'Factura · FitFlow',
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params
  const invoice = await getInvoiceById(id)
  if (!invoice) notFound()

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link
          href="/pagos/facturacion"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al listado
        </Link>
        <PrintButton />
      </div>

      <InvoicePrintable invoice={invoice} />
    </div>
  )
}
