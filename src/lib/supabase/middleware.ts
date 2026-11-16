import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // CRÍTICO: no poner código entre createServerClient y getUser.
  // getUser() valida el token contra Supabase Auth (más seguro que getSession).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isLegalRoute =
    pathname === '/aviso-legal' ||
    pathname === '/terminos' ||
    pathname === '/cookies' ||
    pathname === '/disclaimer' ||
    pathname === '/privacidad'

  // Rutas publicas universales (anon + auth sin role routing).
  // - Legales: accesibles desde footer de cualquier contexto.
  // - /c/{slug}: inscripcion publica a competiciones (migracion 0067-0068 PD).
  //   Debe servirse antes de role routing para que usuarios no-socios y tambien
  //   staff/admin logueado puedan compartir y previsualizar el link.
  const isUniversalPublicRoute =
    isLegalRoute || pathname.startsWith('/c/')
  if (isUniversalPublicRoute) {
    return supabaseResponse
  }

  const isPublicRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/webhooks') ||
    pathname === '/'

  // Proteger rutas privadas: si no hay user y la ruta no es pública → login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  if (user) {
    // Force change password on first login
    const mustChange = Boolean(
      (user.user_metadata as Record<string, unknown> | null)?.must_change_password
    )
    if (mustChange && !pathname.startsWith('/auth/')) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/change-password'
      return NextResponse.redirect(url)
    }

    // Determinar role del user: super-admin > tenant (gym staff) > member > nada
    const { data: isAdmin } = await supabase.rpc('is_app_admin')
    const wantsLogin = pathname === '/login' || pathname === '/signup'

    if (isAdmin === true) {
      // MFA obligatorio para super-admin (FASE 4 sesion 8).
      // Excluir las propias rutas MFA para evitar loops + /auth/* (change-password, etc).
      const onMfaRoute = pathname.startsWith('/admin/mfa/')
      const onAuthRoute = pathname.startsWith('/auth/')

      if (!onMfaRoute && !onAuthRoute) {
        const { data: factorsData } = await supabase.auth.mfa.listFactors()
        const verifiedTotp = factorsData?.totp?.find((f) => f.status === 'verified')

        if (!verifiedTotp) {
          // Super-admin sin TOTP enrolado → forzar enroll
          const url = request.nextUrl.clone()
          url.pathname = '/admin/mfa/enroll'
          return NextResponse.redirect(url)
        }

        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aalData?.currentLevel !== 'aal2') {
          // Super-admin con TOTP pero sesión solo aal1 → challenge
          const url = request.nextUrl.clone()
          url.pathname = '/admin/mfa/challenge'
          url.searchParams.set('next', pathname)
          return NextResponse.redirect(url)
        }
      }

      // Admin NO debe ver el dashboard de tenant ni login
      if (
        wantsLogin ||
        pathname === '/' ||
        pathname === '/auth/confirm' ||
        pathname.startsWith('/mi-cuenta')
      ) {
        const url = request.nextUrl.clone()
        url.pathname = '/admin'
        return NextResponse.redirect(url)
      }
    } else {
      // Check si es tenant (gym_users row activa)
      const { data: gymRows } = await supabase.rpc('current_user_gyms')
      const isTenant = Array.isArray(gymRows) && gymRows.length > 0

      if (isTenant) {
        // Tenant NO puede ver /admin ni /mi-cuenta (area socio)
        if (pathname.startsWith('/admin') || pathname.startsWith('/mi-cuenta')) {
          const url = request.nextUrl.clone()
          url.pathname = '/'
          return NextResponse.redirect(url)
        }
        if (wantsLogin) {
          const url = request.nextUrl.clone()
          url.pathname = '/'
          return NextResponse.redirect(url)
        }
      } else {
        // Check si es member (row members con auth_user_id = auth.uid())
        const { data: memberRow } = await supabase
          .from('members')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle()

        const isMember = Boolean(memberRow?.id)

        if (isMember) {
          // Member: permite /mi-cuenta y /auth, bloquea /admin y tenant routes
          const isMemberAllowed =
            pathname.startsWith('/mi-cuenta') ||
            pathname.startsWith('/auth')
          if (pathname.startsWith('/admin') || wantsLogin || pathname === '/') {
            const url = request.nextUrl.clone()
            url.pathname = '/mi-cuenta'
            return NextResponse.redirect(url)
          }
          if (!isMemberAllowed) {
            const url = request.nextUrl.clone()
            url.pathname = '/mi-cuenta'
            return NextResponse.redirect(url)
          }
        } else {
          // User autenticado pero sin gym ni member row ni admin
          // Probablemente proceso de signup incompleto — dejar pasar solo a /auth
          if (!pathname.startsWith('/auth') && !wantsLogin) {
            const url = request.nextUrl.clone()
            url.pathname = '/auth/confirm'
            return NextResponse.redirect(url)
          }
        }
      }
    }
  }

  return supabaseResponse
}
