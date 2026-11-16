import Link from 'next/link'
import { CookiePreferencesButton } from './cookie-preferences-button'

/**
 * Footer global — 5 links legales + placeholder "Preferencias de cookies".
 * El botón llama a CookieYes API runtime (vigente hasta junio 2026). Tras
 * migración a orestbida/cookieconsent, cambiar la implementación del
 * CookiePreferencesButton Client Component.
 */
export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between gap-4 text-sm text-slate-600">
        <div>
          © {new Date().getFullYear()} DEMO COMPANY, S.L. — CIF B00000000
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/aviso-legal" className="hover:text-slate-900 hover:underline">
            Aviso Legal
          </Link>
          <Link href="/terminos" className="hover:text-slate-900 hover:underline">
            Términos
          </Link>
          <Link href="/privacidad" className="hover:text-slate-900 hover:underline">
            Privacidad
          </Link>
          <Link href="/cookies" className="hover:text-slate-900 hover:underline">
            Cookies
          </Link>
          <Link href="/disclaimer" className="hover:text-slate-900 hover:underline">
            Descargo
          </Link>
          <CookiePreferencesButton />
        </nav>
      </div>
    </footer>
  )
}
