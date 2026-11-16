import Link from 'next/link'
import {
  Building2,
  Users,
  Wallet,
  Plus,
  Sparkles,
  ArrowRight,
  UserPlus,
} from 'lucide-react'
import {
  getAdminGyms,
  getAdminStats,
  formatCurrency,
  formatDate,
  PLAN_LABELS,
  STATUS_LABELS,
} from './data'

export default async function AdminHomePage() {
  const [stats, gyms] = await Promise.all([getAdminStats(), getAdminGyms()])

  const kpis = [
    {
      label: 'Gyms totales',
      value: stats.totalGyms.toLocaleString('es-ES'),
      sub: `${stats.activeGyms} activos`,
      icon: Building2,
      color: 'text-blue-600 bg-blue-50 ring-blue-100',
    },
    {
      label: 'Altas este mes',
      value: stats.newGymsThisMonth.toLocaleString('es-ES'),
      sub: 'nuevos gyms',
      icon: UserPlus,
      color: 'text-emerald-600 bg-emerald-50 ring-emerald-100',
    },
    {
      label: 'Socios totales',
      value: stats.totalMembers.toLocaleString('es-ES'),
      sub: `${stats.totalActiveMembers} activos`,
      icon: Users,
      color: 'text-violet-600 bg-violet-50 ring-violet-100',
    },
    {
      label: 'Ingresos del mes',
      value: formatCurrency(stats.revenueThisMonthCents),
      sub: 'sumado todos los gyms',
      icon: Wallet,
      color: 'text-amber-600 bg-amber-50 ring-amber-100',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
            <Sparkles className="h-3.5 w-3.5" />
            Panel super-admin
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            Backoffice FitFlow
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Administra todos los clientes de la plataforma desde un único sitio.
          </p>
        </div>
        <Link
          href="/admin/new-gym"
          className="inline-flex items-center gap-2 rounded-lg bg-[#3b8bea] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a6fc7]"
        >
          <Plus className="h-4 w-4" />
          Nueva cuenta de cliente
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <div
              key={k.label}
              className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
            >
              <div
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${k.color}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {k.label}
              </p>
              <p className="mt-1 text-xl font-bold text-slate-900">{k.value}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{k.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Gyms list */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Clientes ({gyms.length})
          </h3>
          <Link
            href="/admin/gyms"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#3b8bea] hover:text-[#2a6fc7]"
          >
            Ver todos
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {gyms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Building2 className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-800">
              Aún no hay clientes
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Crea la primera cuenta para que un cliente entre al sistema.
            </p>
            <Link
              href="/admin/new-gym"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#3b8bea] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2a6fc7]"
            >
              <Plus className="h-3.5 w-3.5" />
              Crear primer cliente
            </Link>
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
                  <th className="px-4 py-3">Alta</th>
                </tr>
              </thead>
              <tbody>
                {gyms.slice(0, 10).map((g) => {
                  const plan = PLAN_LABELS[g.plan] ?? {
                    label: g.plan,
                    color: 'bg-slate-100 text-slate-700 ring-slate-200',
                  }
                  const status = STATUS_LABELS[g.status] ?? {
                    label: g.status,
                    color: 'bg-slate-100 text-slate-700 ring-slate-200',
                  }
                  return (
                    <tr
                      key={g.id}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
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
                        {formatDate(g.createdAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
