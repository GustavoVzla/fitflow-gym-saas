import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from './DashboardShell'
import type { PlanTier } from '@/lib/plans'

export async function generateMetadata(): Promise<Metadata> {
  try {
    const supabase = await createClient()
    const { data: gyms } = await supabase.rpc('current_user_gyms')
    const gym = gyms?.[0] as { gym_name?: string; gym_logo_url?: string | null } | undefined
    if (gym?.gym_name) {
      return {
        title: `${gym.gym_name} — Panel`,
        description: `Panel de gestión de ${gym.gym_name} — Powered by FitFlow`,
        icons: gym.gym_logo_url
          ? [{ rel: 'icon', url: gym.gym_logo_url }]
          : undefined,
      }
    }
  } catch {
    // Fallback: root metadata
  }
  return {}
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Si es super-admin, no tiene gym → va a /admin
  const { data: isAdmin } = await supabase.rpc('is_app_admin')
  if (isAdmin === true) redirect('/admin')

  // Obtener gym activo del user (M:N, tomamos el primero mientras no haya selector)
  const { data: gyms } = await supabase.rpc('current_user_gyms')

  if (!gyms || gyms.length === 0) {
    // User sin gym → mandar a flow de confirmación/onboarding
    redirect('/auth/confirm')
  }

  const activeGym = gyms[0] as {
    gym_name: string
    gym_plan: PlanTier | null
    gym_logo_url: string | null
    gym_brand_color?: string | null
  }

  const userInfo = {
    email: user.email ?? '',
    initials: (user.email ?? 'U').slice(0, 2).toUpperCase(),
    gymName: activeGym.gym_name,
    gymLogoUrl: activeGym.gym_logo_url,
    gymBrandColor: activeGym.gym_brand_color ?? '#3b8bea',
  }

  const currentPlan = (activeGym.gym_plan ?? 'base') as PlanTier

  return (
    <DashboardShell user={userInfo} currentPlan={currentPlan}>
      {children}
    </DashboardShell>
  )
}
