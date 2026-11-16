'use client'

import { useState, useTransition } from 'react'
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Power,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react'
import type { ClauseRow } from './types'
import {
  createClauseAction,
  updateClauseAction,
  toggleClauseActiveAction,
  deleteClauseAction,
  seedDefaultClausesAction,
} from './actions'

interface Props {
  initialClauses: ClauseRow[]
}

type ModalType = 'none' | 'new' | 'edit' | 'view' | 'confirm-delete'

export default function ClausulasClient({ initialClauses }: Props) {
  const [clauses, setClauses] = useState(initialClauses)
  const [modalType, setModalType] = useState<ModalType>('none')
  const [selected, setSelected] = useState<ClauseRow | null>(null)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function closeModal() {
    setModalType('none')
    setSelected(null)
    setMsg(null)
  }

  function refresh() {
    // reload simple — la lista cambia poco
    window.location.reload()
  }

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const res = await createClauseAction({}, formData)
      if (res.error) setMsg({ type: 'error', text: res.error })
      else {
        setMsg({ type: 'success', text: res.success ?? 'Creada' })
        setTimeout(refresh, 700)
      }
    })
  }

  function handleEdit(formData: FormData) {
    startTransition(async () => {
      const res = await updateClauseAction({}, formData)
      if (res.error) setMsg({ type: 'error', text: res.error })
      else {
        setMsg({ type: 'success', text: res.success ?? 'Actualizada' })
        setTimeout(refresh, 700)
      }
    })
  }

  function handleToggle(c: ClauseRow) {
    startTransition(async () => {
      const res = await toggleClauseActiveAction(c.id, !c.isActive)
      if (res.error) setMsg({ type: 'error', text: res.error })
      else {
        setClauses((prev) =>
          prev.map((x) => (x.id === c.id ? { ...x, isActive: !x.isActive } : x))
        )
      }
    })
  }

  function handleDelete() {
    if (!selected) return
    startTransition(async () => {
      const res = await deleteClauseAction(selected.id)
      if (res.error) setMsg({ type: 'error', text: res.error })
      else {
        setClauses((prev) => prev.filter((x) => x.id !== selected.id))
        closeModal()
      }
    })
  }

  function handleSeed() {
    startTransition(async () => {
      const res = await seedDefaultClausesAction()
      if (res.error) setMsg({ type: 'error', text: res.error })
      else {
        setMsg({ type: 'success', text: res.success ?? 'Sembradas' })
        setTimeout(refresh, 900)
      }
    })
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-[var(--brand-color,#0B4B8C)]" />
            Cláusulas legales
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Plantillas de consentimientos y renuncias firmadas por los socios (paridad LegacyGym).
          </p>
        </div>
        <div className="flex gap-2">
          {clauses.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              Sembrar 3 plantillas demo
            </button>
          )}
          <button
            onClick={() => {
              setSelected(null)
              setMsg(null)
              setModalType('new')
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-color,#0B4B8C)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Nueva cláusula
          </button>
        </div>
      </header>

      {msg && (
        <div
          className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
            msg.type === 'error'
              ? 'bg-red-50 border border-red-200 text-red-800'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}
        >
          {msg.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {msg.text}
        </div>
      )}

      {clauses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <p className="text-sm text-slate-600 mb-1">
            No hay cláusulas todavía.
          </p>
          <p className="text-xs text-slate-500">
            Pulsa "Sembrar 3 plantillas demo" para empezar con RGPD + RC + Imagen,
            o "Nueva cláusula" para crear una desde cero.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Código</th>
                <th className="text-left px-4 py-3 font-medium">Título</th>
                <th className="text-left px-4 py-3 font-medium">Obligatoria</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-right px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clauses.map((c) => (
                <tr key={c.id} className={c.isActive ? '' : 'bg-slate-50/50'}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{c.code}</td>
                  <td className="px-4 py-3 text-slate-900">
                    <button
                      onClick={() => {
                        setSelected(c)
                        setModalType('view')
                      }}
                      className="font-medium hover:underline text-left"
                    >
                      {c.title}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {c.isRequired ? (
                      <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        Obligatoria
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                        Opcional
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.isActive ? (
                      <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Activa
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        Inactiva
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => handleToggle(c)}
                        disabled={isPending}
                        title={c.isActive ? 'Desactivar' : 'Activar'}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setSelected(c)
                          setMsg(null)
                          setModalType('edit')
                        }}
                        title="Editar"
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setSelected(c)
                          setMsg(null)
                          setModalType('confirm-delete')
                        }}
                        disabled={isPending}
                        title="Eliminar"
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(modalType === 'new' || modalType === 'edit') && (
        <ModalOverlay onClose={closeModal}>
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            {modalType === 'new' ? 'Nueva cláusula' : `Editar ${selected?.title}`}
          </h3>
          <form
            action={modalType === 'new' ? handleCreate : handleEdit}
            className="space-y-4"
          >
            {modalType === 'edit' && <input type="hidden" name="id" value={selected?.id ?? ''} />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Código *
                </label>
                <input
                  name="code"
                  required
                  defaultValue={selected?.code ?? ''}
                  placeholder="RGPD_BASICA"
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Orden (menor = arriba)
                </label>
                <input
                  name="sortOrder"
                  type="number"
                  defaultValue={selected?.sortOrder ?? 0}
                  min={0}
                  max={999}
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Título *</label>
              <input
                name="title"
                required
                defaultValue={selected?.title ?? ''}
                maxLength={200}
                className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Cuerpo de la cláusula *
              </label>
              <textarea
                name="body"
                required
                defaultValue={selected?.body ?? ''}
                rows={12}
                minLength={10}
                maxLength={20000}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono leading-relaxed resize-y"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="is-required"
                type="checkbox"
                name="isRequired"
                defaultChecked={selected?.isRequired ?? false}
                className="h-4 w-4 rounded border-slate-300"
              />
              <label htmlFor="is-required" className="text-sm text-slate-700">
                Cláusula <strong>obligatoria</strong> para dar de alta a un socio
              </label>
            </div>
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

      {modalType === 'view' && selected && (
        <ModalOverlay onClose={closeModal}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{selected.title}</h3>
              <p className="text-xs text-slate-500 font-mono mt-1">{selected.code}</p>
            </div>
            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="rounded-md bg-slate-50 border border-slate-200 p-4 max-h-[60vh] overflow-y-auto">
            <pre className="whitespace-pre-wrap font-mono text-xs text-slate-800 leading-relaxed">
              {selected.body}
            </pre>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={closeModal}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Cerrar
            </button>
            <button
              onClick={() => setModalType('edit')}
              className="rounded-md bg-[var(--brand-color,#0B4B8C)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Editar
            </button>
          </div>
        </ModalOverlay>
      )}

      {modalType === 'confirm-delete' && selected && (
        <ModalOverlay onClose={closeModal}>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Eliminar cláusula</h3>
          <p className="text-sm text-slate-600 mb-4">
            ¿Eliminar <strong>{selected.title}</strong>? Esta acción no se puede deshacer.
            Las firmas previas de los socios NO se borran (se conservan en member_clauses).
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
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
