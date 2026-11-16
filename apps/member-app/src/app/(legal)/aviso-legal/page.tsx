import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Aviso Legal' }

export default function AvisoLegalPage() {
  return (
    <>
      <h1>Aviso Legal</h1>
      <p className="text-[rgba(240,240,245,0.5)] text-xs">Última actualización: 24 de abril de 2026</p>

      <h2>Datos identificativos del titular</h2>
      <ul>
        <li><strong>Razón social:</strong> Demo Company S.L.</li>
        <li><strong>CIF:</strong> B00000000</li>
        <li><strong>Domicilio:</strong> Madrid, España</li>
        <li><strong>Registro Mercantil:</strong> Tomo 33.481, Folio 164, Sección 8, Hoja M-602713</li>
        <li><strong>Email:</strong> <a href="mailto:legal@example.com">legal@example.com</a></li>
      </ul>

      <h2>Sub-encargado tecnológico</h2>
      <ul>
        <li><strong>FitFlow</strong> (PO )</li>
        <li><strong>Email técnico:</strong> <a href="mailto:soluciones@example.com">soluciones@example.com</a></li>
        <li><strong>Email RGPD:</strong> <a href="mailto:privacidad@example.com">privacidad@example.com</a></li>
      </ul>

      <h2>Centro deportivo</h2>
      <p>
        App de socio para <strong>Demo Studio</strong> (Calle Ejemplo 1, 28001 Madrid. Para incidencias
        operativas (clases, reservas) contacta directamente al centro.
      </p>

      <h2>Propiedad intelectual</h2>
      <p>
        Código fuente: FitFlow × Partner Agency. Marca Demo Studio y sus contenidos: propiedad de Demo Studio.
      </p>

      <h2>Texto completo</h2>
      <p>
        <a href="https://panel.example.com/aviso-legal" target="_blank" rel="noopener noreferrer" className="text-[#5da0ef]">
          panel.example.com/aviso-legal →
        </a>
      </p>

      <p className="mt-8 text-xs text-[rgba(240,240,245,0.5)]">
        <Link href="/login" className="text-[#5da0ef]">← Volver al inicio</Link>
      </p>
    </>
  )
}
