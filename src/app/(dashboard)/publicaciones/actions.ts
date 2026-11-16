'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'

export type PostActionState = { error?: string; success?: string }

async function resolveActiveGymId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('current_user_gyms')
  return data && data.length > 0 ? data[0].gym_id : null
}

const postBaseSchema = z.object({
  title: z.string().trim().max(200, 'Título demasiado largo').or(z.literal('')).optional(),
  content: z.string().trim().min(1, 'El contenido es obligatorio').max(5000, 'Contenido demasiado largo (máx 5000)'),
  tags: z.string().trim().max(1000).or(z.literal('')).optional(),
  publish: z.string().optional(),
  // 0075
  mediaUrls: z.string().trim().max(2000).or(z.literal('')).optional(), // CSV de URLs
  audienceType: z.enum(['all', 'active', 'by_tariff']).or(z.literal('')).optional(),
  audienceTariffIds: z.string().trim().max(2000).or(z.literal('')).optional(), // CSV UUIDs
})

const updatePostSchema = postBaseSchema.extend({
  id: z.string().trim().uuid('ID inválido'),
})

const uuidSchema = z.string().trim().uuid('ID inválido')
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface PostAudienceJson {
  type: 'all' | 'active' | 'by_tariff'
  tariff_ids?: string[]
}

function buildFields(data: {
  title?: string
  content: string
  tags?: string
  mediaUrls?: string
  audienceType?: string
  audienceTariffIds?: string
}) {
  const title = data.title?.trim() || null
  const content = data.content
  const tagsRaw = data.tags?.trim() ?? ''
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

  // Media URLs: CSV → array (http/https only)
  const mediaRaw = data.mediaUrls?.trim() ?? ''
  const media_urls = mediaRaw
    ? mediaRaw
        .split(',')
        .map((u) => u.trim())
        .filter((u) => /^https?:\/\//i.test(u))
    : []

  // Audience
  const type = (data.audienceType && data.audienceType !== '' ? data.audienceType : 'all') as
    | 'all'
    | 'active'
    | 'by_tariff'
  const audience: PostAudienceJson = { type }
  if (type === 'by_tariff') {
    const idsRaw = data.audienceTariffIds?.trim() ?? ''
    const ids = idsRaw
      ? idsRaw.split(',').map((s) => s.trim()).filter((s) => UUID_RE.test(s))
      : []
    audience.tariff_ids = ids
  }

  return { title, content, tags, media_urls, audience }
}

export async function createPostAction(
  _prev: PostActionState,
  formData: FormData
): Promise<PostActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = postBaseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo en la sesión' }

  const publish = parsed.data.publish === 'true'
  const fields = buildFields(parsed.data)

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const authorId = userData.user?.id ?? null

  // audience (0075) puede no estar en tipos regenerados aún
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('posts') as any).insert({
    gym_id: gymId,
    author_user_id: authorId,
    ...fields,
    is_published: publish,
    published_at: publish ? new Date().toISOString() : null,
  })

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/publicaciones')
  return { success: publish ? 'Publicación publicada' : 'Guardado como borrador' }
}

export async function updatePostAction(
  _prev: PostActionState,
  formData: FormData
): Promise<PostActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = updatePostSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const fields = buildFields(parsed.data)
  const supabase = await createClient()
  // audience (0075) puede no estar en tipos regenerados aún
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('posts') as any).update(fields).eq('id', parsed.data.id)

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/publicaciones')
  return { success: 'Publicación actualizada' }
}

export async function togglePostPublishedAction(
  id: string,
  publish: boolean
): Promise<PostActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'ID requerido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('posts')
    .update({
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
    })
    .eq('id', parsed.data)

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/publicaciones')
  return { success: publish ? 'Publicación publicada' : 'Publicación despublicada' }
}

export async function deletePostAction(id: string): Promise<PostActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'ID requerido' }

  const supabase = await createClient()
  const { error } = await supabase.from('posts').delete().eq('id', parsed.data)

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/publicaciones')
  return { success: 'Publicación eliminada' }
}
