import GruposClient from './GruposClient'
import { getGroups, getClasses, getAssignableMembers } from './data'

export const dynamic = 'force-dynamic'

export default async function GruposEntrenoPage() {
  const [groups, classes, members] = await Promise.all([
    getGroups(),
    getClasses(),
    getAssignableMembers(),
  ])
  return <GruposClient groups={groups} classes={classes} members={members} />
}
