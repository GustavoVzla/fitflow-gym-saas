import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Política de Privacidad' }

export default function PrivacidadPage() {
  return (
    <>
      <h1>Política de Privacidad</h1>
      <p className="text-[rgba(240,240,245,0.5)] text-xs">Última actualización: 24 de abril de 2026</p>

      <h2>1. Responsable del tratamiento</h2>
      <p>
        Los datos personales que tratamos en esta aplicación son responsabilidad de{' '}
        <strong>Demo Company S.L.</strong> (CIF B00000000, Madrid), que actúa como responsable contractual frente a tu gimnasio
        Demo Studio. <strong>FitFlow</strong> actúa como sub-encargado del tratamiento.
      </p>

      <h2>2. Datos que tratamos</h2>
      <ul>
        <li><strong>Identidad y contacto:</strong> nombre, email, teléfono.</li>
        <li><strong>Membresía:</strong> número de socio, tarifa, historial de reservas y asistencia.</li>
        <li><strong>Pagos:</strong> historial de cobros (NO datos de tarjeta — los procesa Stripe).</li>
        <li><strong>Técnicos:</strong> IP, user-agent, cookies de sesión.</li>
      </ul>

      <h2>3. Finalidad y base legal</h2>
      <p>
        Tratamos tus datos para <strong>ejecutar el contrato</strong> (Art. 6.1.b RGPD) entre tú y Demo Studio.
        NO usamos tus datos para marketing sin tu consentimiento expreso.
      </p>

      <h2>4. Conservación</h2>
      <p>Mientras seas socio activo + 5 años post-baja por obligaciones fiscales (Ley 58/2003 General Tributaria).</p>

      <h2>5. Derechos RGPD</h2>
      <p>
        Acceso, rectificación, supresión, portabilidad, oposición, limitación enviando email a{' '}
        <a href="mailto:privacidad@example.com">privacidad@example.com</a> o reclamando ante la AEPD (
        <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">www.aepd.es</a>).
      </p>

      <h2>6. Encargados del tratamiento</h2>
      <ul>
        <li><strong>Supabase Inc.</strong> (BD, EU region · DPA firmado)</li>
        <li><strong>Vercel Inc.</strong> (hosting · SCC firmadas)</li>
        <li><strong>Stripe Payments Europe Ltd.</strong> (pagos · DPA propio)</li>
        <li><strong>Google LLC</strong> (Workspace SMTP + OAuth · SCC firmadas)</li>
      </ul>

      <h2>7. Texto completo</h2>
      <p>
        Versión completa con cláusulas legales detalladas:{' '}
        <a href="https://panel.example.com/privacidad" target="_blank" rel="noopener noreferrer" className="text-[#5da0ef]">
          panel.example.com/privacidad →
        </a>
      </p>

      <p className="mt-8 text-xs text-[rgba(240,240,245,0.5)]">
        <Link href="/login" className="text-[#5da0ef]">← Volver al inicio</Link>
      </p>
    </>
  )
}
