'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  UserPlus,
  Plus,
  Trash2,
  Edit,
  CheckCircle2,
  Phone,
  Mail,
  ChevronRight,
} from 'lucide-react'
import {
  type ProspectRow,
  type ProspectStatus,
  type TariffOption,
  STATUS_LABEL,
  STATUS_COLOR,
  STATUS_ORDER,
} from './types'
import {
  createProspectAction,
  updateProspectAction,
  moveProspectStatusAction,
  deleteProspectAction,
  convertProspectAction,
} from './actions'

interface Props {
  prospects: ProspectRow[]
  tariffs: TariffOption[]
}

type ModalType = 'none' | 'new' | 'edit' | 'detail' | 'convert' | 'confirm-delete' | 'lost'

type RgpdConsentSource =
  | ''
  | 'paper_signed'
  | 'email_confirmed'
  | 'in_person_verbal_logged'
  | 'digital_signature'

export default function PotencialesClient({ prospects: initial, tariffs }: Props) {
  const [prospects, setProspects] = useState(initial)
  const [modalType, setModalType] = useState<ModalType>('none')
  const [selected, setSelected] = useState<ProspectRow | null>(null)
  const [selectedTariff, setSelectedTariff] = useState('')
  const [lostReason, setLostReason] = useState('')
  const [rgpdConsent, setRgpdConsent] = useState(false)
  const [rgpdSource, setRgpdSource] = useState<RgpdConsentSource>('')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const byStatus = useMemo(() => {
    const map: Record<ProspectStatus, ProspectRow[]> = {
      new: [],
      contacted: [],
      scheduled_visit: [],
      converted: [],
      lost: [],
    }
    prospects.forEach((p) => map[p.status].push(p))
    return map
  }, [prospects])

  function closeModal() {
    setModalType('none')
    setSelected(null)
    setSelectedTariff('')
    setLostReason('')
    setRgpdConsent(false)
    setRgpdSource('')
    setMsg(null)
  }

  function handleCreate(fd: FormData) {
    startTransition(async () => {
      const res = await createProspectAction({}, fd)
      if (res.error) setMsg({ type: 'error', text: res.error })
      else {
        setMsg({ type: 'success', text: 'Creado' })
        setTimeout(() => {
          closeModal()
          window.location.reload()
        }, 600)
      }
    })
  }

  function handleEdit(fd: FormData) {
    startTransition(async () => {
      const res = await updateProspectAction({}, fd)
      if (res.error) setMsg({ type: 'error', text: res.error })
      else {
        setMsg({ type: 'success', text: 'Actualizado' })
        setTimeout(() => {
          closeModal()
          window.location.reload()
        }, 600)
      }
    })
  }

  function handleMove(p: ProspectRow, newStatus: ProspectStatus) {
    if (newStatus === 'lost') {
      setSelected(p)
      setModalType('lost')
      return
    }
    if (newStatus === 'converted') {
      setSelected(p)
      setSelectedTariff(tariffs[0]?.id ?? '')
      setModalType('convert')
      return
    }
    startTransition(async () => {
      const res = await moveProspectStatusAction(p.id, newStatus)
      if (res.error) setMsg({ type: 'error', text: res.error })
      else {
        setProspects((prev) =>
          prev.map((x) => (x.id === p.id ? { ...x, status: newStatus } : x))
        )
      }
    })
  }

  function handleConfirmLost() {
    if (!selected) return
    startTransition(async () => {
      const res = await moveProspectStatusAction(selected.id, 'lost', lostReason.trim() || undefined)
      if (res.error) setMsg({ type: 'error', text: res.error })
      else {
        setProspects((prev) =>
          prev.map((x) =>
            x.id === selected.id ? { ...x, status: 'lost' as ProspectStatus, lostReason: lostReason.trim() || null } : x
          )
        )
        closeModal()
      }
    })
  }

  function handleConfirmConvert() {
    if (!selected) return
    if (!rgpdConsent) {
      setMsg({ type: 'error', text: 'Debes confirmar consentimiento RGPD antes de convertir.' })
      return
    }
    if (!rgpdSource) {
      setMsg({ type: 'error', text: 'Indica cómo se recabó el consentimiento.' })
      return
    }
    startTransition(async () => {
      const res = await convertProspectAction(
        selected.id,
        selectedTariff || null,
        rgpdConsent,
        rgpdSource as Exclude<RgpdConsentSource, ''>
      )
      if (res.error) setMsg({ type: 'error', text: res.error })
      else {
        setProspects((prev) =>
          prev.map((x) =>
            x.id === selected.id
              ? { ...x, status: 'converted' as ProspectStatus, conversionMemberId: res.memberId ?? null }
              : x
          )
        )
        closeModal()
      }
    })
  }

  function handleDelete() {
    if (!selected) return
    startTransition(async () => {
      const res = await deleteProspectAction(selected.id)
      if (res.error) setMsg({ type: 'error', text: res.error })
      else {
        setProspects((prev) => prev.filter((x) => x.id !== selected.id))
        closeModal()
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Potenciales</h1>
          <p className="text-sm text-slate-600 mt-1">
            Leads y pre-socios en funnel hasta conversión a socio.
          </p>
        </div>
        <button
          onClick={() => {
            setSelected(null)
            setMsg(null)
            setModalType('new')
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-color,#0B4B8C)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Nuevo potencial
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {STATUS_ORDER.map((status) => (
          <div key={status} className="bg-slate-50 rounded-xl p-3 min-h-[300px]">
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                {STATUS_LABEL[status]}
              </h2>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[status]}`}
              >
                {byStatus[status].length}
              </span>
            </div>

            <div className="space-y-2">
              {byStatus[status].map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg bg-white border border-slate-200 p-3 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-sm text-slate-900 truncate flex-1">
                      {p.name}
                    </h3>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => {
                          setSelected(p)
                          setMsg(null)
                          setModalType('edit')
                        }}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Editar"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => {
                          setSelected(p)
                          setMsg(null)
                          setModalType('confirm-delete')
                        }}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  {p.email && (
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                      <Mail className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{p.email}</span>
                    </div>
                  )}
                  {p.phone && (
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                      <Phone className="h-3 w-3 flex-shrink-0" />
                      <span>{p.phone}</span>
                    </div>
                  )}
                  {p.source && (
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      Origen: <span className="font-medium">{p.source}</span>
                    </p>
                  )}
                  {p.interest && (
                    <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">
                      {p.interest}
                    </p>
                  )}

                  {p.status !== 'converted' && p.status !== 'lost' && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1">
                      {getNextStates(p.status).map((next) => (
                        <button
                          key={next}
                          onClick={() => handleMove(p, next)}
                          className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          {STATUS_LABEL[next]}
                          <ChevronRight className="h-2.5 w-2.5" />
                        </button>
                      ))}
                    </div>
                  )}

                  {p.status === 'converted' && p.conversionMemberId && (
                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Socio activo
                    </div>
                  )}

                  {p.status === 'lost' && p.lostReason && (
                    <p className="mt-2 text-[10px] text-slate-400 italic">
                      Motivo: {p.lostReason}
                    </p>
                  )}
                </div>
              ))}
              {byStatus[status].length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6 italic">—</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {(modalType === 'new' || modalType === 'edit') && (
        <ModalOverlay onClose={closeModal}>
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            {modalType === 'new' ? 'Nuevo potencial' : `Editar ${selected?.name}`}
          </h3>
          <form
            action={modalType === 'new' ? handleCreate : handleEdit}
            className="space-y-3"
          >
            {modalType === 'edit' && <input type="hidden" name="id" value={selected?.id ?? ''} />}
            <Field name="name" label="Nombre *" defaultValue={selected?.name ?? ''} required />
            <div className="grid grid-cols-2 gap-3">
              <Field
                name="email"
                label="Email"
                type="email"
                defaultValue={selected?.email ?? ''}
              />
              <Field name="phone" label="Teléfono" defaultValue={selected?.phone ?? ''} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                name="source"
                label="Origen"
                defaultValue={selected?.source ?? ''}
                placeholder="web, referido, IG..."
              />
              <Field
                name="interest"
                label="Interés"
                defaultValue={selected?.interest ?? ''}
                placeholder="Personal, WOD..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Notas</label>
              <textarea
                name="notes"
                defaultValue={selected?.notes ?? ''}
                rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-none"
              />
            </div>

            {msg && (
              <div
                className={`rounded-md px-3 py-2 text-sm ${
                  msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                }`}
              >
                {msg.text}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-[var(--brand-color,#0B4B8C)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {modalType === 'new' ? 'Crear' : 'Guardar'}
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}

      {modalType === 'convert' && selected && (
        <ModalOverlay onClose={closeModal}>
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            Convertir {selected.name} en socio
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Crea un socio real con los datos del potencial y lo marca como convertido.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Tarifa inicial (opcional)
            </label>
            <select
              value={selectedTariff}
              onChange={(e) => setSelectedTariff(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">— Sin tarifa inicial —</option>
              {tariffs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(t.price)}
                </option>
              ))}
            </select>
          </div>

          {/* Consentimiento RGPD — obligatorio antes de crear el member (Art. 7) */}
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50/50 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <input
                id="rgpd-convert-checkbox"
                type="checkbox"
                checked={rgpdConsent}
                onChange={(e) => setRgpdConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-300"
              />
              <label htmlFor="rgpd-convert-checkbox" className="text-[11px] text-amber-900 leading-relaxed">
                <strong>Confirmo que el potencial ha otorgado consentimiento RGPD</strong> (Art. 7)
                para el tratamiento de sus datos personales. Soy responsable de conservar la
                evidencia en caso de auditoría AEPD.
              </label>
            </div>
            {rgpdConsent && (
              <div>
                <label className="block text-[11px] font-medium text-amber-900 mb-1">
                  ¿Cómo se recabó? *
                </label>
                <select
                  value={rgpdSource}
                  onChange={(e) => setRgpdSource(e.target.value as RgpdConsentSource)}
                  className="h-8 w-full rounded-md border border-amber-300 bg-white px-2 text-xs"
                >
                  <option value="">— Selecciona —</option>
                  <option value="paper_signed">Firmado en papel</option>
                  <option value="email_confirmed">Email confirmado (double opt-in)</option>
                  <option value="in_person_verbal_logged">Verbal in situ (registrado)</option>
                  <option value="digital_signature">Firma digital</option>
                </select>
              </div>
            )}
          </div>

          {msg && (
            <div
              className={`mt-3 rounded-md px-3 py-2 text-sm ${
                msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
              }`}
            >
              {msg.text}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={closeModal}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmConvert}
              disabled={isPending}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Convertir en socio
            </button>
          </div>
        </ModalOverlay>
      )}

      {modalType === 'lost' && selected && (
        <ModalOverlay onClose={closeModal}>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Marcar como perdido</h3>
          <p className="text-sm text-slate-600 mb-4">
            {selected.name} — ¿por qué se perdió?
          </p>
          <textarea
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            rows={3}
            placeholder="Ej: Eligió competencia, no respondió, precio..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-none"
          />
          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={closeModal}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmLost}
              disabled={isPending}
              className="rounded-md bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Marcar perdido
            </button>
          </div>
        </ModalOverlay>
      )}

      {modalType === 'confirm-delete' && selected && (
        <ModalOverlay onClose={closeModal}>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Eliminar potencial</h3>
          <p className="text-sm text-slate-600 mb-4">
            ¿Seguro que quieres eliminar <strong>{selected.name}</strong>? Esta acción no se
            puede deshacer.
          </p>
          {msg?.type === 'error' && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 mb-3">
              {msg.text}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={closeModal}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Eliminar
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}

function getNextStates(current: ProspectStatus): ProspectStatus[] {
  const map: Record<ProspectStatus, ProspectStatus[]> = {
    new: ['contacted', 'lost'],
    contacted: ['scheduled_visit', 'lost'],
    scheduled_visit: ['converted', 'lost'],
    converted: [],
    lost: [],
  }
  return map[current]
}

function ModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function Field({
  name,
  label,
  defaultValue = '',
  type = 'text',
  placeholder,
  required,
}: {
  name: string
  label: string
  defaultValue?: string
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  )
}
