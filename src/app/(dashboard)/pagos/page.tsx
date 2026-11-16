import PagosClient from './PagosClient'
import { getPayments, getActiveMembers, getActiveTariffsForPayment, getMorososState } from './data'
import { getSeenTourKeys } from '@/lib/tours-data'

export default async function PagosPage() {
  const [payments, members, tariffs, seenTourKeys, morosos] = await Promise.all([
    getPayments(),
    getActiveMembers(),
    getActiveTariffsForPayment(),
    getSeenTourKeys(),
    getMorososState(),
  ])

  return (
    <PagosClient
      initialPayments={payments}
      members={members}
      tariffs={tariffs}
      seenTourKeys={seenTourKeys}
      morosos={morosos}
    />
  )
}
