import PotencialesClient from './PotencialesClient'
import { getProspects, getActiveTariffs } from './data'

export const dynamic = 'force-dynamic'

export default async function PotencialesPage() {
  const [prospects, tariffs] = await Promise.all([getProspects(), getActiveTariffs()])
  return <PotencialesClient prospects={prospects} tariffs={tariffs} />
}
