import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * /auth/callback — handler unificado para ambos flujos de Supabase Auth:
 *
 *  1. **OAuth (Google, etc.)** — Supabase redirige con `?code=<authorization_code>`.
 *     Se intercambia por sesión via `exchangeCodeForSession(code)`.
 *
 *  2. **OTP email** — links de email confirm, magic link, password recovery,
 *     invite. Supabase envía `?token_hash=...&type=<tipo>`. Se verifica via
 *     `verifyOtp({ token_hash, type })`.
 *
 *  El tipo de flow se detecta por los query params presentes. Si ninguno
 *  válido → redirect a /login con error.
 *
 *  Respeta `?next=<ruta>` en ambos flujos para redirect post-auth. Sanitiza
 *  `next` para prevenir open redirect (solo rutas internas).
 *
 *  Comportamiento host detrás de LB (x-forwarded-host) sigue patrón oficial
 *  Supabase Next.js SSR docs.
 *
 *  Fix: bug regresión detectado 2026-04-22 — Google OAuth devolvía
 *  invalid_link porque el handler solo procesaba OTP. Docs oficiales:
 *  https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as
    | 'signup'
    | 'email'
    | 'recovery'
    | 'invite'
    | 'magiclink'
    | null

  // Sanitiza next: solo rutas internas para prevenir open redirect.
  const nextRaw = searchParams.get('next') ?? '/auth/confirm'
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/auth/confirm'

  // Redirect helper: respeta x-forwarded-host (prod detrás de load balancer).
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'
  function redirectTo(path: string): NextResponse {
    if (isLocalEnv || !forwardedHost) {
      return NextResponse.redirect(`${origin}${path}`)
    }
    return NextResponse.redirect(`https://${forwardedHost}${path}`)
  }

  const supabase = await createClient()

  // Flow 1 — OAuth (Google, etc.)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return redirectTo(`/login?error=${encodeURIComponent(error.message)}`)
    }
    return redirectTo(next)
  }

  // Flow 2 — OTP email (signup confirm, magic link, recovery, invite)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (error) {
      return redirectTo(`/login?error=${encodeURIComponent(error.message)}`)
    }
    return redirectTo(next)
  }

  // Ningún flow válido
  return redirectTo('/login?error=invalid_link')
}
