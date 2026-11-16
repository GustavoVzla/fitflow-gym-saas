import { MarkdownRenderer } from '@/components/legal/markdown-renderer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Términos y Condiciones',
  description:
    'Términos de uso y condiciones contractuales del servicio FitFlow',
}

export default function TerminosPage() {
  return <MarkdownRenderer filename="TERMS_OF_SERVICE.md" />
}
