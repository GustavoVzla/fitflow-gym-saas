import ConfiguracionClient from './ConfiguracionClient'
import { getGymProfile, getGymSettings, getCurrentUserInfo } from './data'
import { getSeenTourKeys } from '@/lib/tours-data'

type Tab = 'perfil' | 'web-publica' | 'fiscales' | 'reservas' | 'pagos' | 'notificaciones'

const VALID_TABS: Tab[] = ['perfil', 'web-publica', 'fiscales', 'reservas', 'pagos', 'notificaciones']

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const [{ tab }, profile, settings, user, seenTourKeys] = await Promise.all([
    searchParams,
    getGymProfile(),
    getGymSettings(),
    getCurrentUserInfo(),
    getSeenTourKeys(),
  ])

  if (!profile || !user) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <p className="text-sm text-slate-500">No se pudo cargar la configuración del gym.</p>
      </div>
    )
  }

  const initialTab: Tab = VALID_TABS.includes(tab as Tab) ? (tab as Tab) : 'perfil'

  return (
    <ConfiguracionClient
      initialProfile={profile}
      initialSettings={settings}
      user={user}
      seenTourKeys={seenTourKeys}
      initialTab={initialTab}
    />
  )
}
