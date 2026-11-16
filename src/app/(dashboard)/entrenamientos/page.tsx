import EntrenamientosClient from './EntrenamientosClient'
import { getWorkouts } from './data'

export default async function EntrenamientosPage() {
  const workouts = await getWorkouts()
  return <EntrenamientosClient initialWorkouts={workouts} />
}
