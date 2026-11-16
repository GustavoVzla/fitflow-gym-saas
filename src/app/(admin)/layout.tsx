import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AdminSignoutButton from './AdminSignoutButton'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirect=/admin')

  const { data: isAdmin } = await supabase.rpc('is_app_admin')
  if (isAdmin !== true) redirect('/')

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900">
                FitFlow · Backoffice
              </h1>
              <p className="text-[11px] text-slate-500">Panel super-admin FitFlow</p>
            </div>
            <nav className="hidden items-center gap-1 md:flex">
              <Link
                href="/admin"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                Dashboard
              </Link>
              <Link
                href="/admin/gyms"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                Gyms
              </Link>
              <Link
                href="/admin/new-gym"
                className="rounded-lg bg-[#3b8bea] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2a6fc7]"
              >
                + Nueva cuenta
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 md:inline">{user.email}</span>
            <AdminSignoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
