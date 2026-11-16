import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  const next = url.searchParams.get('next') ?? '/inicio'

  const supabase = await createClient()

  // Magic link puede llegar como ?code= (PKCE) o ?token_hash= (legacy)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL('/auth/welcome?next=' + encodeURIComponent(next), url.origin))
    }
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
    )
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as 'magiclink' | 'recovery' | 'invite' | 'email',
      token_hash: tokenHash,
    })
    if (!error) {
      return NextResponse.redirect(new URL('/auth/welcome?next=' + encodeURIComponent(next), url.origin))
    }
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
    )
  }

  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent('Enlace incompleto')}`, url.origin)
  )
}
