'use client'

import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import { SidebarProvider, useSidebar } from '@/components/layout/SidebarContext'
import type { PlanTier } from '@/lib/plans'

type Props = {
  children: React.ReactNode
  user: {
    email: string
    initials: string
    gymName: string
    gymLogoUrl: string | null
    gymBrandColor: string
  }
  currentPlan: PlanTier
}

function DashboardContent({
  children,
  user,
  currentPlan,
}: {
  children: React.ReactNode
  user: Props['user']
  currentPlan: PlanTier
}) {
  const { collapsed } = useSidebar()

  return (
    <div
      className="flex h-full min-h-screen bg-slate-50"
      style={{ ['--brand-color' as string]: user.gymBrandColor }}
    >
      <Sidebar
        currentPlan={currentPlan}
        gymName={user.gymName}
        gymLogoUrl={user.gymLogoUrl}
        gymBrandColor={user.gymBrandColor}
      />
      <div
        className={`flex flex-1 flex-col transition-all duration-300 ${
          collapsed ? 'pl-[72px]' : 'pl-64'
        }`}
      >
        <Topbar user={user} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}

export default function DashboardShell({ children, user, currentPlan }: Props) {
  return (
    <SidebarProvider>
      <DashboardContent user={user} currentPlan={currentPlan}>
        {children}
      </DashboardContent>
    </SidebarProvider>
  )
}
