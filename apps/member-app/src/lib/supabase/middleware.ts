import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@fitflow/types/database'

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Public: login + auth callback + offline + sw assets + manifest + legal
  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname === '/offline' ||
    pathname === '/manifest.webmanifest' ||
    pathname.startsWith('/sw.js') ||
    pathname.startsWith('/icons/') ||
    pathname === '/privacidad' ||
    pathname === '/terminos' ||
    pathname === '/cookies' ||
    pathname === '/aviso-legal' ||
    pathname === '/icon' ||
    pathname.startsWith('/icon-') ||
    pathname.startsWith('/apple-icon') ||
    pathname === '/favicon.ico'  

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    if (pathname !== '/') url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  if (user) {
    // Auth user → debe ser miembro de un gym (members.auth_user_id = auth.uid()).
    // Si no, está en proceso de signup (welcome) o no es socio de este gym.
    const { data: memberRow } = await supabase
      .from('members')
      .select('id, gym_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    const isMember = Boolean(memberRow?.id)
    const onLogin = pathname === '/login'
    const onWelcome = pathname.startsWith('/auth/welcome')

    if (isMember) {
      // Member ya vinculado: bloquea /login, deja entrar al resto
      if (onLogin || onWelcome) {
        const url = request.nextUrl.clone()
        url.pathname = '/inicio'
        return NextResponse.redirect(url)
      }
      // Si va al raíz, redirigir al inicio
      if (pathname === '/') {
        const url = request.nextUrl.clone()
        url.pathname = '/inicio'
        return NextResponse.redirect(url)
      }
    } else {
      // Auth user sin row member: probablemente magic link recién consumido,
      // espera a que /auth/welcome ejecute link_member_auth_user RPC.
      if (!onWelcome && !pathname.startsWith('/auth') && !onLogin) {
        const url = request.nextUrl.clone()
        url.pathname = '/auth/welcome'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
