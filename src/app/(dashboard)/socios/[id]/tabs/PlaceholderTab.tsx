'use client'

import { Construction } from 'lucide-react'

export default function PlaceholderTab({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Construction className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-[13px] text-slate-500">{message}</p>
    </div>
  )
}
