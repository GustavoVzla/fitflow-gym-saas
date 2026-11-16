import { notFound } from 'next/navigation'
import MemberDetailClient from './MemberDetailClient'
import { getCurrentGym } from '@/lib/gym'
import {
  getActiveClassesForGym,
  getActiveInstructorsForGym,
  getActiveTariffsForGym,
  getClauseTemplatesForGym,
  getMemberAttendance,
  getMemberAttendanceDaily,
  getMemberBookings,
  getMemberClauses,
  getMemberDetail,
  getMemberHealthData,
  getMemberPayments,
  getMemberRecurringBookings,
  getMemberTariffHistory,
} from './data'

export default async function SocioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const member = await getMemberDetail(id)
  if (!member) notFound()

  const currentGym = await getCurrentGym()
  const currentUserRole = currentGym?.role ?? 'super_admin' // si no hay gym, es super-admin

  const canReadHealth =
    currentUserRole === 'owner' || currentUserRole === 'admin' || currentUserRole === 'super_admin'

  const [
    tariffHistory,
    bookings,
    payments,
    recurring,
    attendance,
    attendanceDaily,
    classes,
    instructors,
    tariffs,
    clauses,
    clauseTemplates,
    healthData,
  ] = await Promise.all([
    getMemberTariffHistory(id),
    getMemberBookings(id),
    getMemberPayments(id),
    getMemberRecurringBookings(id),
    getMemberAttendance(id),
    getMemberAttendanceDaily(id, 365),
    getActiveClassesForGym(member.gymId),
    getActiveInstructorsForGym(member.gymId),
    getActiveTariffsForGym(member.gymId),
    getMemberClauses(id),
    getClauseTemplatesForGym(member.gymId),
    canReadHealth ? getMemberHealthData(id) : Promise.resolve(null),
  ])

  return (
    <MemberDetailClient
      member={member}
      tariffHistory={tariffHistory}
      bookings={bookings}
      payments={payments}
      recurring={recurring}
      attendance={attendance}
      attendanceDaily={attendanceDaily}
      classes={classes}
      instructors={instructors}
      tariffs={tariffs}
      clauses={clauses}
      clauseTemplates={clauseTemplates}
      healthData={healthData}
      currentUserRole={currentUserRole}
    />
  )
}
