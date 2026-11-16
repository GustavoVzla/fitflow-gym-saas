import InformesClient from './InformesClient'
import { getKpiSummary } from './data'

export default async function InformesPage() {
  const kpis = await getKpiSummary()
  return <InformesClient initialKpis={kpis} />
}
