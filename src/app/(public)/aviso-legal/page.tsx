import { MarkdownRenderer } from '@/components/legal/markdown-renderer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Aviso Legal',
  description:
    'Información legal del titular de FitFlow conforme al art. 10 LSSI-CE',
}

export default function AvisoLegalPage() {
  return <MarkdownRenderer filename="AVISO_LEGAL.md" />
}
