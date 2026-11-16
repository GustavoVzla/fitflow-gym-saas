import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { WorkoutRow, DbDifficulty } from './types'
import { getTypeInfo, DIFFICULTY_MAP, normalizeExercises } from './types'

export type { WorkoutRow, DbDifficulty } from './types'

export const getWorkouts = cache(async (): Promise<WorkoutRow[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workouts')
    .select('id, name, type, description, difficulty, duration_minutes, tags, exercises, published_date, is_published, created_at')
    .order('published_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getWorkouts] error:', error)
    return []
  }

  return (data ?? []).map((w): WorkoutRow => {
    const typeInfo = getTypeInfo(w.type ?? 'custom')
    const difficulty = w.difficulty as DbDifficulty
    const exercises = normalizeExercises(w.exercises)
    return {
      id: w.id,
      name: w.name,
      type: w.type ?? 'custom',
      typeLabel: typeInfo.label,
      description: w.description,
      difficulty,
      difficultyLabel: difficulty ? DIFFICULTY_MAP[difficulty] : '',
      durationMinutes: w.duration_minutes,
      tags: Array.isArray(w.tags) ? w.tags : [],
      publishedDate: w.published_date,
      isPublished: w.is_published,
      createdAt: w.created_at,
      blocks: exercises.blocks,
      rx: exercises.rx,
      scaled: exercises.scaled,
    }
  })
})
