import Link from 'next/link'
import { Plus, Building2, Archive } from 'lucide-react'
import { getAdminGyms, formatDate, PLAN_LABELS, STATUS_LABELS } from '../data'

type SearchParams = Promise<{ filter?: string }>

export default async function AdminGymsPage({ searchParams }: { searchParams: SearchParams }) {
  const { filter } = await searchParams
  const showDeleted = filter === 'deleted'

  // When showDeleted=true, fetch all (including deleted) and filter to only deleted.
  // When showDeleted=false, fetch only active (default).
  const allGyms = await getAdminGyms(showDeleted)
  const gyms = showDeleted ? allGyms.filter((g) => g.deletedAt !== null) : allGyms

  // Also fetch count of deleted gyms for the tab badge (lightweight extra call)
  const deletedCount = showDeleted
    ? gyms.length
    : (await getAdminGyms(true)).filter((g) => g.deletedAt !== null).length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Clientes</h2>
          <p className="mt-1 text-sm text-slate-500">
            {showDeleted
              ? 'Gyms eliminados (se purgan automáticamente 30 días después).'
              : 'Todos los gyms registrados en la plataforma.'}
          </p>
        </div>
        <Link
          href="/admin/new-gym"
          className="inline-flex items-center gap-2 rounded-lg bg-[#3b8bea] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a6fc7]"
        >
          <Plus className="h-4 w-4" />
          Nueva cuenta
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <Link
          href="/admin/gyms"
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
            !showDeleted
              ? 'border-[#3b8bea] text-[#3b8bea]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Activos
        </Link>
        <Link
          href="/admin/gyms?filter=deleted"
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
            showDeleted
              ? 'border-red-500 text-red-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Archive className="h-3.5 w-3.5" />
          Eliminados
          {deletedCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
              {deletedCount}
            </span>
          )}
        </Link>
      </div>

      {gyms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Building2 className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-800">
            {showDeleted ? 'No hay gyms eliminados' : 'Aún no hay clientes'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {showDeleted
              ? 'Los gyms eliminados aparecerán aquí hasta que se purguen (30 días).'
              : 'Crea la primera cuenta desde el botón superior.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Gym</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Socios</th>
                <th className="px-4 py-3">{showDeleted ? 'Eliminado' : 'Alta'}</th>
              </tr>
            </thead>
            <tbody>
              {gyms.map((g) => {
                const plan = PLAN_LABELS[g.plan] ?? {
                  label: g.plan,
                  color: 'bg-slate-100 text-slate-700 ring-slate-200',
                }
                const status = STATUS_LABELS[g.status] ?? {
                  label: g.status,
                  color: 'bg-slate-100 text-slate-700 ring-slate-200',
                }
                return (
                  <tr key={g.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/gyms/${g.id}`}
                        className="font-semibold text-slate-900 hover:text-[#3b8bea]"
                      >
                        {g.name}
                      </Link>
                      <p className="text-[11px] text-slate-400">{g.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {g.ownerEmail ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${plan.color}`}
                      >
                        {plan.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {g.activeMembersCount}
                      <span className="text-[11px] text-slate-400"> / {g.membersCount}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDate(showDeleted && g.deletedAt ? g.deletedAt : g.createdAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
