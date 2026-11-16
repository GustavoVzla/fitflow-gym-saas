import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Términos y Condiciones' }

export default function TerminosPage() {
  return (
    <>
      <h1>Términos y Condiciones de Uso</h1>
      <p className="text-[rgba(240,240,245,0.5)] text-xs">Última actualización: 24 de abril de 2026</p>

      <h2>1. Identificación</h2>
      <p>
        Esta app PWA es ofrecida por <strong>Demo Company S.L.</strong> (CIF B00000000) en virtud del contrato suscrito con
        tu centro <strong>Demo Studio</strong>. Infraestructura técnica: <strong>FitFlow</strong> (sub-encargado).
      </p>

      <h2>2. Acceso y uso</h2>
      <p>
        Acceso por invitación previa de Demo Studio. Eres responsable de la confidencialidad de tus credenciales.
      </p>

      <h2>3. Reservas y cancelaciones</h2>
      <p>
        Sujetas a la política de tu centro. Cancelación tardía puede consumir sesión según plan. Consulta a recepción
        Demo Studio para detalles operativos.
      </p>

      <h2>4. Pagos</h2>
      <p>
        Pagos online vía Stripe. Cobro lo realiza Demo Studio (vía Partner Agency como agencia comercial). Reembolsos según
        política de tu centro.
      </p>

      <h2>5. Limitación de responsabilidad</h2>
      <p>
        App ofrecida &quot;tal cual&quot;. No garantizamos disponibilidad 100%. Para incidencias operativas contacta directamente a Demo Studio.
      </p>

      <h2>6. Ley aplicable</h2>
      <p>Legislación española. Jurisdicción: tribunales de Madrid.</p>

      <h2>7. Texto completo</h2>
      <p>
        <a href="https://panel.example.com/terminos" target="_blank" rel="noopener noreferrer" className="text-[#5da0ef]">
          panel.example.com/terminos →
        </a>
      </p>

      <p className="mt-8 text-xs text-[rgba(240,240,245,0.5)]">
        <Link href="/login" className="text-[#5da0ef]">← Volver al inicio</Link>
      </p>
    </>
  )
}
