import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TabBar } from './TabBar'
import { studioBrand } from '../theme'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { getViewerContext } from '@/lib/viewer'

/**
 * Layout (member) — soporta socios y trainers.
 *
 * Antes: redirige a /auth/welcome si no hay row en `members`. Esto bloqueaba
 * a los trainers (Alex/Sam/Jordan) porque solo tienen `instructors` row.
 *
 * Ahora: `getViewerContext()` resuelve member|trainer|unknown.
 * - `unknown` (auth user pero sin member ni instructor) → /auth/welcome
 * - `member` o `trainer` → renderiza layout completo
 *
 * Trainers ven la TabBar igual que socios pero las rutas member-only
 * (/clases reservar, /pagos, /progreso) se renderizan vacías o con notice
 * — esas páginas son responsabilidad propia de cada `page.tsx` cuando se
 * extiendan a trainer. Esta capa solo desbloquea el acceso.
 */
export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const viewer = await getViewerContext()

  if (!viewer) {
    redirect('/login')
  }

  if (viewer.type === 'unknown') {
    redirect('/auth/welcome')
  }

  const greetingName = viewer.firstName || (viewer.type === 'trainer' ? 'entrenador' : 'socio')
  const initial = (viewer.firstName?.charAt(0) || 'S').toUpperCase()

  return (
    <div className="min-h-screen bg-[#0d0d1a] text-[#f0f0f5]">
      <header className="sticky top-0 z-30 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(13,13,26,0.85)] backdrop-blur-xl pt-safe">
        <div className="mx-auto flex max-w-md items-center justify-between px-6 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(240,240,245,0.4)]">
              {studioBrand.name}
            </p>
            <h1 className="mt-0.5 font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-[#f0f0f5]">
              Hola, {greetingName}
            </h1>
          </div>
          <Link
            href="/cuenta"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(59,139,234,0.15)] text-sm font-semibold uppercase text-[#5da0ef] ring-1 ring-[rgba(59,139,234,0.25)] transition hover:bg-[rgba(59,139,234,0.25)] hover:ring-[rgba(59,139,234,0.4)]"
            aria-label="Mi cuenta"
          >
            {initial}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 pb-28 pt-6">{children}</main>

      <TabBar />
      <InstallPrompt />
    </div>
  )
}
