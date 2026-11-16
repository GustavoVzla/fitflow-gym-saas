import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Building2, Mail, Calendar, Users, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  getAdminGymDetail,
  getAdminGymUsers,
  getAdminAuditLog,
  formatDate,
  PLAN_LABELS,
  STATUS_LABELS,
  PAYMENT_MODE_LABELS,
} from '../../data'
import GymActionsPanel from './GymActionsPanel'
import GymUsersPanel from './GymUsersPanel'
import AuditLogPanel from './AuditLogPanel'

export default async function AdminGymDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [gym, users, auditEntries] = await Promise.all([
    getAdminGymDetail(id),
    getAdminGymUsers(id),
    getAdminAuditLog(id, 15),
  ])

  if (!gym) notFound()

  const plan = PLAN_LABELS[gym.plan] ?? {
    label: gym.plan,
    color: 'bg-slate-100 text-slate-700 ring-slate-200',
  }
  const status = STATUS_LABELS[gym.status] ?? {
    label: gym.status,
    color: 'bg-slate-100 text-slate-700 ring-slate-200',
  }
  const paymentMode = PAYMENT_MODE_LABELS[gym.paymentMode] ?? {
    label: gym.paymentMode,
    color: 'bg-slate-100 text-slate-700 ring-slate-200',
    hint: '',
  }
  const stripeConfigured = gym.paymentMode === 'direct_keys' && gym.stripeOnboardedAt !== null

  return (
    <div className="space-y-6">
      <Link
        href="/admin/gyms"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a clientes
      </Link>

      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 ring-1 ring-slate-200">
              <Building2 className="h-7 w-7 text-slate-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">{gym.name}</h2>
              <p className="text-sm text-slate-500">{gym.slug}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${plan.color}`}
                >
                  {plan.label}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${status.color}`}
                >
                  {status.label}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${paymentMode.color}`}
                >
                  <CreditCard className="h-3 w-3" />
                  {paymentMode.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Owner</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-slate-700">
              <Mail className="h-4 w-4 text-slate-400" />
              {gym.ownerEmail ?? <span className="text-slate-400">—</span>}
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <Calendar className="h-4 w-4 text-slate-400" />
              Alta: {formatDate(gym.createdAt)}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Socios</h3>
          <div className="mt-3 flex items-baseline gap-2">
            <Users className="h-5 w-5 text-slate-400" />
            <span className="text-3xl font-bold text-slate-900">{gym.activeMembersCount}</span>
            <span className="text-sm text-slate-500">activos</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {gym.membersCount} totales (incluye inactivos y baja)
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CreditCard className="h-4 w-4 text-slate-500" />
            Configuración de pagos
          </h3>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${paymentMode.color}`}
          >
            {paymentMode.label}
          </span>
        </div>
        <p className="text-xs text-slate-500">{paymentMode.hint}</p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Estado Stripe
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-slate-900">
              {gym.paymentMode === 'manual' ? (
                <span className="text-slate-600">No aplica</span>
              ) : stripeConfigured ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-700">Configurado</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-amber-700">Pendiente</span>
                </>
              )}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Comisión SEPA
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{gym.feePercentSepa}%</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Comisión tarjeta
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{gym.feePercentCard}%</p>
          </div>
        </div>

        {gym.stripeOnboardedAt && (
          <p className="mt-3 text-[11px] text-slate-400">
            Stripe configurado el {formatDate(gym.stripeOnboardedAt)}
          </p>
        )}
      </div>

      <GymActionsPanel gym={gym} />

      <GymUsersPanel gymId={gym.id} gymName={gym.name} users={users} />

      <AuditLogPanel entries={auditEntries} />
    </div>
  )
}
