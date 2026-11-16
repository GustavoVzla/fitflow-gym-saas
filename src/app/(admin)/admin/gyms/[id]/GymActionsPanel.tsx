'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Edit3,
  Loader2,
  Pencil,
  Trash2,
  Undo2,
  CreditCard,
  Crown,
  X,
  UploadCloud,
} from 'lucide-react'
import type { AdminGymDetail } from '../../types'
import {
  updateGymAction,
  changeGymPlanAction,
  changeGymPaymentModeAction,
  suspendGymAction,
  reactivateGymAction,
  softDeleteGymAction,
  restoreGymAction,
  type GymPlan,
  type PaymentMode,
} from './actions'

const PLAN_OPTIONS: Array<{ value: GymPlan; label: string; price: string }> = [
  { value: 'base', label: 'Base', price: '€99/mes' },
  { value: 'smart', label: 'Smart', price: '€149/mes' },
  { value: 'pro', label: 'Pro', price: '€199/mes' },
  { value: 'premium', label: 'Premium', price: '€249/mes' },
  { value: 'app_pro', label: 'App Pro', price: '€349/mes' },
  { value: 'enterprise', label: 'Enterprise', price: 'custom' },
]

const PAYMENT_MODE_OPTIONS: Array<{ value: PaymentMode; label: string; enabled: boolean; badge: string }> = [
  { value: 'manual', label: 'Manual', enabled: true, badge: 'Disponible' },
  { value: 'direct_keys', label: 'Direct Keys (Stripe)', enabled: true, badge: 'Disponible' },
  { value: 'connect_express', label: 'Connect Express', enabled: false, badge: 'Fase 2' },
  { value: 'connect_standard', label: 'Connect Standard', enabled: false, badge: 'Fase 3' },
  { value: 'managed', label: 'Managed', enabled: false, badge: 'Fase 4' },
]

type Props = { gym: AdminGymDetail }

export default function GymActionsPanel({ gym }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Modal states
  const [editOpen, setEditOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Form states
  const [form, setForm] = useState({
    name: gym.name,
    email: gym.email ?? '',
    phone: gym.phone ?? '',
    address: gym.address ?? '',
    city: gym.city ?? '',
    postalCode: gym.postalCode ?? '',
    country: gym.country ?? 'ES',
    taxId: gym.taxId ?? '',
    website: gym.website ?? '',
  })
  const [newPlan, setNewPlan] = useState<GymPlan>(gym.plan as GymPlan)
  const [newPaymentMode, setNewPaymentMode] = useState<PaymentMode>(gym.paymentMode as PaymentMode)
  const [suspendReason, setSuspendReason] = useState('')
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const isDeleted = !!gym.deletedAt
  const isSuspended = gym.status === 'suspended' && !isDeleted

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, closeModal?: () => void, successText?: string) => {
    setError(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        setError(res.error ?? 'Error desconocido')
        return
      }
      closeModal?.()
      if (successText) {
        setSuccessMsg(successText)
        setTimeout(() => setSuccessMsg(null), 3500)
      }
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Acciones</h3>
        {isDeleted && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">
            <AlertTriangle className="h-3 w-3" />
            Eliminado · se purga 30d
          </span>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 ring-1 ring-emerald-200">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {isDeleted ? (
          <button
            type="button"
            onClick={() =>
              run(() => restoreGymAction(gym.id), undefined, 'Gym restaurado correctamente')
            }
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 md:col-span-2"
          >
            <Undo2 className="h-4 w-4" />
            Restaurar cuenta
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <Pencil className="h-4 w-4" />
              Editar datos
            </button>
            <button
              type="button"
              onClick={() => setPlanOpen(true)}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <Crown className="h-4 w-4" />
              Cambiar plan
            </button>
            <button
              type="button"
              onClick={() => setPaymentOpen(true)}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <CreditCard className="h-4 w-4" />
              Cambiar modo de pago
            </button>
            {isSuspended ? (
              <button
                type="button"
                onClick={() =>
                  run(() => reactivateGymAction(gym.id), undefined, 'Gym reactivado')
                }
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Reactivar cuenta
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSuspendOpen(true)}
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
              >
                <Ban className="h-4 w-4" />
                Suspender cuenta
              </button>
            )}
            <Link
              href={`/admin/gyms/${gym.id}/import`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 md:col-span-2"
            >
              <UploadCloud className="h-4 w-4" />
              Importar socios desde CSV (LegacyGym export / archivo RGPD)
            </Link>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 md:col-span-2"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar cuenta (soft delete · 30d recuperable)
            </button>
          </>
        )}
      </div>

      {isSuspended && gym.suspendedReason && (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
          <span className="font-semibold">Motivo de suspensión:</span> {gym.suspendedReason}
        </div>
      )}

      {/* ===== Edit modal ===== */}
      {editOpen && (
        <Modal title="Editar datos del gym" onClose={() => setEditOpen(false)}>
          <div className="space-y-3">
            <Field label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Field label="Teléfono" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            </div>
            <Field label="Dirección" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Ciudad" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
              <Field label="Código postal" value={form.postalCode} onChange={(v) => setForm({ ...form, postalCode: v })} />
              <Field label="País" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="CIF / NIF" value={form.taxId} onChange={(v) => setForm({ ...form, taxId: v })} />
              <Field label="Web" value={form.website} onChange={(v) => setForm({ ...form, website: v })} />
            </div>
          </div>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isPending || !form.name.trim()}
              onClick={() =>
                run(
                  () =>
                    updateGymAction({
                      gymId: gym.id,
                      name: form.name.trim() || undefined,
                      email: form.email.trim() || undefined,
                      phone: form.phone.trim() || undefined,
                      address: form.address.trim() || undefined,
                      city: form.city.trim() || undefined,
                      postalCode: form.postalCode.trim() || undefined,
                      country: form.country.trim() || undefined,
                      taxId: form.taxId.trim() || undefined,
                      website: form.website.trim() || undefined,
                    }),
                  () => setEditOpen(false),
                  'Datos actualizados'
                )
              }
              className="inline-flex items-center gap-2 rounded-lg bg-[#3b8bea] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a6fc7] disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar cambios
            </button>
          </div>
        </Modal>
      )}

      {/* ===== Plan modal ===== */}
      {planOpen && (
        <Modal title="Cambiar plan" onClose={() => setPlanOpen(false)}>
          <p className="text-xs text-slate-500">
            Plan actual: <span className="font-semibold text-slate-700">{gym.plan}</span>
          </p>
          <div className="mt-3 space-y-2">
            {PLAN_OPTIONS.map((p) => (
              <label
                key={p.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  newPlan === p.value ? 'border-[#3b8bea] bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  checked={newPlan === p.value}
                  onChange={() => setNewPlan(p.value)}
                  className="h-4 w-4 text-[#3b8bea]"
                />
                <div className="flex flex-1 items-center justify-between">
                  <span className="font-semibold text-slate-800">{p.label}</span>
                  <span className="text-xs text-slate-500">{p.price}</span>
                </div>
              </label>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPlanOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isPending || newPlan === gym.plan}
              onClick={() =>
                run(
                  () => changeGymPlanAction(gym.id, newPlan),
                  () => setPlanOpen(false),
                  `Plan cambiado a ${newPlan}`
                )
              }
              className="inline-flex items-center gap-2 rounded-lg bg-[#3b8bea] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a6fc7] disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Cambiar plan
            </button>
          </div>
        </Modal>
      )}

      {/* ===== Payment mode modal ===== */}
      {paymentOpen && (
        <Modal title="Cambiar modo de pago" onClose={() => setPaymentOpen(false)}>
          <p className="text-xs text-slate-500">
            Modo actual: <span className="font-semibold text-slate-700">{gym.paymentMode}</span>
          </p>
          <div className="mt-3 space-y-2">
            {PAYMENT_MODE_OPTIONS.map((m) => (
              <label
                key={m.value}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                  !m.enabled
                    ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                    : newPaymentMode === m.value
                      ? 'cursor-pointer border-[#3b8bea] bg-blue-50'
                      : 'cursor-pointer border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  checked={newPaymentMode === m.value}
                  disabled={!m.enabled}
                  onChange={() => setNewPaymentMode(m.value)}
                  className="h-4 w-4 text-[#3b8bea]"
                />
                <div className="flex flex-1 items-center justify-between">
                  <span className="font-semibold text-slate-800">{m.label}</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                      m.enabled
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        : 'bg-slate-100 text-slate-500 ring-slate-200'
                    }`}
                  >
                    {m.badge}
                  </span>
                </div>
              </label>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPaymentOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isPending || newPaymentMode === gym.paymentMode}
              onClick={() =>
                run(
                  () => changeGymPaymentModeAction(gym.id, newPaymentMode),
                  () => setPaymentOpen(false),
                  `Modo cambiado a ${newPaymentMode}`
                )
              }
              className="inline-flex items-center gap-2 rounded-lg bg-[#3b8bea] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a6fc7] disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Cambiar modo
            </button>
          </div>
        </Modal>
      )}

      {/* ===== Suspend modal ===== */}
      {suspendOpen && (
        <Modal title="Suspender cuenta" onClose={() => setSuspendOpen(false)}>
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              El gym no podrá operar normalmente. Sus usuarios siguen con acceso pero verán el
              estado suspendido. Reversible sin pérdida de datos.
            </span>
          </div>
          <label className="mt-4 block text-xs font-semibold text-slate-700">
            Motivo de la suspensión
          </label>
          <textarea
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            rows={3}
            placeholder="Ej: impago de cuota mensual, pendiente de contacto con cliente..."
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
          />
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setSuspendOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isPending || suspendReason.trim().length < 3}
              onClick={() =>
                run(
                  () => suspendGymAction(gym.id, suspendReason),
                  () => {
                    setSuspendOpen(false)
                    setSuspendReason('')
                  },
                  'Cuenta suspendida'
                )
              }
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar suspensión
            </button>
          </div>
        </Modal>
      )}

      {/* ===== Delete modal ===== */}
      {deleteOpen && (
        <Modal title="Eliminar cuenta (soft delete)" onClose={() => setDeleteOpen(false)}>
          <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800 ring-1 ring-red-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              <p className="font-semibold">Acción reversible durante 30 días.</p>
              <p className="mt-1">
                El gym se marca como eliminado y sus usuarios son desactivados. Pasados 30 días se
                purgará definitivamente de la base de datos (cron diario 02:00 UTC).
              </p>
            </div>
          </div>
          <label className="mt-4 block text-xs font-semibold text-slate-700">
            Motivo (opcional)
          </label>
          <textarea
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            rows={2}
            placeholder="Cliente solicitó baja, duplicado, demo descartada..."
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
          />
          <label className="mt-3 block text-xs font-semibold text-slate-700">
            Para confirmar, escribe el nombre del gym: <span className="font-mono text-red-700">{gym.name}</span>
          </label>
          <input
            type="text"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
          />
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDeleteOpen(false)
                setDeleteConfirm('')
                setDeleteReason('')
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isPending || deleteConfirm !== gym.name}
              onClick={() =>
                run(
                  () => softDeleteGymAction(gym.id, deleteReason, deleteConfirm, gym.name),
                  () => {
                    setDeleteOpen(false)
                    setDeleteConfirm('')
                    setDeleteReason('')
                  },
                  'Gym eliminado (recuperable 30 días)'
                )
              }
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Eliminar cuenta
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ============================================================================
// Subcomponents
// ============================================================================

function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#3b8bea] focus:outline-none focus:ring-1 focus:ring-[#3b8bea]"
      />
    </div>
  )
}
