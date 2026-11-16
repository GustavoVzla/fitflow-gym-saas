import GeneralClient from './GeneralClient'
import { getSettingsGeneral } from './data'
import { DEFAULT_SETTINGS } from './types'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const result = await getSettingsGeneral()
  const initialSettings = result?.settings ?? DEFAULT_SETTINGS

  return <GeneralClient initialSettings={initialSettings} />
}
