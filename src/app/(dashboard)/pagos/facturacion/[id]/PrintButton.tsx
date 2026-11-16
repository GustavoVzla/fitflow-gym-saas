'use client'

import { Printer } from 'lucide-react'

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-[#3b8bea] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#2a6fc7]"
    >
      <Printer className="h-4 w-4" />
      Descargar PDF / Imprimir
    </button>
  )
}
