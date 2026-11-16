import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { linkMemberAction } from '../actions'

export const dynamic = 'force-dynamic'

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string; error?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Si ya hay member linkeado, ir directo a /mi-cuenta
  const { data: existingMember } = await supabase
    .from('members')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (existingMember) {
    redirect('/mi-cuenta')
  }

  // Intento automatico de link si viene memberId en URL
  let errorMsg: string | null = params.error ?? null
  if (params.memberId) {
    const result = await linkMemberAction(params.memberId)
    if (result.error) {
      errorMsg = result.error
    } else {
      redirect('/mi-cuenta')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Bienvenido/a</h1>
        <p className="mt-3 text-sm text-slate-600">
          Tu cuenta ya está activa. Para completar la configuración, abre el enlace de invitación
          que has recibido por email.
        </p>
        {errorMsg && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </div>
        )}
        <div className="mt-6 flex gap-3">
          <Link
            href="/login"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Volver al login
          </Link>
        </div>
      </div>
    </div>
  )
}
