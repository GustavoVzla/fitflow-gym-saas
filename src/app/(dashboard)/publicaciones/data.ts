import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { PostRow } from './types'
import { computeTimestampLabel, normalizeAudience, audienceLabel } from './types'

export type { PostRow } from './types'

export interface TariffOption {
  id: string
  name: string
}

export const getPosts = cache(async (): Promise<PostRow[]> => {
  const supabase = await createClient()
  // select * para leer audience column (0075) sin depender de regen types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('posts') as any)
    .select('*')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getPosts] error:', error)
    return []
  }

  const rows = (data ?? []) as Record<string, unknown>[]

  // Batch fetch tariff names para audience labels (solo si hay audiences by_tariff)
  const tariffIdSet = new Set<string>()
  rows.forEach((p) => {
    const aud = normalizeAudience(p.audience)
    if (aud.type === 'by_tariff' && aud.tariff_ids) {
      aud.tariff_ids.forEach((id) => tariffIdSet.add(id))
    }
  })

  const tariffNameById = new Map<string, string>()
  if (tariffIdSet.size > 0) {
    const { data: tariffs } = await supabase
      .from('tariffs')
      .select('id, name')
      .in('id', Array.from(tariffIdSet))
    ;(tariffs ?? []).forEach((t) => tariffNameById.set(t.id, t.name))
  }

  return rows.map((p): PostRow => {
    const aud = normalizeAudience(p.audience)
    return {
      id: p.id as string,
      title: (p.title as string | null) ?? null,
      content: (p.content as string) ?? '',
      mediaUrls: Array.isArray(p.media_urls) ? (p.media_urls as string[]) : [],
      tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
      isPublished: (p.is_published as boolean) ?? false,
      publishedAt: (p.published_at as string | null) ?? null,
      likesCount: (p.likes_count as number) ?? 0,
      commentsCount: (p.comments_count as number) ?? 0,
      createdAt: p.created_at as string,
      audience: aud,
      statusLabel: (p.is_published as boolean) ? 'Publicado' : 'Borrador',
      timestampLabel: computeTimestampLabel(
        (p.published_at as string | null) ?? null,
        p.created_at as string
      ),
      audienceLabel: audienceLabel(aud, tariffNameById),
    }
  })
})

export const getActiveTariffOptionsForPosts = cache(async (): Promise<TariffOption[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tariffs')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error || !data) return []
  return data.map((t) => ({ id: t.id, name: t.name }))
})
