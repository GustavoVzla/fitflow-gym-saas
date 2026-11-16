import ClasesTarifasClient from './ClasesTarifasClient'
import { getTariffs, getClasses } from './data'
import { getInstructors } from './instructors'
import { getAgendas } from './agendas'
import { getSeenTourKeys } from '@/lib/tours-data'

export default async function ClasesTarifasPage() {
  const [tariffs, classes, instructors, agendas, seenTourKeys] = await Promise.all([
    getTariffs(),
    getClasses(),
    getInstructors(),
    getAgendas(),
    getSeenTourKeys(),
  ])

  return (
    <ClasesTarifasClient
      initialTariffs={tariffs}
      initialClasses={classes}
      initialInstructors={instructors}
      initialAgendas={agendas}
      seenTourKeys={seenTourKeys}
    />
  )
}
