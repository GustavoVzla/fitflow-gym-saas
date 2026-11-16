'use client'

import { useState, useTransition } from 'react'
import { Heart, Lock, ShieldAlert } from 'lucide-react'
import { updateMemberHealthDataAction } from '../actions'
import type { MemberHealthData } from '../data'

const FIELD =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 shadow-sm transition-colors hover:border-slate-300 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none'
const TEXTAREA =
  'min-h-[88px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 shadow-sm transition-colors hover:border-slate-300 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none'
const LABEL = 'mb-1 block text-[12px] font-medium text-slate-600'

interface Props {
  memberId: string
  initialData: MemberHealthData
}

export default function DatosMedicosTab({ memberId, initialData }: Props) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function onSubmit(formData: FormData) {
    setMsg(null)
    startTransition(async () => {
      const res = await updateMemberHealthDataAction(memberId, formData)
      if (res.error) setMsg({ type: 'err', text: res.error })
      else setMsg({ type: 'ok', text: res.success ?? 'Guardado' })
    })
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50/40 px-4 py-3 text-[13px] text-amber-900">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">Datos sensibles — RGPD Art. 9 categoría especial</p>
            <p className="mt-0.5 text-[12px] text-amber-800">
              Esta sección sólo es visible para owner/admin del gym. Los
              instructores (trainer) <strong>no tienen acceso</strong>. Cualquier
              acceso queda registrado en audit log.
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className={LABEL}>
          <Heart className="mr-1 inline h-3.5 w-3.5 text-rose-500" />
          Notas médicas (alergias, lesiones, contraindicaciones)
        </label>
        <textarea
          name="medical_notes"
          defaultValue={initialData.medicalNotes ?? ''}
          rows={5}
          placeholder="Ej: Asma controlada con inhalador. Lesión rodilla derecha — evitar impactos."
          className={TEXTAREA + ' w-full'}
        />
      </div>

      <div>
        <label className={LABEL}>
          <Lock className="mr-1 inline h-3.5 w-3.5 text-slate-500" />
          Información médica estructurada (JSON, opcional)
        </label>
        <textarea
          name="medical_info_json"
          defaultValue={initialData.medicalInfoJson ?? ''}
          rows={6}
          placeholder='{"alergias": ["polen"], "medicacion": [{"nombre": "Ventolin", "dosis": "PRN"}]}'
          className={TEXTAREA + ' w-full font-mono text-[12px]'}
        />
        <p className="mt-1 text-[11px] text-slate-500">
          Schema libre. Útil si integras con software médico externo. Deja vacío si no aplica.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-[12px] font-semibold text-slate-700">Consentimientos</p>
        <label className="flex items-start gap-2 text-[13px] text-slate-700">
          <input
            type="checkbox"
            name="image_consent"
            value="true"
            defaultChecked={initialData.imageConsent}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#3b8bea] focus:ring-[#3b8bea]"
          />
          <span>
            Consiente uso de su <strong>imagen</strong> en redes sociales / web del gym.
          </span>
        </label>
        <label className="flex items-start gap-2 text-[13px] text-slate-700">
          <input
            type="checkbox"
            name="marketing_consent"
            value="true"
            defaultChecked={initialData.marketingConsent}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#3b8bea] focus:ring-[#3b8bea]"
          />
          <span>
            Consiente recibir comunicaciones <strong>comerciales</strong> (newsletter, promociones).
          </span>
        </label>
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

      <div className="flex items-center justify-between pt-2 text-[11px] text-slate-500">
        <span>
          {initialData.updatedAt
            ? `Actualizado: ${new Date(initialData.updatedAt).toLocaleString('es-ES')}`
            : 'Sin guardar todavía'}
        </span>
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-lg bg-[#3b8bea] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#2a6fc7] disabled:opacity-60"
        >
          {pending ? 'Guardando…' : 'Guardar datos médicos'}
        </button>
      </div>
    </form>
  )
}
