import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, History } from 'lucide-react'
import { getAdminGymDetail } from '../../../data'
import { listImportJobsAction } from './actions'
import ImportCsvClient from './ImportCsvClient'

export default async function AdminGymImportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [gym, jobs] = await Promise.all([getAdminGymDetail(id), listImportJobsAction(id)])

  if (!gym) notFound()

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/gyms/${id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver al detalle de {gym.name}
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-slate-900">Importar socios desde CSV</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sube un CSV (p.ej. export RGPD de LegacyGym) y los mapea a campos de FitFlow. El super-admin ve un preview + dry-run antes de ejecutar.
        </p>
      </div>

      <ImportCsvClient gymId={id} gymName={gym.name} />

      {jobs.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">Historial de imports</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[11px] font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="text-left py-2 px-4">Fecha</th>
                  <th className="text-left py-2 px-4">Archivo</th>
                  <th className="text-left py-2 px-4">Estado</th>
                  <th className="text-right py-2 px-4">Total</th>
                  <th className="text-right py-2 px-4">OK</th>
                  <th className="text-right py-2 px-4">Errores</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 px-4 text-slate-600 whitespace-nowrap">
                      {new Date(job.createdAt).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2 px-4 font-mono text-slate-700 truncate max-w-[200px]">
                      {job.filename ?? '—'}
                    </td>
                    <td className="py-2 px-4">
                      <JobStatusBadge status={job.status} />
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-slate-700">{job.rowsTotal}</td>
                    <td className="py-2 px-4 text-right font-mono text-emerald-700">{job.rowsOk}</td>
                    <td className="py-2 px-4 text-right font-mono text-red-700">{job.rowsErr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function JobStatusBadge({ status }: { status: 'pending' | 'dry_run_ok' | 'completed' | 'failed' }) {
  const map = {
    pending: { label: 'Pendiente', color: 'bg-slate-100 text-slate-700 ring-slate-200' },
    dry_run_ok: { label: 'Validado', color: 'bg-indigo-100 text-indigo-700 ring-indigo-200' },
    completed: { label: 'Completado', color: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
    failed: { label: 'Parcial/Fallido', color: 'bg-amber-100 text-amber-700 ring-amber-200' },
  } as const
  const s = map[status]
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${s.color}`}>
      {s.label}
    </span>
  )
}
