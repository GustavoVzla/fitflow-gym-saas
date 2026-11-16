import ClausulasClient from './ClausulasClient'
import { getClauses } from './data'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const clauses = await getClauses()
  return <ClausulasClient initialClauses={clauses} />
}
