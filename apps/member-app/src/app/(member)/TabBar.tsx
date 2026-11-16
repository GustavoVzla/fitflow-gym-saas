'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, Activity, MessageSquare, User } from 'lucide-react'

// 5 tabs según demo prometido a the studio 15-abr (handoff tabs-faltantes-demo).
// Pagos consolidado en /cuenta (Perfil) — accesible desde Mi cuenta › Pagos.
const tabs = [
  { href: '/inicio', label: 'Inicio', icon: Home },
  { href: '/clases', label: 'Reservar', icon: Calendar },
  { href: '/progreso', label: 'Progreso', icon: Activity },
  { href: '/chat-ia', label: 'Chat IA', icon: MessageSquare },
  { href: '/cuenta', label: 'Perfil', icon: User },
] as const

export function TabBar() {
  const pathname = usePathname()

  return (
    <nav
      className="tab-bar-blur fixed bottom-0 left-0 right-0 z-30 pb-safe"
      aria-label="Navegación principal"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 px-1">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center gap-1 px-1.5 pt-3 pb-2 text-[10px] font-medium uppercase tracking-wider transition"
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-1/2 h-[2px] w-5 -translate-x-1/2 rounded-full bg-[#3b8bea]"
                />
              )}
              <Icon
                className={
                  active
                    ? 'h-[22px] w-[22px] text-[#3b8bea] drop-shadow-[0_0_6px_rgba(59,139,234,0.4)]'
                    : 'h-[22px] w-[22px] text-[rgba(240,240,245,0.4)]'
                }
                strokeWidth={active ? 2 : 1.6}
              />
              <span
                className={
                  active
                    ? 'font-[family-name:var(--font-display)] tracking-[0.04em] text-[#3b8bea]'
                    : 'font-[family-name:var(--font-display)] tracking-[0.04em] text-[rgba(240,240,245,0.4)]'
                }
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
