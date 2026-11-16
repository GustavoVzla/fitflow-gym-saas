import HorarioClient from './HorarioClient'
import { getScheduleForWeek, getInstructorsForFilter } from './data'
import { getSeenTourKeys } from '@/lib/tours-data'
import { createClient } from '@/lib/supabase/server'
import {
  getMondayOf,
  formatWeekLabel,
  toIsoDate,
  type WeekInfo,
} from './types'

type SearchParams = { week?: string }

export default async function HorarioPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { week: weekParam } = await searchParams

  // Semana: si hay ?week=YYYY-MM-DD usamos esa, sino la semana actual
  const referenceDate = weekParam ?? toIsoDate(new Date())
  const monday = getMondayOf(referenceDate)
  const weekStart = toIsoDate(monday)

  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const weekEnd = toIsoDate(sunday)

  // Calcular navegación prev/next
  const prevMonday = new Date(monday)
  prevMonday.setDate(prevMonday.getDate() - 7)
  const nextMonday = new Date(monday)
  nextMonday.setDate(nextMonday.getDate() + 7)

  const todayMonday = getMondayOf(toIsoDate(new Date()))
  const isCurrentWeek = toIsoDate(todayMonday) === weekStart

  const weekInfo: WeekInfo = {
    weekStart,
    weekEnd,
    label: formatWeekLabel(monday),
    isCurrentWeek,
    prevWeekQuery: `?week=${toIsoDate(prevMonday)}`,
    nextWeekQuery: `?week=${toIsoDate(nextMonday)}`,
  }

  const supabase = await createClient()
  const [slots, instructors, seenTourKeys, gymsResult] = await Promise.all([
    getScheduleForWeek(weekStart),
    getInstructorsForFilter(),
    getSeenTourKeys(),
    supabase.rpc('current_user_gyms'),
  ])

  const role = gymsResult.data?.[0]?.role
  const canManage = role === 'owner' || role === 'admin'

  return (
    <HorarioClient
      weekInfo={weekInfo}
      slots={slots}
      instructors={instructors}
      todayIso={toIsoDate(new Date())}
      seenTourKeys={seenTourKeys}
      canManage={canManage}
    />
  )
}
