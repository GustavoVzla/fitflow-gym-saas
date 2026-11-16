import { getUpcomingClasses, getClassFilters } from './data'
import { ClasesClient } from './ClasesClient'

export const metadata = { title: 'Clases' }
export const dynamic = 'force-dynamic'

export default async function ClasesPage({
  searchParams,
}: {
  searchParams: Promise<{ instructor?: string; type?: string; day?: string }>
}) {
  const sp = await searchParams

  const dayFilter = sp.day ? new Date(sp.day) : null
  const fromIso = dayFilter
    ? new Date(dayFilter.setHours(0, 0, 0, 0)).toISOString()
    : undefined
  const toIso = dayFilter
    ? new Date(dayFilter.setHours(23, 59, 59, 999)).toISOString()
    : undefined

  const [classes, filters] = await Promise.all([
    getUpcomingClasses({
      instructorId: sp.instructor || null,
      classType: sp.type || null,
      fromIso,
      toIso,
    }),
    getClassFilters(),
  ])

  return (
    <ClasesClient
      initialClasses={classes}
      filters={filters}
      activeInstructor={sp.instructor ?? null}
      activeType={sp.type ?? null}
      activeDay={sp.day ?? null}
    />
  )
}
