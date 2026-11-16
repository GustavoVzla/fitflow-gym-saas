import FamiliasClient from './FamiliasClient'
import { getFamilies, getAssignableMembers } from './data'

export const dynamic = 'force-dynamic'

export default async function FamiliasPage() {
  const [families, members] = await Promise.all([getFamilies(), getAssignableMembers()])
  return <FamiliasClient families={families} members={members} />
}
