'use client'

import { useMemo, useState, useTransition } from 'react'
import Papa from 'papaparse'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Download,
  Loader2,
} from 'lucide-react'
import {
  validateCsvAction,
  executeImportAction,
  type ColumnMapping,
  type CsvRow,
  type ImportJobResult,
  type ImportRowError,
  type MemberField,
  type ValidationResult,
} from './actions'
import {
  autoDetectMapping,
  checkRequiredSatisfied,
  MEMBER_FIELD_OPTIONS,
  suggestMapping,
} from './heuristics'

type Step = 'upload' | 'mapping' | 'dryrun' | 'report'

interface Props {
  gymId: string
  gymName: string
}

export default function ImportCsvClient({ gymId, gymName }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [filename, setFilename] = useState<string>('')
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [job, setJob] = useState<ImportJobResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // ====================================================================
  // STEP 1: upload
  // ====================================================================
  const onFile = (file: File) => {
    setError(null)
    setFilename(file.name)
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      // Auto-detecta `,` / `;` / tab / pipe. Crítico para exports LegacyGym que usan `;`.
      delimiter: '',
      // Strip BOM UTF-8 + trim whitespace en headers
      transformHeader: (h) => h.replace(/^﻿/, '').trim().replace(/^"|"$/g, ''),
      complete: (result) => {
        if (result.errors && result.errors.length > 0) {
          setError(`CSV inválido: ${result.errors[0].message}`)
          return
        }
        const cols = result.meta.fields ?? []
        if (cols.length === 0) {
          setError('CSV sin headers. Asegúrate que la primera fila son los nombres de columna.')
          return
        }
        setCsvColumns(cols)
        setCsvRows(result.data)
        setMapping(autoDetectMapping(cols))
        setStep('mapping')
      },
      error: (err) => setError(`Error parseando CSV: ${err.message}`),
    })
  }

  // ====================================================================
  // STEP 2: mapping
  // ====================================================================
  const mappingConflicts = useMemo(() => {
    const fieldCounts = new Map<MemberField, number>()
    for (const field of Object.values(mapping)) {
      if (field === 'ignore') continue
      fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1)
    }
    const conflicts = new Set<MemberField>()
    for (const [field, count] of fieldCounts) {
      if (count > 1) conflicts.add(field)
    }
    return conflicts
  }, [mapping])

  const missingRequired = useMemo(() => checkRequiredSatisfied(mapping), [mapping])

  const canContinueMapping = mappingConflicts.size === 0 && missingRequired.length === 0

  const ignoredColumns = useMemo(
    () => csvColumns.filter((c) => mapping[c] === 'ignore'),
    [csvColumns, mapping]
  )

  const onValidate = () => {
    setError(null)
    startTransition(async () => {
      const result = await validateCsvAction(gymId, csvRows, mapping)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setValidation(result)
      setStep('dryrun')
    })
  }

  // ====================================================================
  // STEP 3: dry-run (revisar errores + confirmar)
  // ====================================================================
  const onExecute = () => {
    if (!validation) return
    setError(null)
    startTransition(async () => {
      const result = await executeImportAction(gymId, filename, mapping, validation.validRows)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setJob(result.job)
      setStep('report')
      // Next.js cache ya se revalida en la action
    })
  }

  // ====================================================================
  // STEP 4: report
  // ====================================================================
  const restart = () => {
    setStep('upload')
    setFilename('')
    setCsvColumns([])
    setCsvRows([])
    setMapping({})
    setValidation(null)
    setJob(null)
    setError(null)
  }

  // ====================================================================
  // RENDER
  // ====================================================================

  return (
    <div className="space-y-6">
      <StepIndicator step={step} />

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5" />
          <div className="text-sm text-red-900">
            <div className="font-semibold mb-0.5">Error</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {step === 'upload' && <UploadStep onFile={onFile} gymName={gymName} />}

      {step === 'mapping' && (
        <MappingStep
          csvColumns={csvColumns}
          csvRows={csvRows}
          mapping={mapping}
          setMapping={setMapping}
          conflicts={mappingConflicts}
          missingRequired={missingRequired}
          canContinue={canContinueMapping}
          ignoredColumns={ignoredColumns}
          filename={filename}
          onBack={() => setStep('upload')}
          onContinue={onValidate}
          pending={pending}
        />
      )}

      {step === 'dryrun' && validation && (
        <DryRunStep
          validation={validation}
          ignoredColumns={ignoredColumns}
          onBack={() => setStep('mapping')}
          onExecute={onExecute}
          pending={pending}
        />
      )}

      {step === 'report' && job && (
        <ReportStep
          job={job}
          ignoredColumns={ignoredColumns}
          gymId={gymId}
          onRestart={restart}
          onGoToMembers={() => router.push(`/admin/gyms/${gymId}`)}
        />
      )}
    </div>
  )
}

// ========================================================================
// StepIndicator
// ========================================================================
function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'upload', label: '1. Subir CSV' },
    { key: 'mapping', label: '2. Mapear columnas' },
    { key: 'dryrun', label: '3. Validar' },
    { key: 'report', label: '4. Reporte' },
  ]
  const currentIdx = steps.findIndex((s) => s.key === step)
  return (
    <div className="flex items-center gap-2 text-xs font-semibold">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ring-1 ${
              i < currentIdx
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : i === currentIdx
                ? 'bg-indigo-50 text-indigo-700 ring-indigo-200'
                : 'bg-slate-50 text-slate-500 ring-slate-200'
            }`}
          >
            {i < currentIdx && <CheckCircle2 className="h-3.5 w-3.5" />}
            {s.label}
          </div>
          {i < steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-slate-300" />}
        </div>
      ))}
    </div>
  )
}

// ========================================================================
// Step 1: Upload
// ========================================================================
function UploadStep({ onFile, gymName }: { onFile: (f: File) => void; gymName: string }) {
  const [dragOver, setDragOver] = useState(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Sube el archivo CSV</h2>
        <p className="mt-1 text-sm text-slate-600">
          Importando socios para <strong>{gymName}</strong>. Soportado: CSV UTF-8 con headers en la primera fila. Máx 2000 filas por import.
        </p>
      </div>
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 cursor-pointer transition ${
          dragOver
            ? 'border-indigo-400 bg-indigo-50/50'
            : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
        }`}
      >
        <UploadCloud className="h-10 w-10 text-slate-400" />
        <div className="text-center">
          <div className="text-sm font-semibold text-slate-900">Arrastra un CSV o haz clic</div>
          <div className="text-xs text-slate-500 mt-0.5">CSV · UTF-8 · primera fila son los headers</div>
        </div>
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
          }}
        />
      </label>

      <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 space-y-1">
        <div className="font-semibold">¿Cómo exportar desde LegacyGym?</div>
        <ol className="list-decimal ml-4 space-y-0.5">
          <li>Login en el panel LegacyGym → Configuración → Tab &ldquo;Cuenta&rdquo;</li>
          <li>Click en &ldquo;Exportar datos completos&rdquo; (RGPD Art. 20)</li>
          <li>Extrae el ZIP y usa el CSV de socios/clientes</li>
          <li>Abre el CSV en Excel/Numbers y guarda como <code>UTF-8</code></li>
        </ol>
      </div>
    </div>
  )
}

// ========================================================================
// Step 2: Mapping
// ========================================================================
function MappingStep(props: {
  csvColumns: string[]
  csvRows: CsvRow[]
  mapping: ColumnMapping
  setMapping: (m: ColumnMapping) => void
  conflicts: Set<MemberField>
  missingRequired: MemberField[]
  canContinue: boolean
  ignoredColumns: string[]
  filename: string
  onBack: () => void
  onContinue: () => void
  pending: boolean
}) {
  const {
    csvColumns,
    csvRows,
    mapping,
    setMapping,
    conflicts,
    missingRequired,
    canContinue,
    filename,
    onBack,
    onContinue,
    pending,
  } = props
  const preview = csvRows.slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <FileSpreadsheet className="h-4 w-4 text-slate-400" />
            <span className="font-mono text-xs">{filename}</span>
            <span className="text-slate-400">·</span>
            <span>{csvRows.length} filas · {csvColumns.length} columnas</span>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            Cambiar archivo
          </button>
        </div>

        <h2 className="text-base font-semibold text-slate-900 mb-1">Mapea cada columna CSV a un campo de FitFlow</h2>
        <p className="text-sm text-slate-600 mb-4">
          Auto-detectamos las columnas más comunes. Revisa y ajusta si hace falta. <strong>Nombre</strong> y <strong>Apellidos</strong> son obligatorios.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="text-left py-2 pr-4">Columna CSV</th>
                <th className="text-left py-2 pr-4">Campo FitFlow</th>
                <th className="text-left py-2">Auto-detección</th>
              </tr>
            </thead>
            <tbody>
              {csvColumns.map((col) => {
                const current = mapping[col] ?? 'ignore'
                const suggested = suggestMapping(col)
                const isAutoDetected = suggested !== 'ignore' && current === suggested
                const isConflict = current !== 'ignore' && conflicts.has(current)
                return (
                  <tr key={col} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs text-slate-700">{col}</td>
                    <td className="py-2 pr-4">
                      <select
                        value={current}
                        onChange={(e) =>
                          setMapping({ ...mapping, [col]: e.target.value as MemberField })
                        }
                        className={`w-full rounded-md border px-2 py-1.5 text-xs font-medium ${
                          isConflict
                            ? 'border-red-300 bg-red-50 text-red-900'
                            : current === 'ignore'
                            ? 'border-slate-200 bg-slate-50 text-slate-500'
                            : 'border-slate-300 bg-white text-slate-900'
                        }`}
                      >
                        {MEMBER_FIELD_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                            {opt.required ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2">
                      {isConflict ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full ring-1 ring-red-200">
                          <AlertCircle className="h-3 w-3" /> Conflicto
                        </span>
                      ) : isAutoDetected ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full ring-1 ring-emerald-200">
                          <CheckCircle2 className="h-3 w-3" /> Auto-detectado
                        </span>
                      ) : current === 'ignore' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ring-1 ring-amber-200">
                          <AlertTriangle className="h-3 w-3" /> Sin detectar
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full ring-1 ring-slate-200">
                          Manual
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {conflicts.size > 0 && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900">
            <div className="font-semibold mb-0.5">Conflicto de mapping</div>
            <div>
              {Array.from(conflicts).map((f) => {
                const label = MEMBER_FIELD_OPTIONS.find((o) => o.value === f)?.label ?? f
                return (
                  <span key={f} className="font-mono">
                    {label}
                  </span>
                )
              })}{' '}
              está asignado a más de una columna CSV. Cambia una a &ldquo;— Ignorar —&rdquo; o a otro campo.
            </div>
          </div>
        )}

        {missingRequired.length > 0 && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="font-semibold mb-0.5">Faltan campos obligatorios</div>
            <div>
              Asigna:{' '}
              {missingRequired
                .map((f) => MEMBER_FIELD_OPTIONS.find((o) => o.value === f)?.label ?? f)
                .join(', ')}
              .
            </div>
          </div>
        )}
      </div>

      {/* Preview data */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Preview · primeras {preview.length} filas
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[11px] font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                {csvColumns.map((c) => (
                  <th key={c} className="text-left py-1.5 pr-3 whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {preview.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  {csvColumns.map((c) => (
                    <td key={c} className="py-1.5 pr-3 whitespace-nowrap font-mono">
                      {row[c] || <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue || pending}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-md hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              Continuar al dry-run
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ========================================================================
// Step 3: Dry-run
// ========================================================================
function DryRunStep(props: {
  validation: ValidationResult
  ignoredColumns: string[]
  onBack: () => void
  onExecute: () => void
  pending: boolean
}) {
  const { validation, onBack, onExecute, pending } = props
  const { validRows, errors, duplicatesInternal, duplicatesExisting, totalInput } = validation
  const canExecute = validRows.length > 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Total filas" value={totalInput} color="slate" />
        <KPI label="Válidas" value={validRows.length} color="emerald" />
        <KPI label="Con errores" value={errors.length} color="red" />
        <KPI label="Duplicados" value={duplicatesInternal + duplicatesExisting} color="amber" />
      </div>

      {errors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-red-200 bg-red-50">
            <div className="text-sm font-semibold text-red-900">
              {errors.length} {errors.length === 1 ? 'fila con error' : 'filas con errores'}
            </div>
            <div className="text-xs text-red-700 mt-0.5">
              Estas filas <strong>no se importarán</strong>. Corrige el CSV y vuelve a subirlo si quieres incluirlas.
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                <tr>
                  <th className="text-left py-2 px-4">Fila</th>
                  <th className="text-left py-2 px-4">Campo</th>
                  <th className="text-left py-2 px-4">Motivo</th>
                  <th className="text-left py-2 px-4">Valor</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((e, i) => (
                  <ErrorRow key={i} error={e} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {duplicatesExisting > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="font-semibold mb-0.5">
            {duplicatesExisting} {duplicatesExisting === 1 ? 'email ya existía' : 'emails ya existían'} en este gym
          </div>
          <div>Los saltamos para no duplicar socios. Si quieres actualizarlos, usa el editor de ficha individual.</div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al mapping
        </button>
        <button
          type="button"
          onClick={onExecute}
          disabled={!canExecute || pending}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Importando...
            </>
          ) : (
            <>
              Importar {validRows.length} {validRows.length === 1 ? 'socio' : 'socios'}
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function ErrorRow({ error }: { error: ImportRowError }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-1.5 px-4 font-mono text-slate-700">
        {error.row > 0 ? `#${error.row}` : '—'}
      </td>
      <td className="py-1.5 px-4 font-mono text-slate-600">{error.field ?? '—'}</td>
      <td className="py-1.5 px-4 text-slate-700">{error.reason}</td>
      <td className="py-1.5 px-4 font-mono text-slate-400 truncate max-w-[240px]">
        {error.value != null ? String(error.value) : '—'}
      </td>
    </tr>
  )
}

function KPI({ label, value, color }: { label: string; value: number; color: 'slate' | 'emerald' | 'red' | 'amber' }) {
  const colorMap = {
    slate: 'bg-slate-50 ring-slate-200 text-slate-700',
    emerald: 'bg-emerald-50 ring-emerald-200 text-emerald-700',
    red: 'bg-red-50 ring-red-200 text-red-700',
    amber: 'bg-amber-50 ring-amber-200 text-amber-700',
  }
  return (
    <div className={`rounded-lg ring-1 px-4 py-3 ${colorMap[color]}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-0.5">{value}</div>
    </div>
  )
}

// ========================================================================
// Step 4: Report
// ========================================================================
function ReportStep(props: {
  job: ImportJobResult
  ignoredColumns: string[]
  gymId: string
  onRestart: () => void
  onGoToMembers: () => void
}) {
  const { job, ignoredColumns, onRestart, onGoToMembers } = props
  const success = job.status === 'completed'

  const downloadErrors = () => {
    if (job.errors.length === 0) return
    const csv = [
      ['row', 'field', 'reason', 'value'].join(','),
      ...job.errors.map((e) =>
        [e.row, e.field ?? '', (e.reason ?? '').replace(/"/g, '""'), String(e.value ?? '').replace(/"/g, '""')]
          .map((v) => `"${v}"`)
          .join(',')
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `import_errors_${job.id.slice(0, 8)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div
        className={`rounded-xl border p-6 ${
          success ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'
        }`}
      >
        <div className="flex items-start gap-3">
          {success ? (
            <CheckCircle2 className="h-8 w-8 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-8 w-8 text-amber-600 flex-shrink-0" />
          )}
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {success
                ? `Importación completada · ${job.rowsOk} socios añadidos`
                : `Importación con errores · ${job.rowsOk} de ${job.rowsTotal} OK`}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {job.filename && (
                <>
                  Archivo: <span className="font-mono">{job.filename}</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KPI label="Total procesadas" value={job.rowsTotal} color="slate" />
        <KPI label="Insertadas OK" value={job.rowsOk} color="emerald" />
        <KPI label="Rechazadas" value={job.rowsErr} color="red" />
      </div>

      {ignoredColumns.length > 0 && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <div className="font-semibold mb-1">
            {ignoredColumns.length} {ignoredColumns.length === 1 ? 'columna ignorada' : 'columnas ignoradas'}
          </div>
          <div className="font-mono text-slate-500">{ignoredColumns.join(', ')}</div>
        </div>
      )}

      {job.errors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-red-200 bg-red-50">
            <div className="text-sm font-semibold text-red-900">
              {job.errors.length} {job.errors.length === 1 ? 'fila rechazada' : 'filas rechazadas'}
            </div>
            <button
              type="button"
              onClick={downloadErrors}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:text-red-900"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar errores CSV
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                <tr>
                  <th className="text-left py-2 px-4">Fila</th>
                  <th className="text-left py-2 px-4">Motivo</th>
                  <th className="text-left py-2 px-4">SQLSTATE</th>
                </tr>
              </thead>
              <tbody>
                {job.errors.map((e, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 px-4 font-mono text-slate-700">{e.row > 0 ? `#${e.row}` : '—'}</td>
                    <td className="py-1.5 px-4 text-slate-700">{e.reason}</td>
                    <td className="py-1.5 px-4 font-mono text-[10px] text-slate-400">
                      {(e as ImportRowError & { sqlstate?: string }).sqlstate ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          Importar otro CSV
        </button>
        <Link
          href={`/admin/gyms/${props.gymId}`}
          onClick={onGoToMembers}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-md hover:bg-indigo-500"
        >
          Volver al detalle del gym
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
