import FidelizacionClient from './FidelizacionClient'
import { getAlerts, getVipMembers, getEngagementHistory } from './data'

export const dynamic = 'force-dynamic'

export default async function FidelizacionPage() {
  const [alerts, vips, history] = await Promise.all([
    getAlerts(),
    getVipMembers(),
    getEngagementHistory(),
  ])

  return <FidelizacionClient alerts={alerts} vips={vips} history={history} />
}
