import { getPaymentsForMember } from './data'
import { PagosClient } from './PagosClient'

export const metadata = { title: 'Pagos' }
export const dynamic = 'force-dynamic'

export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; paymentId?: string }>
}) {
  const sp = await searchParams
  const data = await getPaymentsForMember()

  return (
    <PagosClient
      pending={data.pending}
      history={data.history}
      paymentMode={data.paymentMode}
      flashStatus={sp.status ?? null}
    />
  )
}
