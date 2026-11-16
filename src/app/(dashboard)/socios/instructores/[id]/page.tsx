import { notFound } from 'next/navigation'
import InstructorClient from './InstructorClient'
import {
  getInstructorCheckInsCurrentMonth,
  getInstructorDetail,
  getInstructorMonthTotal,
  getInstructorNotificationPrefs,
  getInstructorPermissions,
} from '../data'

export default async function InstructorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const instructor = await getInstructorDetail(id)
  if (!instructor) notFound()

  const [perms, notifPrefs, checkIns, monthTotal] = await Promise.all([
    getInstructorPermissions(id),
    getInstructorNotificationPrefs(id),
    getInstructorCheckInsCurrentMonth(id),
    getInstructorMonthTotal(id),
  ])

  return (
    <InstructorClient
      instructor={instructor}
      initialPermissions={perms}
      initialNotifPrefs={notifPrefs}
      initialCheckIns={checkIns}
      monthTotalMinutes={monthTotal.totalMinutes}
      monthSessions={monthTotal.totalSessions}
    />
  )
}
