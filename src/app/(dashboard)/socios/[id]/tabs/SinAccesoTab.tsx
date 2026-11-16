'use client'

import { Lock } from 'lucide-react'

export default function SinAccesoTab({ reason }: { reason: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/40 px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-500">
        <Lock className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-slate-900">Sin acceso</h3>
      <p className="mx-auto mt-2 max-w-md text-[13px] text-slate-500">{reason}</p>
    </div>
  )
}
