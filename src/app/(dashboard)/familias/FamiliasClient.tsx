'use client'

import { useState, useTransition } from 'react'
import { Users2, Plus, Trash2, Edit, UserPlus, X, Euro } from 'lucide-react'
import type { FamilyRow, MemberOption } from './types'
import {
  createFamilyAction,
  updateFamilyAction,
  deleteFamilyAction,
  addMemberToFamilyAction,
  removeMemberFromFamilyAction,
} from './actions'

interface Props {
  families: FamilyRow[]
  members: MemberOption[]
}

type ModalType = 'none' | 'new' | 'edit' | 'members' | 'confirm-delete'

interface FamilyMemberLite {
  memberId: string
  name: string
  email: string | null
}

interface FamilyDetailState {
  familyId: string
  familyName: string
  members: FamilyMemberLite[]
}

const formEUR = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)

export default function FamiliasClient({ families, members }: Props) {
  const [modalType, setModalType] = useState<ModalType>('none')
  const [selectedFamily, setSelectedFamily] = useState<FamilyRow | null>(null)
  const [detail, setDetail] = useState<FamilyDetailState | null>(null)
  const [memberSearch, setMemberSearch] = useState('')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function closeModal() {
    setModalType('none')
    setSelectedFamily(null)
    setDetail(null)
    setMemberSearch('')
    setMsg(null)
  }

  async function openMembersModal(family: FamilyRow) {
    setSelectedFamily(family)
    const res = await fetch(`/familias/api/members?familyId=${family.id}`)
    if (res.ok) {
      const data = await res.json()
      setDetail({
        familyId: family.id,
        familyName: family.name,
        members: data.members ?? [],
      })
    } else {
      setDetail({ familyId: family.id, familyName: family.name, members: [] })
    }
    setModalType('members')
  }

  function handleSubmitCreate(fd: FormData) {
    startTransition(async () => {
      const res = await createFamilyAction({}, fd)
      if (res.error) setMsg({ type: 'error', text: res.error })
      else {
        setMsg({ type: 'success', text: res.success ?? 'Creada' })
        setTimeout(closeModal, 800)
      }
    })
  }

  function handleSubmitEdit(fd: FormData) {
    startTransition(async () => {
      const res = await updateFamilyAction({}, fd)
      if (res.error) setMsg({ type: 'error', text: res.error })
      else {
        setMsg({ type: 'success', text: 'Actualizada' })
        setTimeout(closeModal, 800)
      }
    })
  }

  function handleDelete() {
    if (!selectedFamily) return
    startTransition(async () => {
      const res = await deleteFamilyAction(selectedFamily.id)
      if (res.error) setMsg({ type: 'error', text: res.error })
      else closeModal()
    })
  }

  function handleAddMember(memberId: string) {
    if (!detail) return
    startTransition(async () => {
      const res = await addMemberToFamilyAction(detail.familyId, memberId)
      if (res.error) {
        setMsg({ type: 'error', text: res.error })
        return
      }
      const m = members.find((x) => x.id === memberId)
      if (m) {
        setDetail({
          ...detail,
          members: [...detail.members, { memberId: m.id, name: m.name, email: m.email }],
        })
      }
      setMemberSearch('')
    })
  }

  function handleRemoveMember(memberId: string) {
    if (!detail) return
    startTransition(async () => {
      const res = await removeMemberFromFamilyAction(memberId)
      if (res.error) {
        setMsg({ type: 'error', text: res.error })
        return
      }
      setDetail({ ...detail, members: detail.members.filter((m) => m.memberId !== memberId) })
    })
  }

  const assignableMembers = members.filter(
    (m) =>
      !detail?.members.some((x) => x.memberId === m.id) &&
      (!memberSearch.trim() ||
        m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.email?.toLowerCase().includes(memberSearch.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Familias</h1>
          <p className="text-sm text-slate-600 mt-1">
            Agrupa socios bajo un pagador común (ej. padres, abuelos).
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedFamily(null)
            setMsg(null)
            setModalType('new')
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-color,#0B4B8C)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Nueva familia
        </button>
      </div>

      {families.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <Users2 className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">
            No hay familias todavía. Crea la primera arriba.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Pagador</th>
                <th className="px-4 py-3 font-medium">Miembros</th>
                <th className="px-4 py-3 font-medium">Email facturación</th>
                <th className="px-4 py-3 font-medium">CIF/NIF</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {families.map((f) => (
                <tr key={f.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-900">{f.name}</td>
                  <td className="px-4 py-3 text-slate-600">{f.primaryPayerName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openMembersModal(f)}
                      className="inline-flex items-center gap-1 text-sm text-[var(--brand-color,#0B4B8C)] hover:underline"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      {f.memberCount}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{f.billingEmail ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{f.billingTaxId ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => {
                          setSelectedFamily(f)
                          setMsg(null)
                          setModalType('edit')
                        }}
                        className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedFamily(f)
                          setMsg(null)
                          setModalType('confirm-delete')
                        }}
                        className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
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
            {modalType === 'new' ? 'Nueva familia' : `Editar ${selectedFamily?.name}`}
          </h3>
          <form
            action={modalType === 'new' ? handleSubmitCreate : handleSubmitEdit}
            className="space-y-3"
          >
            {modalType === 'edit' && (
              <input type="hidden" name="id" value={selectedFamily?.id ?? ''} />
            )}
            <FieldText
              name="name"
              label="Nombre de la familia *"
              defaultValue={selectedFamily?.name ?? ''}
              placeholder="Ej: Familia Rodríguez"
              required
            />
            <FieldSelect
              name="primaryPayerId"
              label="Pagador principal"
              defaultValue={selectedFamily?.primaryPayerMemberId ?? ''}
              options={[
                { value: '', label: '— Sin asignar —' },
                ...members.map((m) => ({ value: m.id, label: m.name })),
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <FieldText
                name="billingEmail"
                label="Email facturación"
                type="email"
                defaultValue={selectedFamily?.billingEmail ?? ''}
              />
              <FieldText
                name="billingPhone"
                label="Teléfono"
                defaultValue={selectedFamily?.billingPhone ?? ''}
              />
            </div>
            <FieldText
              name="billingTaxId"
              label="CIF / NIF"
              defaultValue={selectedFamily?.billingTaxId ?? ''}
            />
            <FieldText
              name="billingAddress"
              label="Dirección"
              defaultValue={selectedFamily?.billingAddress ?? ''}
            />
            <div className="grid grid-cols-2 gap-3">
              <FieldText
                name="billingCity"
                label="Ciudad"
                defaultValue={selectedFamily?.billingCity ?? ''}
              />
              <FieldText
                name="billingPostalCode"
                label="CP"
                defaultValue={selectedFamily?.billingPostalCode ?? ''}
              />
            </div>
            <FieldTextarea
              name="notes"
              label="Notas"
              defaultValue={selectedFamily?.notes ?? ''}
            />

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
                {modalType === 'new' ? 'Crear familia' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}

      {modalType === 'members' && detail && (
        <ModalOverlay onClose={closeModal}>
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            Miembros de {detail.familyName}
          </h3>

          {detail.members.length === 0 ? (
            <p className="text-sm text-slate-500 py-3">Sin miembros todavía.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 mb-4 max-h-60 overflow-y-auto">
              {detail.members.map((m) => (
                <li key={m.memberId} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{m.name}</p>
                    {m.email && <p className="text-xs text-slate-500">{m.email}</p>}
                  </div>
                  <button
                    onClick={() => handleRemoveMember(m.memberId)}
                    className="text-slate-400 hover:text-red-600"
                    title="Quitar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Añadir miembro
            </label>
            <input
              type="text"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Buscar socio..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm mb-2"
            />
            {memberSearch.trim() && (
              <ul className="max-h-40 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100">
                {assignableMembers.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-slate-500">Sin resultados</li>
                ) : (
                  assignableMembers.slice(0, 20).map((m) => (
                    <li key={m.id}>
                      <button
                        onClick={() => handleAddMember(m.id)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <span className="font-medium">{m.name}</span>
                        {m.email && <span className="text-slate-500 ml-2">{m.email}</span>}
                      </button>
                    </li>
                  ))
                )}
              </ul>
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

          <div className="flex justify-end pt-4">
            <button
              onClick={closeModal}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>
        </ModalOverlay>
      )}

      {modalType === 'confirm-delete' && selectedFamily && (
        <ModalOverlay onClose={closeModal}>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Eliminar familia</h3>
          <p className="text-sm text-slate-600 mb-4">
            ¿Seguro que quieres eliminar <strong>{selectedFamily.name}</strong>? Los socios
            asociados seguirán existiendo, solo se elimina la agrupación.
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
        className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function FieldText({
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

function FieldTextarea({
  name,
  label,
  defaultValue = '',
}: {
  name: string
  label: string
  defaultValue?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={2}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-none"
      />
    </div>
  )
}

function FieldSelect({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string
  label: string
  defaultValue: string
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
