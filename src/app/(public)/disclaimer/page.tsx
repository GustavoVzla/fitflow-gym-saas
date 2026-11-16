import { MarkdownRenderer } from '@/components/legal/markdown-renderer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Descargo de Responsabilidad',
  description:
    'Limitaciones de responsabilidad conforme al art. 1105 CC y art. 16 LSSI-CE',
}

export default function DisclaimerPage() {
  return <MarkdownRenderer filename="DISCLAIMER.md" />
}
