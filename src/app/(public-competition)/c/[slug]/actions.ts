'use server'

import { createClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/ratelimit'

export type RegistrationState = {
  error?: string
  success?: string
  waitlisted?: boolean
}

// Humanize errors Postgres (nunca leak schema internals al cliente anon)
function sanitizeServerError(raw: string): string {
  // RAISE EXCEPTION errores esperados (22023) — mensajes user-friendly directos
  const known = [
    'Nombre inválido',
    'Apellidos inválidos',
    'Email inválido',
    'Teléfono inválido',
    'Comentarios demasiado largos',
    'Competición no encontrada',
    'La competición ya ha comenzado',
    'Categoría inválida',
    'Competición llena',
  ]
  for (const k of known) {
    if (raw.includes(k)) return raw.split(' USING ')[0] // strip any HINT/DETAIL
  }
  // Default: no filtrar mensaje raw (posible schema leak). Mensaje genérico.
  return 'No se pudo procesar la inscripción. Inténtalo de nuevo o contacta con el organizador.'
}

interface RegisterInput {
  competitionSlug: string
  gymId: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  category?: string | null
  notes?: string | null
  // Honeypot: si se rellena, rechazamos (bot)
  hp?: string | null
  // Mínimo 3s entre render y submit (anti-spam básico)
  renderedAt?: string | null
}

export async function registerForCompetitionAction(
  _prev: RegistrationState,
  formData: FormData
): Promise<RegistrationState> {
  const input: RegisterInput = {
    competitionSlug: String(formData.get('competitionSlug') ?? '').trim(),
    gymId: String(formData.get('gymId') ?? '').trim(),
    firstName: String(formData.get('firstName') ?? '').trim(),
    lastName: String(formData.get('lastName') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    phone: String(formData.get('phone') ?? '').trim() || null,
    category: String(formData.get('category') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
    hp: String(formData.get('website') ?? '').trim() || null,
    renderedAt: String(formData.get('renderedAt') ?? '').trim() || null,
  }

  // Honeypot: campo `website` oculto. Si el bot lo rellena, silent fail.
  if (input.hp) {
    return { error: 'Validación fallida. Inténtalo de nuevo.' }
  }

  // Anti-spam: exigir >=3s entre render y submit
  if (input.renderedAt) {
    const renderedMs = Number(input.renderedAt)
    if (Number.isFinite(renderedMs)) {
      const elapsed = Date.now() - renderedMs
      if (elapsed < 3000) {
        return { error: 'Formulario enviado demasiado rápido. Inténtalo de nuevo.' }
      }
    }
  }

  // Rate limit por IP (scope 'api': 100 req/min — defense-in-depth vs
  // honeypot/timer). Identifier combinado `competition-register:{ip}` para
  // aislar de otros endpoints.
  const ip = await getClientIp()
  const rl = await rateLimit('api', `competition-register:${ip}`)
  if (!rl.success) {
    return {
      error: `Demasiadas inscripciones desde esta conexión. Inténtalo en ${rl.retryAfter}s.`,
    }
  }

  // Validaciones
  if (!input.firstName) return { error: 'Nombre obligatorio' }
  if (!input.lastName) return { error: 'Apellidos obligatorios' }
  if (!input.email) return { error: 'Email obligatorio' }
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(input.email)) return { error: 'Email inválido' }
  if (input.firstName.length > 100 || input.lastName.length > 100) {
    return { error: 'Nombre o apellidos demasiado largos' }
  }
  if (!input.competitionSlug || !input.gymId) {
    return { error: 'Faltan datos de la competición' }
  }

  const supabase = await createClient()

  // RPC register_for_competition_public (SECURITY DEFINER, migración 0068)
  // Tipos generados no incluyen el RPC aún tras merge
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('register_for_competition_public', {
    p_competition_slug: input.competitionSlug,
    p_gym_id: input.gymId,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_email: input.email,
    p_phone: input.phone,
    p_category: input.category,
    p_notes: input.notes,
  })

  if (error) {
    // Duplicate check constraint
    if (error.code === '23505') {
      return { error: 'Ya existe una inscripción con este email para esta competición.' }
    }
    // Sanitize: RAISE EXCEPTION mensajes user-friendly, otros errores → genérico
    return { error: sanitizeServerError(error.message) }
  }

  const row = data as Record<string, unknown> | null
  const waitlisted = Boolean(row?.waitlisted)

  return {
    success: waitlisted
      ? 'Inscripción recibida en lista de espera. Te contactaremos si se libera una plaza.'
      : 'Inscripción completada. Te hemos añadido. Revisa tu email para confirmación.',
    waitlisted,
  }
}
