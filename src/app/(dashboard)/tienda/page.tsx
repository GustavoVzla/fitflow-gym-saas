import TiendaClient from './TiendaClient'
import { getProducts, getOrders, getCategories } from './data'

export const dynamic = 'force-dynamic'

export default async function TiendaPage() {
  const [products, orders, categories] = await Promise.all([
    getProducts(),
    getOrders(),
    getCategories(),
  ])

  return <TiendaClient products={products} orders={orders} categories={categories} />
}
