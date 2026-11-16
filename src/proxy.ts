import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// NOTE: Rate limiting (PR #8) deshabilitado temporalmente en proxy por
// incompatibilidad de @upstash/redis con edge-middleware runtime de Next.js 16.
// El módulo src/lib/ratelimit.ts sigue disponible pero NO se carga aquí.
//
// Error observado: "Error running the exported function" en edge-middleware al
// importar @upstash/redis (APIs Node.js no disponibles en edge runtime).
//
// TODO pendiente: migrar rate limiting a una de estas opciones:
//   A) Vercel Edge Config + custom counter (sin external Redis)
//   B) Cloudflare delante con WAF rules
//   C) Rate limit per-route en Server Actions (no en middleware)
//   D) Configurar proxy.ts con runtime = 'nodejs' (si Next.js 16 lo permite)
//
// Decisión 2026-04-21: deshabilitar rate limit en proxy para restaurar producción.
// Seguridad cubierta por: Supabase Auth rate limits nativos + RLS + webhook signature.

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - archivos con extensión (.svg, .png, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
