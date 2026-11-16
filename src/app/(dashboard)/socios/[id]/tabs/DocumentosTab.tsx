'use client'

import { useState, useTransition } from 'react'
import { Plus, X, FileText, CheckCircle2, Trash2, Pen } from 'lucide-react'
import {
  assignClauseToMemberAction,
  revokeMemberClauseAction,
  signMemberClauseAction,
} from '../actions'
import type { ClauseTemplateOption, MemberClauseRow } from '../types'

interface Props {
  memberId: string
  memberName: string
  clauses: MemberClauseRow[]
  templates: ClauseTemplateOption[]
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const STATUS_STYLES: Record<MemberClauseRow['status'], string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  signed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
  expired: 'bg-slate-100 text-slate-500 ring-slate-200',
}

const STATUS_LABEL: Record<MemberClauseRow['status'], string> = {
  pending: 'Pendiente firma',
  signed: 'Firmada',
  rejected: 'Rechazada',
  expired: 'Caducada',
}

export default function DocumentosTab({
  memberId,
  memberName,
  clauses,
  templates,
}: Props) {
  const [showAssign, setShowAssign] = useState(false)
  const [signingClause, setSigningClause] = useState<MemberClauseRow | null>(null)
  const [viewingClause, setViewingClause] = useState<MemberClauseRow | null>(null)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function handleAssign(formData: FormData) {
    const tplId = String(formData.get('template_id') ?? '')
    const expires = String(formData.get('expires_at') ?? '') || null
    if (!tplId) {
      setMsg({ type: 'err', text: 'Selecciona una plantilla' })
      return
    }
    setMsg(null)
    startTransition(async () => {
      const res = await assignClauseToMemberAction(memberId, tplId, expires)
      if (res.error) setMsg({ type: 'err', text: res.error })
      else {
        setMsg({ type: 'ok', text: res.success ?? 'Asignada' })
        setShowAssign(false)
      }
    })
  }

  function handleSign(formData: FormData) {
    if (!signingClause) return
    const name = String(formData.get('signed_by_name') ?? '').trim()
    if (!name) {
      setMsg({ type: 'err', text: 'Introduce el nombre de quien firma' })
      return
    }
    setMsg(null)
    startTransition(async () => {
      const res = await signMemberClauseAction(memberId, signingClause.id, name)
      if (res.error) setMsg({ type: 'err', text: res.error })
      else {
        setMsg({ type: 'ok', text: res.success ?? 'Firmada' })
        setSigningClause(null)
      }
    })
  }

  function handleRevoke(clause: MemberClauseRow) {
    if (!confirm(`¿Eliminar la cláusula "${clause.titleSnapshot}"?`)) return
    startTransition(async () => {
      const res = await revokeMemberClauseAction(memberId, clause.id)
      if (res.error) setMsg({ type: 'err', text: res.error })
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div>
            <h3 className="text-[14px] font-semibold text-slate-900">
              Cláusulas y consentimientos RGPD
            </h3>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Asigna plantillas de consentimiento (RGPD, responsabilidad civil, foto/vídeo, etc.) y registra firmas digitales con sello legal.
            </p>
          </div>
          <button
            onClick={() => {
              setMsg(null)
              setShowAssign(true)
            }}
            disabled={templates.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3b8bea] px-3 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7] disabled:cursor-not-allowed disabled:opacity-60"
            title={
              templates.length === 0
                ? 'No hay plantillas configuradas en este gym todavía'
                : 'Asignar cláusula al socio'
            }
          >
            <Plus className="h-4 w-4" />
            Asignar cláusula
          </button>
        </div>

        {templates.length === 0 && (
          <div className="border-b border-slate-100 bg-amber-50/40 px-5 py-3 text-[12px] text-amber-700">
            Aún no hay plantillas de cláusulas configuradas en este gym. Pídele
            al administrador que las configure desde el panel del gym.
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 text-left text-[12px] font-medium text-slate-500">
              <tr>
                <th className="px-5 py-2.5">Cláusula</th>
                <th className="px-5 py-2.5">Asignada</th>
                <th className="px-5 py-2.5">Firma</th>
                <th className="px-5 py-2.5">Caduca</th>
                <th className="px-5 py-2.5">Estado</th>
                <th className="px-5 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clauses.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 text-slate-800">
                  <td className="px-5 py-2.5">
                    <button
                      onClick={() => setViewingClause(c)}
                      className="text-left font-medium text-slate-900 hover:text-[#3b8bea]"
                    >
                      {c.titleSnapshot}
                    </button>
                  </td>
                  <td className="px-5 py-2.5 text-slate-500">
                    {fmtDate(c.assignedAt)}
                  </td>
                  <td className="px-5 py-2.5">
                    {c.signedAt ? (
                      <div className="text-[12px]">
                        <p className="text-slate-900">{c.signedByName}</p>
                        <p className="text-slate-500">{fmtDate(c.signedAt)}</p>
                      </div>
                    ) : (
                      <span className="text-[12px] text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-slate-500">
                    {fmtDate(c.expiresAt)}
                  </td>
                  <td className="px-5 py-2.5">
                    <span
                      className={
                        'inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium ring-1 ' +
                        STATUS_STYLES[c.status]
                      }
                    >
                      {STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {c.status === 'pending' && (
                        <button
                          title="Firmar"
                          onClick={() => setSigningClause(c)}
                          disabled={pending}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
                        >
                          <Pen className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        title="Eliminar"
                        onClick={() => handleRevoke(c)}
                        disabled={pending}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {clauses.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-[13px] text-slate-400"
                  >
                    No hay cláusulas asignadas todavía
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {msg && (
          <div
            className={
              msg.type === 'ok'
                ? 'm-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700'
                : 'm-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700'
            }
          >
            {msg.text}
          </div>
        )}
      </section>

      {showAssign && (
        <Modal onClose={() => setShowAssign(false)} title="Asignar cláusula">
          <form action={handleAssign} className="space-y-4">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-slate-600">
                Plantilla *
              </label>
              <select
                name="template_id"
                required
                defaultValue=""
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
              >
                <option value="">Selecciona una plantilla</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                    {t.isRequired ? ' (obligatoria)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-slate-600">
                Caduca el (opcional)
              </label>
              <input
                type="date"
                name="expires_at"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAssign(false)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="h-9 rounded-lg bg-[#3b8bea] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7] disabled:opacity-60"
              >
                {pending ? 'Asignando…' : 'Asignar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {signingClause && (
        <Modal
          onClose={() => setSigningClause(null)}
          title={`Firmar: ${signingClause.titleSnapshot}`}
        >
          <div className="space-y-4">
            <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-700 whitespace-pre-line">
              {signingClause.bodySnapshot}
            </div>
            <form action={handleSign} className="space-y-3">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-600">
                  Firmo en nombre de *
                </label>
                <input
                  name="signed_by_name"
                  defaultValue={memberName}
                  required
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Tu firma se registrará con sello de fecha y hora. Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSigningClause(null)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {pending ? 'Firmando…' : 'Acepto y firmo'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {viewingClause && (
        <Modal
          onClose={() => setViewingClause(null)}
          title={viewingClause.titleSnapshot}
        >
          <div className="space-y-3">
            <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-700 whitespace-pre-line">
              {viewingClause.bodySnapshot}
            </div>
            <div className="flex items-center gap-2 text-[12px] text-slate-500">
              <FileText className="h-4 w-4" />
              <span>Asignada {fmtDate(viewingClause.assignedAt)}</span>
              {viewingClause.signedAt && (
                <span>· Firmada por {viewingClause.signedByName} el {fmtDate(viewingClause.signedAt)}</span>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode
  onClose: () => void
  title: string
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
