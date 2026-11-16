import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MemberShell } from './MemberShell'

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verificar que es member linkeado
  const { data: member } = await supabase
    .from('members')
    .select('id, first_name, last_name, email, gym_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!member) {
    // Puede haber llegado aqui por magic link pero sin link_member_auth_user ejecutado todavia
    // /mi-cuenta/welcome se encarga de eso. Resto de rutas member: redirigir a welcome
    redirect('/mi-cuenta/welcome')
  }

  return (
    <MemberShell
      memberName={`${member.first_name} ${member.last_name}`.trim()}
      memberEmail={member.email ?? user.email ?? ''}
    >
      {children}
    </MemberShell>
  )
}
