import { MarkdownRenderer } from '@/components/legal/markdown-renderer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Cookies',
  description:
    'Información sobre cookies y tecnologías similares conforme al art. 22.2 LSSI-CE y Guía AEPD 2023',
}

export default function CookiesPage() {
  return <MarkdownRenderer filename="COOKIE_POLICY.md" />
}
