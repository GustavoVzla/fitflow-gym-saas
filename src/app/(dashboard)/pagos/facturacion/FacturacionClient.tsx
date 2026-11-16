'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, FileText, Plus, Receipt, Search } from 'lucide-react'
import {
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_STYLES,
  formatDateEs,
  formatEurCents,
  type InvoiceRow,
  type BillablePayment,
} from './types'
import { generateInvoiceFromPaymentAction } from './actions'

type Tab = 'invoices' | 'billable'

type Props = {
  initialInvoices: InvoiceRow[]
  initialBillable: BillablePayment[]
  fiscalReady: { ready: boolean; missing: string[] }
}

export default function FacturacionClient({ initialInvoices, initialBillable, fiscalReady }: Props) {
  const router = useRouter()
  const [invoices, setInvoices] = useState(initialInvoices)
  const [billable, setBillable] = useState(initialBillable)
  const [tab, setTab] = useState<Tab>('invoices')
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  // Filtros avanzados tab Facturas
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')
  const [filterSeries, setFilterSeries] = useState<string>('all')

  useEffect(() => setInvoices(initialInvoices), [initialInvoices])
  useEffect(() => setBillable(initialBillable), [initialBillable])

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Series únicas en las facturas actuales — para el selector de filtro.
  const availableSeries = useMemo(() => {
    const s = new Set<string>()
    for (const r of invoices) s.add(r.series)
    return Array.from(s).sort()
  }, [invoices])

  const filteredInvoices = useMemo(() => {
    const q = query.trim().toLowerCase()
    const fromTs = filterDateFrom
      ? new Date(filterDateFrom + 'T00:00:00').getTime()
      : null
    const toTs = filterDateTo ? new Date(filterDateTo + 'T23:59:59.999').getTime() : null

    return invoices.filter((r) => {
      if (q) {
        const matches =
          r.invoiceNumber.toLowerCase().includes(q) ||
          r.receiverName.toLowerCase().includes(q) ||
          (r.receiverTaxId ?? '').toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
        if (!matches) return false
      }
      if (filterSeries !== 'all' && r.series !== filterSeries) return false
      if (fromTs || toTs) {
        const d = new Date(r.issueDate.length === 10 ? r.issueDate + 'T12:00:00' : r.issueDate).getTime()
        if (fromTs && d < fromTs) return false
        if (toTs && d > toTs) return false
      }
      return true
    })
  }, [invoices, query, filterDateFrom, filterDateTo, filterSeries])

  const invoicesFiltersActive =
    filterDateFrom !== '' || filterDateTo !== '' || filterSeries !== 'all'

  const filteredBillable = useMemo(() => {
    if (!query.trim()) return billable
    const q = query.trim().toLowerCase()
    return billable.filter(
      (p) => p.memberName.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    )
  }, [billable, query])

  const totalMonth = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    return invoices
      .filter((r) => {
        const d = new Date(r.issueDate.length === 10 ? r.issueDate + 'T12:00:00' : r.issueDate)
        return d.getFullYear() === y && d.getMonth() === m && r.status === 'issued'
      })
      .reduce((acc, r) => acc + r.totalCents, 0)
  }, [invoices])

  const pendingCount = billable.filter((p) => !p.hasInvoice).length

  return (
    <div className="space-y-5">
      {!fiscalReady.ready && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Completa los datos fiscales antes de emitir facturas</p>
            <p className="mt-1 text-xs">
              Faltan: {fiscalReady.missing.join(', ')}.{' '}
              <Link href="/configuracion" className="font-semibold underline">
                Ir a Configuración › Datos fiscales
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi label="Facturas emitidas" value={invoices.filter((r) => r.status === 'issued').length.toString()} />
        <Kpi label="Facturado este mes" value={formatEurCents(totalMonth)} />
        <Kpi label="Pagos por facturar" value={pendingCount.toString()} />
      </div>

      {/* Tabs + buscador */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          <button
            onClick={() => setTab('invoices')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === 'invoices' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            Facturas ({invoices.length})
          </button>
          <button
            onClick={() => setTab('billable')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === 'billable' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Pagos por facturar ({pendingCount})
          </button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nº, socio, NIF o concepto..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none md:w-80"
          />
        </div>
      </div>

      {tab === 'invoices' && (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-[12px] sm:flex-row sm:items-end">
          <div className="flex-1 min-w-[120px]">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Desde
            </label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-1 focus:ring-blue-100 focus:outline-none"
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Hasta
            </label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-1 focus:ring-blue-100 focus:outline-none"
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Serie
            </label>
            <select
              value={filterSeries}
              onChange={(e) => setFilterSeries(e.target.value)}
              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-1 focus:ring-blue-100 focus:outline-none"
            >
              <option value="all">Todas</option>
              {availableSeries.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {invoicesFiltersActive && (
            <button
              type="button"
              onClick={() => {
                setFilterDateFrom('')
                setFilterDateTo('')
                setFilterSeries('all')
              }}
              className="h-8 shrink-0 rounded-md border border-transparent px-2 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              Limpiar
            </button>
          )}
          <p className="shrink-0 text-[11px] text-slate-500 sm:ml-2">
            {filteredInvoices.length}/{invoices.length} facturas
          </p>
        </div>
      )}

      {tab === 'invoices' ? (
        <InvoicesTable invoices={filteredInvoices} />
      ) : (
        <BillableTable
          payments={filteredBillable}
          disabled={!fiscalReady.ready}
          onGenerated={(id) => {
            router.refresh()
            showToast(`Factura generada`)
            router.push(`/pagos/facturacion/${id}`)
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-5 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

function InvoicesTable({ invoices }: { invoices: InvoiceRow[] }) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
        <Receipt className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-3 text-sm font-semibold text-slate-700">Aún no hay facturas emitidas</p>
        <p className="mt-1 text-xs text-slate-500">
          Ve a la pestaña <strong>Pagos por facturar</strong> para generar facturas desde pagos cobrados.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50/60">
            <tr>
              <Th>Nº factura</Th>
              <Th>Fecha</Th>
              <Th>Cliente</Th>
              <Th>NIF</Th>
              <Th className="text-right">Base</Th>
              <Th className="text-right">IVA</Th>
              <Th className="text-right">Total</Th>
              <Th>Estado</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {invoices.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <Td className="font-mono text-[12px] font-semibold text-slate-800">{r.invoiceNumber}</Td>
                <Td>{formatDateEs(r.issueDate)}</Td>
                <Td>{r.receiverName}</Td>
                <Td className="font-mono text-[12px]">{r.receiverTaxId ?? '—'}</Td>
                <Td className="text-right tabular-nums">{formatEurCents(r.subtotalCents)}</Td>
                <Td className="text-right tabular-nums text-slate-500">
                  {formatEurCents(r.taxCents)} ({r.taxRatePct}%)
                </Td>
                <Td className="text-right font-semibold tabular-nums">{formatEurCents(r.totalCents)}</Td>
                <Td>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${INVOICE_STATUS_STYLES[r.status]}`}
                  >
                    {INVOICE_STATUS_LABEL[r.status]}
                  </span>
                </Td>
                <Td>
                  <Link
                    href={`/pagos/facturacion/${r.id}`}
                    className="text-xs font-semibold text-[#3b8bea] hover:underline"
                  >
                    Ver
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BillableTable({
  payments,
  disabled,
  onGenerated,
  onError,
}: {
  payments: BillablePayment[]
  disabled: boolean
  onGenerated: (id: string) => void
  onError: (msg: string) => void
}) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleGenerate = (paymentId: string) => {
    setPendingId(paymentId)
    const fd = new FormData()
    fd.set('paymentId', paymentId)
    fd.set('taxRatePct', '21')
    startTransition(async () => {
      const res = await generateInvoiceFromPaymentAction({}, fd)
      setPendingId(null)
      if (res.error) {
        onError(res.error)
      } else if (res.invoiceId) {
        onGenerated(res.invoiceId)
      }
    })
  }

  if (payments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
        <FileText className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-3 text-sm font-semibold text-slate-700">No hay pagos pendientes de facturar</p>
        <p className="mt-1 text-xs text-slate-500">
          Solo se muestran pagos en estado <strong>Completado</strong> del gym.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50/60">
            <tr>
              <Th>Fecha cobro</Th>
              <Th>Socio</Th>
              <Th>NIF</Th>
              <Th>Concepto</Th>
              <Th className="text-right">Total</Th>
              <Th>Estado</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/60">
                <Td>{formatDateEs(p.paidAt)}</Td>
                <Td>
                  <div className="text-[13px] font-medium text-slate-800">{p.memberName}</div>
                  {p.memberEmail && <div className="text-[11px] text-slate-500">{p.memberEmail}</div>}
                </Td>
                <Td className="font-mono text-[12px]">{p.memberTaxId ?? '—'}</Td>
                <Td className="max-w-xs truncate">{p.description}</Td>
                <Td className="text-right font-semibold tabular-nums">
                  {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(p.amount)}
                </Td>
                <Td>
                  {p.hasInvoice ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      Facturado
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                      Pendiente
                    </span>
                  )}
                </Td>
                <Td>
                  {!p.hasInvoice && (
                    <button
                      onClick={() => handleGenerate(p.id)}
                      disabled={disabled || pendingId === p.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#3b8bea] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-[#2a6fc7] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-3 w-3" />
                      {pendingId === p.id ? 'Generando...' : 'Generar factura'}
                    </button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${className}`}
    >
      {children}
    </th>
  )
}

function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-[13px] text-slate-700 ${className}`}>{children}</td>
}
