import CompeticionesClient from './CompeticionesClient'
import { getCompetitions } from './data'

export default async function CompeticionesPage() {
  const competitions = await getCompetitions()
  return <CompeticionesClient initialCompetitions={competitions} />
}
