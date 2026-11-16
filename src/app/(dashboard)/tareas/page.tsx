import TareasClient from './TareasClient'
import {
  getTasks,
  getMemberOptions,
  getInstructorOptions,
  getStaffOptions,
  getPaymentOptions,
} from './data'

export default async function TareasPage() {
  const [tasks, members, instructors, staff, payments] = await Promise.all([
    getTasks(),
    getMemberOptions(),
    getInstructorOptions(),
    getStaffOptions(),
    getPaymentOptions(),
  ])
  return (
    <TareasClient
      initialTasks={tasks}
      memberOptions={members}
      instructorOptions={instructors}
      staffOptions={staff}
      paymentOptions={payments}
    />
  )
}
