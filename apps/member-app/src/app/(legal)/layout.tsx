import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: { default: 'Información legal', template: '%s · Demo Studio' },
  robots: { index: true, follow: true },
}

const LEGAL_PAGES = [
  { href: '/privacidad', label: 'Privacidad' },
  { href: '/terminos', label: 'Términos' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/aviso-legal', label: 'Aviso Legal' },
]

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0d0d1a] text-[#f0f0f5]">
      <header className="border-b border-[rgba(255,255,255,0.08)] bg-[#1a1a2e]/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-3.5">
          <Link href="/login" className="text-[rgba(240,240,245,0.6)] hover:text-[#f0f0f5]" aria-label="Volver">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <span className="font-semibold text-[#f0f0f5]">Demo Studio</span>
        </div>
        <nav className="mx-auto flex max-w-2xl flex-wrap gap-x-4 gap-y-2 px-5 pb-3 text-xs">
          {LEGAL_PAGES.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="text-[rgba(240,240,245,0.55)] hover:text-[#5da0ef] whitespace-nowrap"
            >
              {p.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-8">
        <article className="prose prose-invert prose-sm max-w-none">
          {children}
        </article>
      </main>
      <footer className="border-t border-[rgba(255,255,255,0.08)] py-6 text-center text-[11px] text-[rgba(240,240,245,0.4)]">
        Demo Studio · Powered by FitFlow · FitFlow × Partner Agency
      </footer>
    </div>
  )
}
