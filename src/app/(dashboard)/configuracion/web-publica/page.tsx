import ConfiguracionClient from '../ConfiguracionClient'
import { getGymProfile, getGymSettings, getCurrentUserInfo } from '../data'
import { getSeenTourKeys } from '@/lib/tours-data'

export const dynamic = 'force-dynamic'

export default async function ConfiguracionWebPublicaPage() {
  const [profile, settings, user, seenTourKeys] = await Promise.all([
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

  return (
    <ConfiguracionClient
      initialProfile={profile}
      initialSettings={settings}
      user={user}
      seenTourKeys={seenTourKeys}
      initialTab="web-publica"
    />
  )
}
