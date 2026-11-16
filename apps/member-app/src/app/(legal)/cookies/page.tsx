import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Política de Cookies' }

export default function CookiesPage() {
  return (
    <>
      <h1>Política de Cookies</h1>
      <p className="text-[rgba(240,240,245,0.5)] text-xs">Última actualización: 24 de abril de 2026</p>

      <h2>1. ¿Qué son las cookies?</h2>
      <p>
        Pequeños archivos que el navegador almacena para recordar información entre visitas. Esta app PWA usa el
        mínimo necesario para funcionar.
      </p>

      <h2>2. Cookies que usamos</h2>
      <ul>
        <li><code>sb-*-auth-token</code> — Técnica · Mantener sesión Supabase · 1 hora (refresh)</li>
        <li><code>sb-*-auth-token-code-verifier</code> — Técnica · Flujo PKCE OAuth · 10 min</li>
      </ul>

      <h2>3. Cookies de terceros</h2>
      <ul>
        <li><strong>Stripe:</strong> al iniciar pago Stripe Checkout pone cookies fraud-prevention. Ver{' '}
          <a href="https://stripe.com/cookies-policy/legal" target="_blank" rel="noopener noreferrer">política Stripe</a>.</li>
        <li><strong>Google OAuth:</strong> al usar &quot;Continuar con Google&quot; Google pone cookies de sesión propias.</li>
      </ul>

      <h2>4. Sin cookies analíticas ni de marketing</h2>
      <p>
        Esta app NO usa Google Analytics, Meta Pixel, ni tracking publicitario. Solo cookies estrictamente necesarias
        (Art. 22 LSSI excluye consentimiento previo).
      </p>

      <h2>5. Gestión</h2>
      <p>
        Borrar cookies desde configuración de tu navegador implica cerrar sesión en la app.
      </p>

      <p className="mt-8 text-xs text-[rgba(240,240,245,0.5)]">
        <Link href="/login" className="text-[#5da0ef]">← Volver al inicio</Link>
      </p>
    </>
  )
}
