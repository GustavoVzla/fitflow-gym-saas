// Tipos compartidos server/client. Sin imports server-only.

export type DbDifficulty = 'beginner' | 'intermediate' | 'advanced' | null

export type UiDifficulty = 'Principiante' | 'Intermedio' | 'Avanzado' | ''

export type WorkoutTypeValue = 'amrap' | 'emom' | 'tabata' | 'custom' | 'strength' | 'hiit'

export type WorkoutBlockType = 'warmup' | 'main' | 'cooldown'

export interface WorkoutBlock {
  type: WorkoutBlockType
  description: string
  durationMinutes: number | null
}

/** Estructura del JSONB `workouts.exercises`. Flexible — si viene string/array legado se normaliza. */
export interface WorkoutExercisesJson {
  blocks: WorkoutBlock[]
  rx: string | null
  scaled: string | null
}

export interface WorkoutRow {
  id: string
  name: string
  type: string // raw DB string
  typeLabel: string
  description: string | null
  difficulty: DbDifficulty
  difficultyLabel: UiDifficulty
  durationMinutes: number | null
  tags: string[]
  publishedDate: string | null
  isPublished: boolean
  createdAt: string
  // Estructurado JSONB
  blocks: WorkoutBlock[]
  rx: string | null
  scaled: string | null
}

export const BLOCK_LABELS: Record<WorkoutBlockType, string> = {
  warmup: 'Warm-up',
  main: 'WOD principal',
  cooldown: 'Cool-down',
}

export const BLOCK_ORDER: WorkoutBlockType[] = ['warmup', 'main', 'cooldown']

/** Normaliza el JSONB exercises legacy → estructura tipada. */
export function normalizeExercises(raw: unknown): WorkoutExercisesJson {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { blocks: [], rx: null, scaled: null }
  }
  const obj = raw as Record<string, unknown>
  const blocksRaw = Array.isArray(obj.blocks) ? obj.blocks : []
  const blocks: WorkoutBlock[] = blocksRaw
    .map((b): WorkoutBlock | null => {
      if (!b || typeof b !== 'object') return null
      const bb = b as Record<string, unknown>
      const t = bb.type as string
      if (t !== 'warmup' && t !== 'main' && t !== 'cooldown') return null
      const description = typeof bb.description === 'string' ? bb.description : ''
      const dur =
        typeof bb.durationMinutes === 'number'
          ? bb.durationMinutes
          : typeof bb.duration_minutes === 'number'
            ? bb.duration_minutes
            : null
      return { type: t as WorkoutBlockType, description, durationMinutes: dur }
    })
    .filter((b): b is WorkoutBlock => b !== null)

  return {
    blocks,
    rx: typeof obj.rx === 'string' ? obj.rx : null,
    scaled: typeof obj.scaled === 'string' ? obj.scaled : null,
  }
}

export const TYPE_OPTIONS: Array<{ value: string; label: string; color: string }> = [
  { value: 'amrap', label: 'AMRAP', color: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  { value: 'emom', label: 'EMOM', color: 'bg-amber-100 text-amber-700 ring-amber-200' },
  { value: 'tabata', label: 'Tabata', color: 'bg-purple-100 text-purple-700 ring-purple-200' },
  { value: 'hiit', label: 'HIIT', color: 'bg-red-100 text-red-700 ring-red-200' },
  { value: 'strength', label: 'Fuerza', color: 'bg-blue-100 text-blue-700 ring-blue-200' },
  { value: 'custom', label: 'Custom', color: 'bg-slate-100 text-slate-700 ring-slate-200' },
]

export function getTypeInfo(type: string): { label: string; color: string } {
  const found = TYPE_OPTIONS.find((t) => t.value === type)
  return found
    ? { label: found.label, color: found.color }
    : { label: type, color: 'bg-slate-100 text-slate-700 ring-slate-200' }
}

export const DIFFICULTY_MAP: Record<Exclude<DbDifficulty, null>, UiDifficulty> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
}

export const DIFFICULTY_REVERSE: Record<Exclude<UiDifficulty, ''>, Exclude<DbDifficulty, null>> = {
  Principiante: 'beginner',
  Intermedio: 'intermediate',
  Avanzado: 'advanced',
}

export const DIFFICULTY_STYLES: Record<UiDifficulty, string> = {
  '': 'bg-slate-50 text-slate-500 ring-slate-200',
  Principiante: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Intermedio: 'bg-amber-50 text-amber-700 ring-amber-200',
  Avanzado: 'bg-red-50 text-red-600 ring-red-200',
}

export function formatPublishedDate(iso: string | null): string {
  if (!iso) return 'Sin publicar'
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}
