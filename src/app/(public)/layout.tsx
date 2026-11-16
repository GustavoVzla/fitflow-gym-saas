import type { Metadata } from 'next'
import Link from 'next/link'
import { Footer } from '@/components/layout/footer'

export const metadata: Metadata = {
  title: { default: 'Información legal', template: '%s | FitFlow' },
  robots: { index: true, follow: true },
}

const LEGAL_PAGES = [
  { href: '/aviso-legal', label: 'Aviso Legal' },
  { href: '/terminos', label: 'Términos' },
  { href: '/privacidad', label: 'Privacidad' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/disclaimer', label: 'Descargo' },
]

export default function PublicLegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="border-b border-slate-200 py-4">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/" className="font-semibold text-slate-900 mr-4">
            FitFlow
          </Link>
          {LEGAL_PAGES.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="text-slate-600 hover:text-slate-900 whitespace-nowrap"
            >
              {p.label}
            </Link>
          ))}
        </div>
      </header>
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        <article className="prose prose-slate prose-headings:scroll-mt-20 max-w-none">
          {children}
        </article>
      </main>
      <Footer />
    </div>
  )
}
