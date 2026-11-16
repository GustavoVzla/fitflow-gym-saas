import { getAvisoTemplates, getRecentDispatches } from './data'
import AvisosClient from './AvisosClient'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [templates, dispatches] = await Promise.all([
    getAvisoTemplates(),
    getRecentDispatches(24),
  ])

  return <AvisosClient initialTemplates={templates} initialDispatches={dispatches} />
}
