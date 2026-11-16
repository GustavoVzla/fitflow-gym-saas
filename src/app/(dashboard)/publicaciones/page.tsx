import { createClient } from '@/lib/supabase/server'
import PublicacionesClient from './PublicacionesClient'
import { getPosts, getActiveTariffOptionsForPosts } from './data'

export default async function PublicacionesPage() {
  const [posts, tariffOptions] = await Promise.all([
    getPosts(),
    getActiveTariffOptionsForPosts(),
  ])
  const supabase = await createClient()
  const { data: gyms } = await supabase.rpc('current_user_gyms')
  const gymName: string = gyms && gyms.length > 0 ? gyms[0].gym_name : 'Gimnasio'

  return (
    <PublicacionesClient
      initialPosts={posts}
      gymName={gymName}
      tariffOptions={tariffOptions}
    />
  )
}
