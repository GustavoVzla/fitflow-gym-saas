// Tipos compartidos server/client. Sin imports server-only.

// 0075_pd_posts_audience
export type PostAudienceType = 'all' | 'active' | 'by_tariff'

export interface PostAudience {
  type: PostAudienceType
  tariff_ids?: string[]
}

export const AUDIENCE_LABELS: Record<PostAudienceType, string> = {
  all: 'Todos los socios',
  active: 'Solo socios activos',
  by_tariff: 'Tarifas específicas',
}

export const AUDIENCE_OPTIONS: PostAudienceType[] = ['all', 'active', 'by_tariff']

export interface PostRow {
  id: string
  title: string | null
  content: string
  mediaUrls: string[]
  tags: string[]
  isPublished: boolean
  publishedAt: string | null
  likesCount: number
  commentsCount: number
  createdAt: string
  // 0075
  audience: PostAudience
  // Computados
  statusLabel: 'Publicado' | 'Borrador'
  timestampLabel: string
  audienceLabel: string
}

export function normalizeAudience(raw: unknown): PostAudience {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { type: 'all' }
  }
  const obj = raw as Record<string, unknown>
  const t = obj.type as string
  if (t === 'all' || t === 'active') return { type: t }
  if (t === 'by_tariff') {
    const ids = Array.isArray(obj.tariff_ids) ? (obj.tariff_ids as unknown[]) : []
    const tariff_ids = ids.filter((x): x is string => typeof x === 'string')
    return { type: 'by_tariff', tariff_ids }
  }
  return { type: 'all' }
}

export function audienceLabel(aud: PostAudience, tariffNameById: Map<string, string>): string {
  if (aud.type === 'all') return AUDIENCE_LABELS.all
  if (aud.type === 'active') return AUDIENCE_LABELS.active
  if (aud.type === 'by_tariff') {
    const ids = aud.tariff_ids ?? []
    if (ids.length === 0) return 'Tarifas específicas (sin seleccionar)'
    if (ids.length === 1) return tariffNameById.get(ids[0]!) ?? '1 tarifa'
    return `${ids.length} tarifas`
  }
  return AUDIENCE_LABELS.all
}

export const STATUS_STYLES: Record<PostRow['statusLabel'], string> = {
  Publicado: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Borrador: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function computeTimestampLabel(publishedAt: string | null, createdAt: string): string {
  const iso = publishedAt ?? createdAt
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Ahora'
  if (diffMin < 60) return `Hace ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `Hace ${diffH} h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `Hace ${diffD} d`
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}
