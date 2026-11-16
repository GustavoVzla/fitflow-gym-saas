'use client'

import Link from 'next/link'
import { useState } from 'react'
import { signOutAction } from './actions'

export function MemberShell({
  memberName,
  memberEmail,
  children,
}: {
  memberName: string
  memberEmail: string
  children: React.ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/mi-cuenta" className="text-lg font-semibold text-slate-900">
            Mi cuenta
          </Link>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900"
            >
              <span className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-medium">
                {memberName.charAt(0).toUpperCase() || 'S'}
              </span>
              <span className="hidden sm:inline">{memberName || memberEmail}</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg py-2 z-10">
                <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100">
                  {memberEmail}
                </div>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Cerrar sesión
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
