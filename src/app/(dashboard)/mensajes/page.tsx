import MensajesClient from './MensajesClient'
import {
  getActiveTariffsForBroadcast,
  getConversations,
  getMembersForNewConversation,
  getMessages,
} from './data'

export const dynamic = 'force-dynamic'

export default async function MensajesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; openConversation?: string }>
}) {
  const params = await searchParams
  const [conversations, members, tariffs] = await Promise.all([
    getConversations(),
    getMembersForNewConversation(),
    getActiveTariffsForBroadcast(),
  ])

  const initialId = params.c ?? params.openConversation ?? conversations[0]?.id

  let initialMessages: Awaited<ReturnType<typeof getMessages>> = []
  if (initialId) {
    initialMessages = await getMessages(initialId)
  }

  return (
    <MensajesClient
      conversations={conversations}
      members={members}
      tariffs={tariffs}
      initialConversationId={initialId}
      initialMessages={initialMessages}
    />
  )
}
