'use client'

import { useState, useTransition } from 'react'
import { Users, Plus, Trash2, Edit, UserPlus, X, Power } from 'lucide-react'
import type { GroupRow, ClassOption, MemberOption } from './types'
import {
  createGroupAction,
  updateGroupAction,
  toggleGroupAction,
  deleteGroupAction,
  addMemberToGroupAction,
  removeMemberFromGroupAction,
} from './actions'

interface Props {
  groups: GroupRow[]
  classes: ClassOption[]
  members: MemberOption[]
}

type ModalType = 'none' | 'new' | 'edit' | 'members' | 'confirm-delete'

interface GroupMemberLite {
  memberId: string
  name: string
  email: string | null
}

export default function GruposClient({ groups, classes, members }: Props) {
  const [modalType, setModalType] = useState<ModalType>('none')
  const [selected, setSelected] = useState<GroupRow | null>(null)
  const [detailMembers, setDetailMembers] = useState<GroupMemberLite[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function closeModal() {
    setModalType('none')
    setSelected(null)
    setDetailMembers([])
    setMemberSearch('')
    setMsg(null)
  }

  async function openMembers(g: GroupRow) {
    setSelected(g)
    const res = await fetch(`/grupos-entreno/api/members?groupId=${g.id}`)
    if (res.ok) {
      const data = await res.json()
      setDetailMembers(data.members ?? [])
    }
    setModalType('members')
  }

  function handleCreate(fd: FormData) {
    startTransition(async () => {
      const res = await createGroupAction({}, fd)
      if (res.error) setMsg({ type: 'error', text: res.error })
      else {
        setMsg({ type: 'success', text: 'Grupo creado' })
        setTimeout(closeModal, 800)
      }
    })
  }

  function handleEdit(fd: FormData) {
    startTransition(async () => {
      const res = await updateGroupAction({}, fd)
      if (res.error) setMsg({ type: 'error', text: res.error })
      else {
        setMsg({ type: 'success', text: 'Actualizado' })
        setTimeout(closeModal, 800)
      }
    })
  }

  function handleToggle(g: GroupRow) {
    startTransition(async () => {
      await toggleGroupAction(g.id, !g.isActive)
    })
  }

  function handleDelete() {
    if (!selected) return
    startTransition(async () => {
      const res = await deleteGroupAction(selected.id)
      if (res.error) setMsg({ type: 'error', text: res.error })
      else closeModal()
    })
  }

  function handleAddMember(memberId: string) {
    if (!selected) return
    startTransition(async () => {
      const res = await addMemberToGroupAction(selected.id, memberId)
      if (res.error) {
        setMsg({ type: 'error', text: res.error })
        return
      }
      const m = members.find((x) => x.id === memberId)
      if (m) {
        setDetailMembers((prev) => [...prev, { memberId: m.id, name: m.name, email: m.email }])
      }
      setMemberSearch('')
    })
  }

  function handleRemoveMember(memberId: string) {
    if (!selected) return
    startTransition(async () => {
      const res = await removeMemberFromGroupAction(selected.id, memberId)
      if (res.error) {
        setMsg({ type: 'error', text: res.error })
        return
      }
      setDetailMembers((prev) => prev.filter((m) => m.memberId !== memberId))
    })
  }

  const assignable = members.filter(
    (m) =>
      !detailMembers.some((x) => x.memberId === m.id) &&
      (!memberSearch.trim() ||
        m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.email?.toLowerCase().includes(memberSearch.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Grupos de entreno</h1>
          <p className="text-sm text-slate-600 mt-1">
            Squads o equipos de atletas (ej. infantil, competición, iniciación).
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
          Nuevo grupo
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">No hay grupos todavía.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <div
              key={g.id}
              className={`rounded-xl border border-slate-200 bg-white p-5 ${
                !g.isActive ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: g.color }}
                  />
                  <h3 className="font-semibold text-slate-900 truncate">{g.name}</h3>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleToggle(g)}
                    className={`rounded p-1.5 ${
                      g.isActive ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'
                    }`}
                    title={g.isActive ? 'Activo' : 'Inactivo'}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setSelected(g)
                      setMsg(null)
                      setModalType('edit')
                    }}
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                    title="Editar"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setSelected(g)
                      setMsg(null)
                      setModalType('confirm-delete')
                    }}
                    className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {g.description && (
                <p className="text-sm text-slate-600 mt-2 line-clamp-2">{g.description}</p>
              )}
              {g.defaultClassName && (
                <p className="text-xs text-slate-500 mt-2">
                  Clase habitual: <span className="font-medium">{g.defaultClassName}</span>
                </p>
              )}
              <button
                onClick={() => openMembers(g)}
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--brand-color,#0B4B8C)] hover:underline"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {g.memberCount} {g.memberCount === 1 ? 'miembro' : 'miembros'}
              </button>
            </div>
          ))}
        </div>
      )}

      {(modalType === 'new' || modalType === 'edit') && (
        <ModalOverlay onClose={closeModal}>
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            {modalType === 'new' ? 'Nuevo grupo' : `Editar ${selected?.name}`}
          </h3>
          <form
            action={modalType === 'new' ? handleCreate : handleEdit}
            className="space-y-3"
          >
            {modalType === 'edit' && <input type="hidden" name="id" value={selected?.id ?? ''} />}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nombre *
              </label>
              <input
                name="name"
                defaultValue={selected?.name ?? ''}
                required
                placeholder="Ej: Competición Adultos"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Descripción
              </label>
              <textarea
                name="description"
                defaultValue={selected?.description ?? ''}
                rows={2}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Clase habitual
                </label>
                <select
                  name="defaultClassId"
                  defaultValue={selected?.defaultClassId ?? ''}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">— Ninguna —</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Color</label>
                <input
                  name="color"
                  type="color"
                  defaultValue={selected?.color ?? '#0B4B8C'}
                  className="w-full h-[38px] rounded-md border border-slate-300 cursor-pointer"
                />
              </div>
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
                {modalType === 'new' ? 'Crear grupo' : 'Guardar'}
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}

      {modalType === 'members' && selected && (
        <ModalOverlay onClose={closeModal}>
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            Miembros de {selected.name}
          </h3>

          {detailMembers.length === 0 ? (
            <p className="text-sm text-slate-500 py-3">Sin miembros todavía.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 mb-4 max-h-60 overflow-y-auto">
              {detailMembers.map((m) => (
                <li key={m.memberId} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{m.name}</p>
                    {m.email && <p className="text-xs text-slate-500">{m.email}</p>}
                  </div>
                  <button
                    onClick={() => handleRemoveMember(m.memberId)}
                    className="text-slate-400 hover:text-red-600"
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
                {assignable.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-slate-500">Sin resultados</li>
                ) : (
                  assignable.slice(0, 20).map((m) => (
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

      {modalType === 'confirm-delete' && selected && (
        <ModalOverlay onClose={closeModal}>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Eliminar grupo</h3>
          <p className="text-sm text-slate-600 mb-4">
            ¿Seguro que quieres eliminar <strong>{selected.name}</strong>? Los socios no se
            eliminan, solo la agrupación.
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
