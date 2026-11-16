'use client'

import { useState, useTransition } from 'react'
import { updateInstructorProfileAction } from '../../actions'
import type { InstructorDetail } from '../../types'

const FIELD =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 shadow-sm transition-colors hover:border-slate-300 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none'
const TEXTAREA =
  'min-h-[88px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 shadow-sm transition-colors hover:border-slate-300 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none'
const LABEL = 'mb-1 block text-[12px] font-medium text-slate-600'

export default function DatosTab({ instructor }: { instructor: InstructorDetail }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function onSubmit(formData: FormData) {
    setMsg(null)
    startTransition(async () => {
      const res = await updateInstructorProfileAction(instructor.id, formData)
      if (res.error) setMsg({ type: 'err', text: res.error })
      else setMsg({ type: 'ok', text: res.success ?? 'Guardado' })
    })
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={LABEL}>Nombre completo *</label>
          <input
            name="name"
            defaultValue={instructor.name}
            required
            className={FIELD + ' w-full'}
          />
        </div>
        <div>
          <label className={LABEL}>Email</label>
          <input
            type="email"
            name="email"
            defaultValue={instructor.email ?? ''}
            className={FIELD + ' w-full'}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={LABEL}>Teléfono</label>
          <input
            name="phone"
            defaultValue={instructor.phone ?? ''}
            className={FIELD + ' w-full'}
          />
        </div>
        <div>
          <label className={LABEL}>Color (calendario)</label>
          <div className="flex gap-2">
            <input
              type="color"
              name="color"
              defaultValue={instructor.color}
              className="h-9 w-16 cursor-pointer rounded-lg border border-slate-200 bg-white shadow-sm"
            />
            <input
              type="text"
              defaultValue={instructor.color}
              readOnly
              className={FIELD + ' flex-1'}
            />
          </div>
        </div>
      </div>

      <div>
        <label className={LABEL}>Especialidades (separadas por coma)</label>
        <input
          name="specialties"
          defaultValue={instructor.specialties.join(', ')}
          placeholder="Ej: Funcional, Yoga, Personal training"
          className={FIELD + ' w-full'}
        />
      </div>

      <div>
        <label className={LABEL}>Bio</label>
        <textarea
          name="bio"
          defaultValue={instructor.bio ?? ''}
          rows={4}
          className={TEXTAREA + ' w-full'}
        />
      </div>

      <div>
        <label className="inline-flex items-center gap-2 text-[13px] text-slate-700">
          <input
            type="checkbox"
            name="is_active"
            value="true"
            defaultChecked={instructor.isActive}
            className="h-4 w-4 rounded border-slate-300 text-[#3b8bea] focus:ring-[#3b8bea]"
          />
          Instructor activo
        </label>
        <p className="mt-1 text-[12px] text-slate-500">
          Si se desactiva, no aparecerá disponible para asignar a clases ni citas nuevas.
        </p>
      </div>

      {msg && (
        <div
          className={
            msg.type === 'ok'
              ? 'rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700'
              : 'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700'
          }
        >
          {msg.text}
        </div>
      )}

      <div className="flex justify-end pt-2">
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
