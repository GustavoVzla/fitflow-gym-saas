'use client'

import { Trophy, Tag } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import PremiumSection from './PremiumSection'

/**
 * Client Component wrapper used by Server Component gated pages
 * (`/competiciones`, `/ofertas`) to render the rich `PremiumSection`
 * upgrade banner.
 *
 * Why wrapper (not direct PremiumSection):
 * Passing `icon={Trophy}` as a prop from a Server Component to a Client
 * Component (PremiumSection) crosses the RSC boundary. Next.js 16 turbopack
 * build failed on this serialization 4 times in PR #29 session 9.
 *
 * Fix: receive `iconKey` as a plain **string** (serializable), resolve to
 * Component reference **inside** this Client Component. The icon never
 * crosses the server→client boundary as a React reference — only the
 * string does.
 *
 * Pattern mirrors how `/chatbot-ia/page.tsx` uses PremiumSection directly
 * (it's `'use client'` from line 1, so no boundary crossed either).
 */

type FeatureIcon = 'trophy' | 'tag'

const ICONS: Record<FeatureIcon, ComponentType<SVGProps<SVGSVGElement>>> = {
  trophy: Trophy,
  tag: Tag,
}

interface PreviewCard {
  title: string
  body: string
}

interface Props {
  title: string
  subtitle: string
  iconKey: FeatureIcon
  benefits: string[]
  preview: PreviewCard[]
}

export default function LockedFeatureBanner({
  title,
  subtitle,
  iconKey,
  benefits,
  preview,
}: Props) {
  const Icon = ICONS[iconKey]
  return (
    <PremiumSection
      title={title}
      subtitle={subtitle}
      plan="Pro"
      icon={Icon}
      benefits={benefits}
      preview={preview}
      availability="Disponible al hacer upgrade al plan Pro"
    />
  )
}
