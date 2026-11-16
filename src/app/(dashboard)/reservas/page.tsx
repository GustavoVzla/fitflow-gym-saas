import ReservasClient from './ReservasClient'
import {
  getInstancesForDay,
  getActiveMembersForBooking,
  getInstructorsList,
} from './data'
import { generateDayOptions } from './types'
import { getSeenTourKeys } from '@/lib/tours-data'

type SearchParams = { date?: string }

export default async function ReservasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { date: dateParam } = await searchParams
  const days = generateDayOptions(7)
  const today = days[0].date
  const selectedDate =
    dateParam && days.some((d) => d.date === dateParam) ? dateParam : today

  const [instances, members, instructors, seenTourKeys] = await Promise.all([
    getInstancesForDay(selectedDate),
    getActiveMembersForBooking(),
    getInstructorsList(),
    getSeenTourKeys(),
  ])

  return (
    <ReservasClient
      days={days}
      selectedDate={selectedDate}
      instances={instances}
      members={members}
      instructors={instructors}
      seenTourKeys={seenTourKeys}
    />
  )
}
