import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

export interface ConversationRow {
  id: string
  memberId: string
  memberName: string
  memberEmail: string | null
  subject: string | null
  lastMessageAt: string | null
  lastMessagePreview: string | null
  unreadCountGym: number
  updatedAt: string
}

export interface MessageRow {
  id: string
  conversationId: string
  senderType: 'gym' | 'member'
  content: string
  isRead: boolean
  createdAt: string
}

export interface MemberOption {
  id: string
  name: string
  email: string | null
}

export const getConversations = cache(async (): Promise<ConversationRow[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('conversations')
    .select(
      `id, member_id, subject, last_message_at, last_message_preview, unread_count_gym, updated_at,
       member:member_id (first_name, last_name, email)`
    )
    .eq('is_archived', false)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100)

  if (error) {
    console.error('[getConversations] error:', error)
    return []
  }

  return (data ?? []).map((c): ConversationRow => {
    const member = Array.isArray(c.member) ? c.member[0] : c.member
    const memberName = member
      ? `${member.first_name} ${member.last_name}`.trim()
      : 'Socio eliminado'
    return {
      id: c.id,
      memberId: c.member_id ?? '',
      memberName,
      memberEmail: member?.email ?? null,
      subject: c.subject,
      lastMessageAt: c.last_message_at,
      lastMessagePreview: c.last_message_preview,
      unreadCountGym: c.unread_count_gym ?? 0,
      updatedAt: c.updated_at,
    }
  })
})

export async function getMessages(conversationId: string): Promise<MessageRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_type, content, is_read, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) {
    console.error('[getMessages] error:', error)
    return []
  }

  return (data ?? []).map((m): MessageRow => ({
    id: m.id,
    conversationId: m.conversation_id,
    senderType: m.sender_type as 'gym' | 'member',
    content: m.content,
    isRead: m.is_read,
    createdAt: m.created_at,
  }))
}

export const getMembersForNewConversation = cache(async (): Promise<MemberOption[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('members')
    .select('id, first_name, last_name, email')
    .eq('status', 'active')
    .order('last_name', { ascending: true })
    .limit(500)

  return (data ?? []).map((m) => ({
    id: m.id,
    name: `${m.first_name} ${m.last_name}`.trim(),
    email: m.email,
  }))
})

// =============================================================================
// Tariffs activas para BroadcastModal filter
// =============================================================================

export interface TariffRow {
  id: string
  name: string
}

export const getActiveTariffsForBroadcast = cache(
  async (): Promise<TariffRow[]> => {
    const supabase = await createClient()
    const { data: gyms } = await supabase.rpc('current_user_gyms')
    const gymId = gyms?.[0]?.gym_id
    if (!gymId) return []

    const { data } = await supabase
      .from('tariffs')
      .select('id, name')
      .eq('gym_id', gymId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    return (data ?? []).map((t) => ({ id: t.id, name: t.name }))
  }
)
