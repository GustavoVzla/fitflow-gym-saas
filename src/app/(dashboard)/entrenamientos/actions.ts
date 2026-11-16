'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'
import type { DbDifficulty, WorkoutBlock, WorkoutBlockType, WorkoutExercisesJson } from './types'
import { DIFFICULTY_REVERSE, type UiDifficulty } from './types'

export type WorkoutActionState = { error?: string; success?: string }

async function resolveActiveGymId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('current_user_gyms')
  return data && data.length > 0 ? data[0].gym_id : null
}

const VALID_TYPES = ['amrap', 'emom', 'tabata', 'custom', 'hiit', 'strength']
const VALID_UI_DIFFICULTIES: UiDifficulty[] = ['Principiante', 'Intermedio', 'Avanzado']
const uuidSchema = z.string().trim().uuid('ID inválido')

const VALID_BLOCK_TYPES: WorkoutBlockType[] = ['warmup', 'main', 'cooldown']

function parseBlocksFromFormData(formData: FormData): WorkoutBlock[] {
  // Campos serializados: blocks_warmup_desc, blocks_warmup_dur, blocks_main_desc, blocks_main_dur, blocks_cooldown_desc, blocks_cooldown_dur
  const blocks: WorkoutBlock[] = []
  for (const type of VALID_BLOCK_TYPES) {
    const desc = String(formData.get(`blocks_${type}_desc`) ?? '').trim()
    if (!desc) continue
    const durStr = String(formData.get(`blocks_${type}_dur`) ?? '').trim()
    const dur = durStr ? Number(durStr) : null
    blocks.push({
      type,
      description: desc.slice(0, 2000),
      durationMinutes: dur != null && Number.isFinite(dur) && dur >= 0 ? dur : null,
    })
  }
  return blocks
}

function parseAndValidate(formData: FormData):
  | { error: string }
  | {
      name: string
      type: string
      description: string | null
      difficulty: DbDifficulty
      duration_minutes: number | null
      tags: string[]
      exercises: WorkoutExercisesJson
    } {
  const name = String(formData.get('name') ?? '').trim()
  const type = String(formData.get('type') ?? 'custom').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  const difficultyUi = String(formData.get('difficulty') ?? '').trim()
  const durationStr = String(formData.get('durationMinutes') ?? '').trim()
  const tagsRaw = String(formData.get('tags') ?? '').trim()
  const rx = String(formData.get('rx') ?? '').trim() || null
  const scaled = String(formData.get('scaled') ?? '').trim() || null

  if (!name) return { error: 'El nombre es obligatorio' }
  if (name.length > 200) return { error: 'Nombre demasiado largo' }
  if (!VALID_TYPES.includes(type)) return { error: 'Tipo inválido' }

  let difficulty: DbDifficulty = null
  if (difficultyUi) {
    if (!VALID_UI_DIFFICULTIES.includes(difficultyUi as UiDifficulty)) {
      return { error: 'Dificultad inválida' }
    }
    difficulty = DIFFICULTY_REVERSE[difficultyUi as Exclude<UiDifficulty, ''>]
  }

  let duration_minutes: number | null = null
  if (durationStr) {
    const n = Number(durationStr)
    if (!Number.isInteger(n) || n < 1) return { error: 'Duración inválida' }
    duration_minutes = n
  }

  const tags = tagsRaw
    ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
    : []

  const blocks = parseBlocksFromFormData(formData)
  if (rx && rx.length > 2000) return { error: 'RX description demasiado larga (máx 2000)' }
  if (scaled && scaled.length > 2000) return { error: 'Scaled description demasiado larga (máx 2000)' }

  const exercises: WorkoutExercisesJson = { blocks, rx, scaled }

  return { name, type, description, difficulty, duration_minutes, tags, exercises }
}

export async function createWorkoutAction(
  _prev: WorkoutActionState,
  formData: FormData
): Promise<WorkoutActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const result = parseAndValidate(formData)
  if ('error' in result) return { error: result.error }

  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo en la sesión' }

  const publish = formData.get('publish') === 'true'

  const supabase = await createClient()
  // exercises ahora es WorkoutExercisesJson estructurado (blocks + rx + scaled)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('workouts') as any).insert({
    gym_id: gymId,
    ...result,
    is_published: publish,
    published_date: publish ? new Date().toISOString().slice(0, 10) : null,
  })

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/entrenamientos')
  return { success: publish ? 'Entrenamiento publicado' : 'Entrenamiento creado como borrador' }
}

export async function updateWorkoutAction(
  _prev: WorkoutActionState,
  formData: FormData
): Promise<WorkoutActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const idParsed = uuidSchema.safeParse(String(formData.get('id') ?? ''))
  if (!idParsed.success) return { error: 'ID inválido' }

  const result = parseAndValidate(formData)
  if ('error' in result) return { error: result.error }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('workouts') as any).update(result).eq('id', idParsed.data)

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/entrenamientos')
  return { success: 'Entrenamiento actualizado' }
}

export async function toggleWorkoutPublishedAction(
  id: string,
  publish: boolean
): Promise<WorkoutActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('workouts')
    .update({
      is_published: publish,
      published_date: publish ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq('id', parsed.data)

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/entrenamientos')
  return { success: publish ? 'Entrenamiento publicado' : 'Entrenamiento despublicado' }
}
