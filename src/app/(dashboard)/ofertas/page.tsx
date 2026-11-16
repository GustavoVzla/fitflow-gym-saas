import OfertasClient from './OfertasClient'
import { getOffers, getActiveTariffOptions } from './data'

export default async function OfertasPage() {
  const [offers, tariffOptions] = await Promise.all([
    getOffers(),
    getActiveTariffOptions(),
  ])
  return <OfertasClient initialOffers={offers} tariffOptions={tariffOptions} />
}
