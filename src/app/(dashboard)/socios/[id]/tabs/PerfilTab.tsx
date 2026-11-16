'use client'

import { useState, useTransition } from 'react'
import { updateMemberDetailAction } from '../actions'
import type { MemberDetail } from '../types'

const FIELD =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 shadow-sm transition-colors hover:border-slate-300 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none'

const TEXTAREA =
  'min-h-[88px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 shadow-sm transition-colors hover:border-slate-300 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none'

const LABEL = 'mb-1 block text-[12px] font-medium text-slate-600'

const SECTION_HEADER =
  'mb-3 mt-6 border-b border-slate-100 pb-2 text-[13px] font-semibold uppercase tracking-wide text-slate-500'

export default function PerfilTab({ member }: { member: MemberDetail }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function onSubmit(formData: FormData) {
    setMsg(null)
    startTransition(async () => {
      const res = await updateMemberDetailAction(member.id, formData)
      if (res.error) setMsg({ type: 'err', text: res.error })
      else setMsg({ type: 'ok', text: res.success ?? 'Guardado' })
    })
  }

  return (
    <form action={onSubmit} className="space-y-2">
      <h3 className={SECTION_HEADER}>Datos personales</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className={LABEL}>Nombre *</label>
          <input
            name="first_name"
            defaultValue={member.firstName}
            required
            className={FIELD + ' w-full'}
          />
        </div>
        <div>
          <label className={LABEL}>Primer apellido *</label>
          <input
            name="last_name"
            defaultValue={member.lastName}
            required
            className={FIELD + ' w-full'}
          />
        </div>
        <div>
          <label className={LABEL}>Segundo apellido</label>
          <input
            name="second_last_name"
            defaultValue={member.secondLastName ?? ''}
            className={FIELD + ' w-full'}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className={LABEL}>DNI / NIE</label>
          <input
            name="tax_id"
            defaultValue={member.taxId ?? ''}
            className={FIELD + ' w-full'}
          />
        </div>
        <div>
          <label className={LABEL}>Fecha de nacimiento</label>
          <input
            type="date"
            name="birth_date"
            defaultValue={member.birthDate ?? ''}
            className={FIELD + ' w-full'}
          />
        </div>
        <div>
          <label className={LABEL}>Género</label>
          <select
            name="gender"
            defaultValue={member.gender ?? ''}
            className={FIELD + ' w-full'}
          >
            <option value="">Sin especificar</option>
            <option value="female">Mujer</option>
            <option value="male">Hombre</option>
            <option value="other">Otro</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={LABEL}>Email</label>
          <input
            type="email"
            name="email"
            defaultValue={member.email ?? ''}
            className={FIELD + ' w-full'}
          />
        </div>
        <div>
          <label className={LABEL}>Teléfono</label>
          <input
            name="phone"
            defaultValue={member.phone ?? ''}
            className={FIELD + ' w-full'}
          />
        </div>
      </div>

      <h3 className={SECTION_HEADER}>Dirección</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className={LABEL}>Dirección</label>
          <input
            name="address"
            defaultValue={member.address ?? ''}
            className={FIELD + ' w-full'}
          />
        </div>
        <div>
          <label className={LABEL}>Código postal</label>
          <input
            name="postal_code"
            defaultValue={member.postalCode ?? ''}
            className={FIELD + ' w-full'}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={LABEL}>Ciudad</label>
          <input
            name="city"
            defaultValue={member.city ?? ''}
            className={FIELD + ' w-full'}
          />
        </div>
        <div>
          <label className={LABEL}>Foto / Avatar URL</label>
          <input
            name="avatar_url"
            defaultValue={member.avatarUrl ?? ''}
            placeholder="https://..."
            className={FIELD + ' w-full'}
          />
        </div>
      </div>

      <h3 className={SECTION_HEADER}>Contacto de emergencia</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className={LABEL}>Nombre</label>
          <input
            name="emergency_contact_name"
            defaultValue={member.emergencyContactName ?? ''}
            className={FIELD + ' w-full'}
          />
        </div>
        <div>
          <label className={LABEL}>Teléfono</label>
          <input
            name="emergency_contact_phone"
            defaultValue={member.emergencyContactPhone ?? ''}
            className={FIELD + ' w-full'}
          />
        </div>
        <div>
          <label className={LABEL}>Relación</label>
          <input
            name="emergency_contact_relation"
            defaultValue={member.emergencyContactRelation ?? ''}
            placeholder="Madre, pareja, hermano..."
            className={FIELD + ' w-full'}
          />
        </div>
      </div>

      <h3 className={SECTION_HEADER}>Información adicional</h3>
      <div>
        <label className={LABEL}>Fecha de alta</label>
        <input
          type="date"
          name="join_date"
          defaultValue={member.joinDate}
          className={FIELD + ' w-full md:w-1/3'}
        />
      </div>
      <div>
        <label className={LABEL}>Notas (visibles al socio)</label>
        <textarea
          name="notes"
          defaultValue={member.notes ?? ''}
          rows={3}
          className={TEXTAREA + ' w-full'}
        />
      </div>
      <div>
        <label className={LABEL}>Notas internas (no visibles al socio)</label>
        <textarea
          name="internal_notes"
          defaultValue={member.internalNotes ?? ''}
          rows={3}
          className={TEXTAREA + ' w-full'}
        />
      </div>

      {msg && (
        <div
          className={
            msg.type === 'ok'
              ? 'mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700'
              : 'mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700'
          }
        >
          {msg.text}
        </div>
      )}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-lg bg-[#3b8bea] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7] disabled:opacity-60"
        >
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
