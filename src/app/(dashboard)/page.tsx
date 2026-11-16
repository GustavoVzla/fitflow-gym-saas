import DashboardView from './DashboardView'
import { getDashboardData } from './dashboard-data'

export default async function DashboardPage() {
  const data = await getDashboardData()
  return <DashboardView data={data} />
}
