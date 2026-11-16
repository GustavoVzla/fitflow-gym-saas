import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'Inscripción', template: '%s | FitFlow' },
  robots: { index: true, follow: true },
}

export default function CompetitionPublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8 md:py-12">
        {children}
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        Powered by{' '}
        <a
          href="https://panel.example.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-slate-700 hover:text-slate-900"
        >
          FitFlow
        </a>
      </footer>
    </div>
  )
}
