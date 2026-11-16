// NOTE: NO 'server-only' import. Fue causa raíz del incidente PR #8 (sesión 7)
// que rompió producción 30min. Seguridad garantizada porque UPSTASH_REDIS_*
// son env vars sin prefijo NEXT_PUBLIC_ (nunca se bundlean al cliente) y este
// módulo solo se importa desde Server Actions ('use server' directive).
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { headers } from 'next/headers'

/**
 * Rate limiting con Upstash Redis sliding window — aplicado desde Server
 * Actions (patron Node runtime, NO desde proxy.ts que es middleware).
 *
 * Tras el incidente PR #8 (@upstash/redis incompatible con edge-middleware
 * Next.js 16 — 30min downtime prod), Task #64 movimos el enforcement a
 * Server Actions. Ver (internal docs, not included)
 *
 * Pattern por scope:
 * - auth: 5 req/min por IP — loginAction, signupAction, reset-password
 * - ai: 20 req/h por IP — endpoints /api/ai (futuro)
 * - api: 100 req/min por IP — resto de Server Actions publicas
 *
 * Upstash falla cerrado a `allow` si URL/TOKEN faltan (evita romper dev).
 */

const hasRedisEnv =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN)

const redis = hasRedisEnv ? Redis.fromEnv() : null

const authLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      prefix: 'ratelimit:auth',
      analytics: true,
    })
  : null

const aiLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '1 h'),
      prefix: 'ratelimit:ai',
      analytics: true,
    })
  : null

const apiLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      prefix: 'ratelimit:api',
      analytics: true,
    })
  : null

export type RateLimitScope = 'auth' | 'ai' | 'api'

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  /** Seconds until the window resets. 0 if success or if Redis unavailable. */
  retryAfter: number
}

function pickLimiter(scope: RateLimitScope): Ratelimit | null {
  if (scope === 'auth') return authLimiter
  if (scope === 'ai') return aiLimiter
  return apiLimiter
}

/** Extrae IP del cliente respetando proxies (Vercel, Cloudflare) desde headers(). */
export async function getClientIp(): Promise<string> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  const real = h.get('x-real-ip')
  if (real) return real
  return 'anonymous'
}

/**
 * Aplica rate limit. Devuelve `{ success: true }` si el request está
 * permitido o si Redis no está configurado (fail-open para dev).
 *
 * Server Actions deben leer `result.success` y devolver error al usuario
 * si es `false`. Se usa `getClientIp()` internamente si no pasas identifier.
 *
 * @param scope auth | ai | api
 * @param identifier opcional — por defecto IP del cliente. Pasa userId para rate limit por usuario autenticado.
 */
export async function rateLimit(
  scope: RateLimitScope,
  identifier?: string
): Promise<RateLimitResult> {
  const limiter = pickLimiter(scope)
  if (!limiter) {
    return { success: true, limit: 0, remaining: 0, retryAfter: 0 }
  }

  const id = identifier ?? (await getClientIp())
  const key = `${scope}:${id}`

  const { success, limit, remaining, reset } = await limiter.limit(key)
  const retryAfter = success ? 0 : Math.max(0, Math.ceil((reset - Date.now()) / 1000))

  return { success, limit, remaining, retryAfter }
}
