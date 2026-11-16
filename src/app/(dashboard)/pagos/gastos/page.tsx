import { listExpensesAction, getExpenseKpisAction } from './actions'
import GastosClient from './GastosClient'

export default async function GastosPage() {
  const [expenses, kpis] = await Promise.all([
    listExpensesAction(),
    getExpenseKpisAction(),
  ])

  return <GastosClient initialExpenses={expenses} initialKpis={kpis} />
}
