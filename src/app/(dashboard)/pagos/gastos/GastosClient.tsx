'use client'

import { useMemo, useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  X,
  Loader2,
  AlertCircle,
  Paperclip,
  Download,
  Trash2,
  TrendingUp,
  TrendingDown,
  Receipt,
  Search,
} from 'lucide-react'
import {
  listExpensesAction,
  createExpenseAction,
  deleteExpenseAction,
  createInvoiceUploadUrlAction,
  getInvoiceDownloadUrlAction,
  type Expense,
  type ExpenseCategory,
  type ExpenseKpis,
} from './actions'

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  material: 'Material',
  utilities: 'Suministros',
  rent: 'Alquiler',
  staff: 'Personal',
  cleaning: 'Limpieza',
  marketing: 'Marketing',
  software: 'Software',
  maintenance: 'Mantenimiento',
  other: 'Otros',
}

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  material: 'bg-blue-50 text-blue-700 ring-blue-200',
  utilities: 'bg-amber-50 text-amber-700 ring-amber-200',
  rent: 'bg-red-50 text-red-700 ring-red-200',
  staff: 'bg-purple-50 text-purple-700 ring-purple-200',
  cleaning: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  marketing: 'bg-pink-50 text-pink-700 ring-pink-200',
  software: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  maintenance: 'bg-orange-50 text-orange-700 ring-orange-200',
  other: 'bg-slate-100 text-slate-600 ring-slate-200',
}

interface Props {
  initialExpenses: Expense[]
  initialKpis: ExpenseKpis | null
}

export default function GastosClient({ initialExpenses, initialKpis }: Props) {
  const router = useRouter()
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const kpis = initialKpis
  const [showNewModal, setShowNewModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'all'>('all')
  const [toast, setToast] = useState<{ message: string; kind: 'ok' | 'err' } | null>(null)
  const [pending, startTransition] = useTransition()

  const showToast = (message: string, kind: 'ok' | 'err') => {
    setToast({ message, kind })
    setTimeout(() => setToast(null), 4000)
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return expenses.filter((e) => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false
      if (!q) return true
      return (
        e.description.toLowerCase().includes(q) ||
        (e.supplier ?? '').toLowerCase().includes(q) ||
        (e.invoiceNumber ?? '').toLowerCase().includes(q)
      )
    })
  }, [expenses, searchQuery, categoryFilter])

  const totalFiltered = filtered.reduce((sum, e) => sum + e.amount, 0)

  const handleDelete = (id: string) => {
    if (!confirm('¿Eliminar este gasto? (soft delete, recuperable 30 días)')) return
    startTransition(async () => {
      const res = await deleteExpenseAction(id)
      if (res.ok) {
        setExpenses((prev) => prev.filter((e) => e.id !== id))
        showToast('Gasto eliminado', 'ok')
        router.refresh()
      } else {
        showToast(res.error, 'err')
      }
    })
  }

  const handleDownloadInvoice = async (path: string) => {
    const res = await getInvoiceDownloadUrlAction(path)
    if (res.ok) {
      window.open(res.url, '_blank')
    } else {
      showToast(res.error, 'err')
    }
  }

  const exportCSV = () => {
    const header = ['Fecha', 'Categoría', 'Proveedor', 'Descripción', 'Importe', 'IVA', 'Nº factura']
    const rows = filtered.map((e) => [
      e.expenseDate,
      CATEGORY_LABELS[e.category],
      e.supplier ?? '',
      e.description,
      e.amount.toFixed(2),
      e.taxAmount.toFixed(2),
      e.invoiceNumber ?? '',
    ])
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gastos_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/pagos"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a Pagos
        </Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Gastos</h1>
            <p className="mt-1 text-sm text-slate-500">
              Registro de gastos operativos del gym (material, suministros, alquiler, marketing, etc.)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-[13px] font-medium text-white shadow-sm hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" />
              Nuevo gasto
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      {kpis && <KpiRow kpis={kpis} />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por descripción, proveedor o factura..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px]"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | 'all')}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px]"
        >
          <option value="all">Todas las categorías</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <span className="ml-auto text-xs font-semibold text-slate-500">
          {filtered.length} gastos · {totalFiltered.toFixed(2)} €
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">
              {expenses.length === 0 ? 'No hay gastos registrados todavía' : 'No hay gastos con estos filtros'}
            </p>
            {expenses.length === 0 && (
              <button
                onClick={() => setShowNewModal(true)}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-[13px] font-medium text-white hover:bg-indigo-500"
              >
                <Plus className="h-4 w-4" />
                Registrar primer gasto
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[11px] font-semibold text-slate-500 border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3">Fecha</th>
                <th className="text-left px-4 py-3">Categoría</th>
                <th className="text-left px-4 py-3">Proveedor</th>
                <th className="text-left px-4 py-3">Descripción</th>
                <th className="text-right px-4 py-3">Importe</th>
                <th className="text-right px-4 py-3">IVA</th>
                <th className="text-center px-4 py-3">Factura</th>
                <th className="text-right px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((exp) => (
                <tr key={exp.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {new Date(exp.expenseDate).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${CATEGORY_COLORS[exp.category]}`}>
                      {CATEGORY_LABELS[exp.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{exp.supplier ?? <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 text-slate-900">{exp.description}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">{exp.amount.toFixed(2)} €</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">
                    {exp.taxAmount > 0 ? `${exp.taxAmount.toFixed(2)} €` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {exp.invoiceUrl ? (
                      <button
                        onClick={() => handleDownloadInvoice(exp.invoiceUrl!)}
                        title={exp.invoiceNumber ?? 'Descargar factura'}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(exp.id)}
                      disabled={pending}
                      title="Eliminar (soft delete)"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNewModal && (
        <NewExpenseModal
          onClose={() => setShowNewModal(false)}
          onSuccess={(msg) => {
            setShowNewModal(false)
            showToast(msg, 'ok')
            // Refresh list
            startTransition(async () => {
              const fresh = await listExpensesAction()
              setExpenses(fresh)
              router.refresh()
            })
          }}
          onError={(msg) => showToast(msg, 'err')}
          pending={pending}
          startTransition={startTransition}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.kind === 'ok' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// KpiRow — total gastos mes + ingresos + gross margin
// ============================================================================

function KpiRow({ kpis }: { kpis: ExpenseKpis }) {
  const monthLabel = new Date(kpis.monthStart).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const positive = kpis.grossMargin >= 0

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiCard
        label="Gastos del mes"
        value={`${kpis.totalExpenses.toFixed(2)} €`}
        hint={monthLabel}
        color="slate"
        icon={<Receipt className="h-4 w-4" />}
      />
      <KpiCard
        label="Ingresos del mes"
        value={`${kpis.totalIncome.toFixed(2)} €`}
        hint={monthLabel}
        color="emerald"
        icon={<TrendingUp className="h-4 w-4" />}
      />
      <KpiCard
        label="Margen bruto"
        value={`${kpis.grossMargin.toFixed(2)} €`}
        hint={positive ? 'Ingresos - Gastos' : 'En pérdidas este mes'}
        color={positive ? 'emerald' : 'red'}
        icon={positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
      />
      <KpiCard
        label="Margen %"
        value={`${kpis.grossMarginPct}%`}
        hint={kpis.totalIncome === 0 ? 'Sin ingresos' : 'de ingresos mes'}
        color={positive ? 'emerald' : 'red'}
        icon={<TrendingUp className="h-4 w-4" />}
      />
    </div>
  )
}

function KpiCard({
  label,
  value,
  hint,
  color,
  icon,
}: {
  label: string
  value: string
  hint: string
  color: 'slate' | 'emerald' | 'red'
  icon: React.ReactNode
}) {
  const colorMap = {
    slate: 'bg-slate-50 ring-slate-200 text-slate-700',
    emerald: 'bg-emerald-50 ring-emerald-200 text-emerald-700',
    red: 'bg-red-50 ring-red-200 text-red-700',
  }
  return (
    <div className={`rounded-lg ring-1 px-4 py-3 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 text-xs font-medium opacity-80">
        {icon}
        {label}
      </div>
      <div className="text-xl font-bold mt-1">{value}</div>
      <div className="text-[11px] opacity-70 mt-0.5">{hint}</div>
    </div>
  )
}

// ============================================================================
// NewExpenseModal
// ============================================================================

function NewExpenseModal(props: {
  onClose: () => void
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
  pending: boolean
  startTransition: React.TransitionStartFunction
}) {
  const { onClose, onSuccess, onError, pending, startTransition } = props
  const [category, setCategory] = useState<ExpenseCategory>('material')
  const [supplier, setSupplier] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [taxAmount, setTaxAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10))
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    const amountNum = parseFloat(amount)
    const taxNum = taxAmount ? parseFloat(taxAmount) : 0
    if (!description.trim()) return onError('Descripción es obligatoria')
    if (isNaN(amountNum) || amountNum < 0) return onError('Importe inválido')
    if (isNaN(taxNum) || taxNum < 0) return onError('IVA inválido')

    startTransition(async () => {
      // 1. Crear gasto sin invoice_url (primero obtener ID)
      const res = await createExpenseAction({
        category,
        description: description.trim(),
        amount: amountNum,
        taxAmount: taxNum,
        expenseDate,
        supplier: supplier.trim() || null,
        invoiceNumber: invoiceNumber.trim() || null,
        notes: notes.trim() || null,
      })
      if (!res.ok) return onError(res.error)

      // 2. Si hay archivo, upload + link (best-effort)
      if (file) {
        const uploadRes = await createInvoiceUploadUrlAction(res.data!.id, file.name)
        if (uploadRes.ok) {
          try {
            const uploadResp = await fetch(uploadRes.signedUrl, {
              method: 'PUT',
              body: file,
              headers: { 'Content-Type': file.type },
            })
            if (uploadResp.ok) {
              // Actualizar invoice_url (no critical)
              const { updateExpenseAction } = await import('./actions')
              await updateExpenseAction({ id: res.data!.id, invoiceUrl: uploadRes.uploadPath })
            }
          } catch {
            // Ignorar error de upload — el gasto ya se creó
          }
        }
      }

      onSuccess('Gasto registrado correctamente')
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-bold text-slate-900">Nuevo gasto</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Categoría *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
              >
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Fecha *</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Proveedor</label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Ej: Decathlon España, Endesa..."
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Descripción *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Compra de balones medicinales 3kg"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Importe € *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="120.00"
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">IVA €</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
                placeholder="25.20"
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Nº factura</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="FAC-2026-0042"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Factura adjunta (PDF/imagen, máx 10 MB)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-xs"
            />
            {file && (
              <p className="mt-1 text-[11px] text-slate-500">
                {file.name} ({(file.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm resize-none"
              placeholder="Opcional"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button onClick={onClose} disabled={pending} className="rounded-md border border-slate-200 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={pending || !description.trim() || !amount}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Registrar gasto
          </button>
        </div>
      </div>
    </div>
  )
}
