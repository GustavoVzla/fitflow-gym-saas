'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  FormInput,
  Plus,
  Edit,
  Trash2,
  Power,
  CheckCircle2,
  AlertCircle,
  X,
  UserPlus,
  Users,
} from 'lucide-react'
import {
  type FormFieldRow,
  type FormFieldType,
  type FormScope,
  FIELD_TYPE_LABEL,
  SCOPE_LABEL,
} from './types'
import {
  createFieldAction,
  updateFieldAction,
  toggleFieldActiveAction,
  deleteFieldAction,
} from './actions'

interface Props {
  initialFields: FormFieldRow[]
}

type ModalType = 'none' | 'new' | 'edit' | 'confirm-delete'

export default function FormulariosClient({ initialFields }: Props) {
  const [fields, setFields] = useState(initialFields)
  const [activeScope, setActiveScope] = useState<FormScope>('member_signup')
  const [modalType, setModalType] = useState<ModalType>('none')
  const [selected, setSelected] = useState<FormFieldRow | null>(null)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const byScope = useMemo(() => {
    const map: Record<FormScope, FormFieldRow[]> = {
      member_signup: [],
      prospect_signup: [],
    }
    fields.forEach((f) => map[f.formScope].push(f))
    return map
  }, [fields])

  function closeModal() {
    setModalType('none')
    setSelected(null)
    setMsg(null)
  }

  function handleCreate(fd: FormData) {
    fd.set('form_scope', activeScope)
    startTransition(async () => {
      const res = await createFieldAction({}, fd)
      if (res.error) setMsg({ type: 'error', text: res.error })
      else {
        setMsg({ type: 'success', text: res.success ?? 'Creado' })
        setTimeout(() => window.location.reload(), 700)
      }
    })
  }

  function handleEdit(fd: FormData) {
    startTransition(async () => {
      const res = await updateFieldAction({}, fd)
      if (res.error) setMsg({ type: 'error', text: res.error })
      else {
        setMsg({ type: 'success', text: res.success ?? 'Actualizado' })
        setTimeout(() => window.location.reload(), 700)
      }
    })
  }

  function handleToggle(f: FormFieldRow) {
    startTransition(async () => {
      const res = await toggleFieldActiveAction(f.id, !f.isActive)
      if (res.error) setMsg({ type: 'error', text: res.error })
      else {
        setFields((prev) =>
          prev.map((x) => (x.id === f.id ? { ...x, isActive: !x.isActive } : x))
        )
      }
    })
  }

  function handleDelete() {
    if (!selected) return
    startTransition(async () => {
      const res = await deleteFieldAction(selected.id)
      if (res.error) setMsg({ type: 'error', text: res.error })
      else {
        setFields((prev) => prev.filter((x) => x.id !== selected.id))
        closeModal()
      }
    })
  }

  const scopeFields = byScope[activeScope]

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FormInput className="h-6 w-6 text-[var(--brand-color,#0B4B8C)]" />
            Formularios — campos custom
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Amplía los datos que capturas en el alta de socios y potenciales (paridad LegacyGym).
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
          Nuevo campo
        </button>
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

      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveScope('member_signup')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeScope === 'member_signup'
              ? 'border-[var(--brand-color,#0B4B8C)] text-[var(--brand-color,#0B4B8C)]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="h-4 w-4" />
          Alta de socio ({byScope.member_signup.length})
        </button>
        <button
          onClick={() => setActiveScope('prospect_signup')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeScope === 'prospect_signup'
              ? 'border-[var(--brand-color,#0B4B8C)] text-[var(--brand-color,#0B4B8C)]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <UserPlus className="h-4 w-4" />
          Alta de potencial ({byScope.prospect_signup.length})
        </button>
      </div>

      {scopeFields.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <FormInput className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">
            No hay campos custom en {SCOPE_LABEL[activeScope].toLowerCase()}.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Los campos base (nombre, email, teléfono, tarifa) siempre aparecen. Aquí añades extras.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Orden</th>
                <th className="text-left px-4 py-3 font-medium">Nombre técnico</th>
                <th className="text-left px-4 py-3 font-medium">Etiqueta</th>
                <th className="text-left px-4 py-3 font-medium">Tipo</th>
                <th className="text-left px-4 py-3 font-medium">Obligatorio</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-right px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scopeFields.map((f) => (
                <tr key={f.id} className={f.isActive ? '' : 'bg-slate-50/50'}>
                  <td className="px-4 py-3 font-mono text-xs">{f.sortOrder}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{f.fieldName}</td>
                  <td className="px-4 py-3 text-slate-900">{f.fieldLabel}</td>
                  <td className="px-4 py-3 text-slate-600">{FIELD_TYPE_LABEL[f.fieldType]}</td>
                  <td className="px-4 py-3">
                    {f.isRequired ? (
                      <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        Sí
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {f.isActive ? (
                      <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => handleToggle(f)}
                        disabled={isPending}
                        title={f.isActive ? 'Desactivar' : 'Activar'}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setSelected(f)
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
                          setSelected(f)
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
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">
              {modalType === 'new'
                ? `Nuevo campo (${SCOPE_LABEL[activeScope]})`
                : `Editar ${selected?.fieldLabel}`}
            </h3>
            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form
            action={modalType === 'new' ? handleCreate : handleEdit}
            className="space-y-3"
          >
            {modalType === 'edit' && (
              <>
                <input type="hidden" name="id" value={selected?.id ?? ''} />
                <input
                  type="hidden"
                  name="form_scope"
                  value={selected?.formScope ?? activeScope}
                />
              </>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nombre técnico *
                </label>
                <input
                  name="field_name"
                  required
                  defaultValue={selected?.fieldName ?? ''}
                  placeholder="talla_camiseta"
                  pattern="[a-z][a-z0-9_]{0,40}"
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">minúsculas, sin espacios</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Orden (menor = arriba)
                </label>
                <input
                  name="sort_order"
                  type="number"
                  defaultValue={selected?.sortOrder ?? 0}
                  min={0}
                  max={999}
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Etiqueta visible *
              </label>
              <input
                name="field_label"
                required
                defaultValue={selected?.fieldLabel ?? ''}
                maxLength={120}
                placeholder="Talla de camiseta"
                className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tipo *</label>
              <select
                name="field_type"
                defaultValue={selected?.fieldType ?? 'text'}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                {(Object.keys(FIELD_TYPE_LABEL) as FormFieldType[]).map((t) => (
                  <option key={t} value={t}>
                    {FIELD_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Opciones (una por línea, solo si tipo = desplegable)
              </label>
              <textarea
                name="options"
                defaultValue={(selected?.options ?? []).join('\n')}
                rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-y"
                placeholder={'S\nM\nL\nXL'}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Placeholder
                </label>
                <input
                  name="placeholder"
                  defaultValue={selected?.placeholder ?? ''}
                  maxLength={200}
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Ayuda (debajo del campo)
                </label>
                <input
                  name="help_text"
                  defaultValue={selected?.helpText ?? ''}
                  maxLength={500}
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="is-required"
                type="checkbox"
                name="is_required"
                defaultChecked={selected?.isRequired ?? false}
                className="h-4 w-4 rounded border-slate-300"
              />
              <label htmlFor="is-required" className="text-sm text-slate-700">
                Campo obligatorio
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

      {modalType === 'confirm-delete' && selected && (
        <ModalOverlay onClose={closeModal}>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Eliminar campo</h3>
          <p className="text-sm text-slate-600 mb-4">
            ¿Eliminar <strong>{selected.fieldLabel}</strong>? Los valores ya capturados en socios
            previos no se borran pero dejarán de ser editables desde la UI.
          </p>
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
        className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
