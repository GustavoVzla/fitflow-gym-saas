import { MarkdownRenderer } from '@/components/legal/markdown-renderer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description:
    'Política de Privacidad de FitFlow — tratamiento de datos personales conforme al RGPD y LOPDGDD',
}

export default function PrivacidadPage() {
  return <MarkdownRenderer filename="PRIVACY_POLICY.md" />
}
