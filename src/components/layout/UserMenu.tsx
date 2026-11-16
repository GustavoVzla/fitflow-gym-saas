'use client'

import { useState, useRef, useEffect } from 'react'
import { LogOut, User as UserIcon } from 'lucide-react'
import { logoutAction } from '@/app/(auth)/actions'

type Props = {
  initials: string
  email: string
  gymName: string
}

export default function UserMenu({ initials, email, gymName }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#3b8bea] to-[#6366f1] text-xs font-bold text-white transition-shadow hover:ring-2 hover:ring-[#3b8bea]/30 hover:ring-offset-2"
        aria-label="Menú de usuario"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{gymName}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{email}</p>
          </div>

          <div className="py-1">
            <button
              disabled
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-400"
              title="Próximamente"
            >
              <UserIcon className="h-4 w-4" />
              Mi perfil
            </button>

            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
