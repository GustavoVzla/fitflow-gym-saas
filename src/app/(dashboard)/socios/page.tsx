import SociosClient from './SociosClient'
import { getMembers, getMembersCount, getActiveTariffs } from './data'
import { getSeenTourKeys } from '@/lib/tours-data'

export default async function SociosPage() {
  const [members, totalCount, tariffs, seenTourKeys] = await Promise.all([
    getMembers(),
    getMembersCount(),
    getActiveTariffs(),
    getSeenTourKeys(),
  ])

  return (
    <SociosClient
      initialMembers={members}
      totalCount={totalCount}
      tariffs={tariffs}
      seenTourKeys={seenTourKeys}
    />
  )
}
