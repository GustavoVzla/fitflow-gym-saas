'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Link2,
  Loader2,
  Mail,
  Shield,
  Trash2,
  UserCog,
  X,
  UserX,
} from 'lucide-react'
import { ROLE_LABELS, type AdminGymUser } from '../../types'
import {
  resetUserPasswordAction,
  removeGymUserAction,
  transferOwnershipAction,
  type ResetPasswordResult,
} from './actions'

type Props = {
  gymId: string
  gymName: string
  users: AdminGymUser[]
}

export default function GymUsersPanel({ gymId, gymName, users }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Modal states
  const [resetUser, setResetUser] = useState<AdminGymUser | null>(null)
  const [resetResult, setResetResult] = useState<ResetPasswordResult | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [removeUser, setRemoveUser] = useState<AdminGymUser | null>(null)
  const [transferUser, setTransferUser] = useState<AdminGymUser | null>(null)

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  const onResetPassword = (mode: 'temporary' | 'magic_link') => {
    if (!resetUser) return
    setError(null)
    setResetResult(null)
    startTransition(async () => {
      const res = await resetUserPasswordAction(resetUser.userId, mode, gymId)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setResetResult(res)
      router.refresh()
    })
  }

  const onRemoveUser = () => {
    if (!removeUser) return
    setError(null)
    startTransition(async () => {
      const res = await removeGymUserAction(removeUser.gymUserId, gymId)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setRemoveUser(null)
      setSuccessMsg(`Usuario ${removeUser.email} desactivado`)
      setTimeout(() => setSuccessMsg(null), 3500)
      router.refresh()
    })
  }

  const onTransferOwnership = () => {
    if (!transferUser) return
    setError(null)
    startTransition(async () => {
      const res = await transferOwnershipAction(gymId, transferUser.userId)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setTransferUser(null)
      setSuccessMsg(`Ownership transferido a ${transferUser.email}`)
      setTimeout(() => setSuccessMsg(null), 3500)
      router.refresh()
    })
  }

  const closeResetModal = () => {
    setResetUser(null)
    setResetResult(null)
    setError(null)
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Shield className="h-4 w-4 text-slate-500" />
          Usuarios del gym ({users.length})
        </h3>
      </div>

      {successMsg && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 ring-1 ring-emerald-200">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {users.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No hay usuarios asociados a este gym.</p>
      ) : (
        <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-100">
          {users.map((u) => {
            const roleStyle = ROLE_LABELS[u.role] ?? ROLE_LABELS.staff
            const canTransfer = u.role !== 'owner' && u.isActive
            const canRemove = u.role !== 'owner' && u.isActive
            return (
              <div
                key={u.gymUserId}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${
                  !u.isActive ? 'bg-slate-50/80' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-800">{u.fullName}</p>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${roleStyle.color}`}
                    >
                      {roleStyle.label}
                    </span>
                    {!u.isActive && (
                      <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        Inactivo
                      </span>
                    )}
                    {u.mustChangePassword && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                        <KeyRound className="h-2.5 w-2.5" />
                        Cambio pendiente
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{u.email}</p>
                  {u.lastSignInAt && (
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Último acceso: {new Date(u.lastSignInAt).toLocaleDateString('es-ES')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setResetUser(u)}
                    disabled={isPending || !u.isActive}
                    title="Resetear password"
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </button>
                  {canTransfer && (
                    <button
                      type="button"
                      onClick={() => setTransferUser(u)}
                      disabled={isPending}
                      title="Transferir ownership a este usuario"
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <UserCog className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => setRemoveUser(u)}
                      disabled={isPending}
                      title="Desactivar usuario"
                      className="rounded-lg border border-red-200 bg-white px-2 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      <UserX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ===== Reset password modal ===== */}
      {resetUser && (
        <Modal title={`Reset password · ${resetUser.email}`} onClose={closeResetModal}>
          {error && !resetResult && (
            <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {resetResult?.ok && resetResult.mode === 'temporary' && (
            <div className="space-y-3 rounded-lg bg-emerald-50 p-4 ring-1 ring-emerald-200">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    Password temporal generada
                  </p>
                  <p className="text-xs text-emerald-700">
                    Se la compartes al cliente por WhatsApp/email. Tendrá que cambiarla al iniciar
                    sesión. <strong>No podrás volver a verla.</strong>
                  </p>
                </div>
              </div>
              <CopyField
                label="Email"
                value={resetResult.email}
                onCopy={() => copy('email', resetResult.email)}
                copied={copied === 'email'}
              />
              <CopyField
                label="Password temporal"
                value={resetResult.tempPassword}
                mono
                onCopy={() => copy('password', resetResult.tempPassword)}
                copied={copied === 'password'}
              />
              <CopyField
                label="URL de acceso"
                value={resetResult.loginUrl}
                onCopy={() => copy('url', resetResult.loginUrl)}
                copied={copied === 'url'}
              />
            </div>
          )}

          {resetResult?.ok && resetResult.mode === 'magic_link' && (
            <div className="space-y-2 rounded-lg bg-emerald-50 p-4 ring-1 ring-emerald-200">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    Magic link enviado por email
                  </p>
                  <p className="text-xs text-emerald-700">
                    Supabase ha enviado un correo a <strong>{resetResult.email}</strong> con un
                    enlace de recuperación válido durante 1 hora. El usuario podrá definir una
                    nueva password directamente desde ese link.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!resetResult && (
            <>
              <p className="text-xs text-slate-500">
                Elige un modo. Ambos quedan registrados en el audit log.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => onResetPassword('temporary')}
                  disabled={isPending}
                  className="flex flex-col items-start gap-2 rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-[#3b8bea] hover:bg-blue-50/50 disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <KeyRound className="h-4 w-4 text-[#3b8bea]" />
                    Password temporal
                  </div>
                  <p className="text-xs text-slate-500">
                    Genera una password aleatoria visible 1 vez para que se la envíes por WhatsApp
                    o email manual. Ideal para cliente offline.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onResetPassword('magic_link')}
                  disabled={isPending}
                  className="flex flex-col items-start gap-2 rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-[#3b8bea] hover:bg-blue-50/50 disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Link2 className="h-4 w-4 text-[#3b8bea]" />
                    Magic link por email
                  </div>
                  <p className="text-xs text-slate-500">
                    Envía un enlace de recuperación al email del usuario. Self-service, sin tu
                    intervención. Válido 1 hora.
                  </p>
                </button>
              </div>
              {isPending && (
                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Procesando...
                </div>
              )}
            </>
          )}

          <div className="mt-5 flex items-center justify-end">
            <button
              type="button"
              onClick={closeResetModal}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {resetResult ? 'Cerrar' : 'Cancelar'}
            </button>
          </div>
        </Modal>
      )}

      {/* ===== Remove user modal ===== */}
      {removeUser && (
        <Modal title={`Desactivar usuario · ${removeUser.email}`} onClose={() => setRemoveUser(null)}>
          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              El usuario no perderá sus datos pero ya no podrá acceder al gym <strong>{gymName}</strong>.
              Puedes reactivarlo más tarde añadiéndolo de nuevo.
            </span>
          </div>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setRemoveUser(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={onRemoveUser}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Trash2 className="h-4 w-4" />
              Desactivar
            </button>
          </div>
        </Modal>
      )}

      {/* ===== Transfer ownership modal ===== */}
      {transferUser && (
        <Modal title="Transferir ownership" onClose={() => setTransferUser(null)}>
          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              <p className="font-semibold">Acción importante.</p>
              <p className="mt-1">
                El owner actual pasará a <strong>admin</strong>. El usuario <strong>{transferUser.email}</strong>{' '}
                será el nuevo owner y podrá gestionar billing + eliminar usuarios sin tu intervención.
              </p>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setTransferUser(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={onTransferOwnership}
              className="inline-flex items-center gap-2 rounded-lg bg-[#3b8bea] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a6fc7] disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <UserCog className="h-4 w-4" />
              Confirmar transferencia
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
      <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h4 className="truncate text-sm font-semibold text-slate-900">{title}</h4>
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

function CopyField({
  label,
  value,
  mono = false,
  copied,
  onCopy,
}: {
  label: string
  value: string
  mono?: boolean
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-emerald-100 py-2 last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">{label}</p>
        <p className={`truncate text-sm text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  )
}
