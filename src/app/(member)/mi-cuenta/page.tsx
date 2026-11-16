import { redirect } from 'next/navigation'
import { getMemberDashboard } from './data'
import { MiCuentaClient } from './MiCuentaClient'

export const dynamic = 'force-dynamic'

export default async function MiCuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>
}) {
  const params = await searchParams
  const data = await getMemberDashboard()

  if (!data) {
    redirect('/mi-cuenta/welcome')
  }

  return (
    <MiCuentaClient
      data={data}
      successFlag={params.success ?? null}
      canceledFlag={params.canceled ?? null}
    />
  )
}
