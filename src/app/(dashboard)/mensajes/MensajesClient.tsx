'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { MessageSquare, Send, Plus, Search, X, Radio } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ConversationRow, MessageRow, MemberOption, TariffRow } from './data'
import {
  sendMessageAction,
  createConversationAction,
  markConversationReadAction,
} from './actions'
import BroadcastModal from './BroadcastModal'

interface Props {
  conversations: ConversationRow[]
  members: MemberOption[]
  tariffs: TariffRow[]
  initialConversationId?: string
  initialMessages?: MessageRow[]
}

export default function MensajesClient({
  conversations,
  members,
  tariffs,
  initialConversationId,
  initialMessages = [],
}: Props) {
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversationId ?? conversations[0]?.id ?? null
  )
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages)
  const [newMessage, setNewMessage] = useState('')
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [conversationSearch, setConversationSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Realtime subscription a INSERT en messages de la conversación activa.
  // Migración 0039 (PM) habilitó ALTER PUBLICATION supabase_realtime ADD TABLE messages.
  useEffect(() => {
    if (!selectedId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`messages:${selectedId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string
            conversation_id: string
            sender_type: string
            content: string
            is_read: boolean
            created_at: string
          }
          // Evitar duplicar mensajes enviados por el gym (ya tienen optimistic + server).
          // Los insertados por el miembro desde la app SÍ deben aparecer aquí.
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev
            // Limpia optimistic si existe con mismo content+sender_type
            const withoutOptimistic = prev.filter(
              (m) =>
                !(
                  m.id.startsWith('temp-') &&
                  m.senderType === row.sender_type &&
                  m.content === row.content
                )
            )
            return [
              ...withoutOptimistic,
              {
                id: row.id,
                conversationId: row.conversation_id,
                senderType: row.sender_type as 'gym' | 'member',
                content: row.content,
                isRead: row.is_read,
                createdAt: row.created_at,
              },
            ]
          })
          // Si el mensaje es del socio, marcamos la conversación como leída (contador=0)
          if (row.sender_type === 'member') {
            startTransition(() => {
              void markConversationReadAction(selectedId)
            })
          }
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED')
      })

    return () => {
      void supabase.removeChannel(channel)
      setRealtimeConnected(false)
    }
  }, [selectedId])

  // Auto-scroll al final cuando llegan mensajes nuevos
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  const filteredConversations = useMemo(() => {
    if (!conversationSearch.trim()) return conversations
    const q = conversationSearch.toLowerCase()
    return conversations.filter(
      (c) => c.memberName.toLowerCase().includes(q) || c.memberEmail?.toLowerCase().includes(q)
    )
  }, [conversations, conversationSearch])

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members.slice(0, 50)
    const q = memberSearch.toLowerCase()
    return members
      .filter((m) => m.name.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q))
      .slice(0, 50)
  }, [members, memberSearch])

  const selected = conversations.find((c) => c.id === selectedId) ?? null

  async function loadMessages(conversationId: string) {
    setSelectedId(conversationId)
    setError(null)
    const res = await fetch(`/mensajes/api/messages?conversationId=${conversationId}`)
    if (res.ok) {
      const data = await res.json()
      setMessages(data.messages ?? [])
      startTransition(() => {
        void markConversationReadAction(conversationId)
      })
    }
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId || !newMessage.trim()) return
    const content = newMessage
    setNewMessage('')
    setError(null)

    const optimistic: MessageRow = {
      id: `temp-${Date.now()}`,
      conversationId: selectedId,
      senderType: 'gym',
      content,
      isRead: false,
      createdAt: new Date().toISOString(),
    }
    setMessages((m) => [...m, optimistic])

    startTransition(async () => {
      const res = await sendMessageAction(selectedId, content)
      if (res.error) {
        setError(res.error)
        setMessages((m) => m.filter((msg) => msg.id !== optimistic.id))
        setNewMessage(content)
      }
    })
  }

  function handleCreateConversation(memberId: string) {
    setError(null)
    startTransition(async () => {
      const res = await createConversationAction(memberId)
      if (res.error) {
        setError(res.error)
        return
      }
      setModalOpen(false)
      setMemberSearch('')
      if (res.conversationId) {
        window.location.href = `/mensajes?c=${res.conversationId}`
      }
    })
  }

  return (
    <div className="flex h-[calc(100vh-180px)] rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Sidebar conversaciones */}
      <aside className="w-80 border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Conversaciones</h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setBroadcastOpen(true)}
                title="Enviar broadcast a múltiples socios"
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Radio className="h-3.5 w-3.5" />
                Broadcast
              </button>
              <button
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-color,#0B4B8C)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                Nueva
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar socio..."
              value={conversationSearch}
              onChange={(e) => setConversationSearch(e.target.value)}
              className="w-full rounded-md border border-slate-200 pl-9 pr-3 py-1.5 text-sm placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              {conversationSearch
                ? 'Sin resultados'
                : 'Aún no hay conversaciones. Pulsa "Nueva" para empezar.'}
            </div>
          ) : (
            <ul>
              {filteredConversations.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => loadMessages(c.id)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${
                      selectedId === c.id ? 'bg-blue-50/50 border-l-2 border-l-[var(--brand-color,#0B4B8C)]' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-slate-900 truncate">{c.memberName}</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {c.lastMessagePreview ?? 'Sin mensajes aún'}
                        </p>
                      </div>
                      {c.unreadCountGym > 0 && (
                        <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-semibold rounded-full bg-[var(--brand-color,#0B4B8C)] text-white">
                          {c.unreadCountGym}
                        </span>
                      )}
                    </div>
                    {c.lastMessageAt && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(c.lastMessageAt).toLocaleString('es-ES', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                          timeZone: 'Europe/Madrid',
                        })}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Panel chat */}
      <main className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <header className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center font-medium text-slate-600">
                {selected.memberName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 truncate">{selected.memberName}</p>
                {selected.memberEmail && (
                  <p className="text-xs text-slate-500 truncate">{selected.memberEmail}</p>
                )}
              </div>
              {realtimeConnected && (
                <span
                  title="Conectado en tiempo real"
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"
                >
                  <Radio className="h-3 w-3 animate-pulse" />
                  EN VIVO
                </span>
              )}
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/30">
              {messages.length === 0 ? (
                <div className="text-center text-sm text-slate-500 py-8">
                  Sin mensajes aún. Escribe el primero abajo.
                </div>
              ) : (
                messages.map((m) => {
                  const fromGym = m.senderType === 'gym'
                  return (
                    <div key={m.id} className={`flex ${fromGym ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                          fromGym
                            ? 'bg-[var(--brand-color,#0B4B8C)] text-white rounded-br-sm'
                            : 'bg-white border border-slate-200 text-slate-900 rounded-bl-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <p
                          className={`text-[10px] mt-1 ${
                            fromGym ? 'text-white/70' : 'text-slate-400'
                          }`}
                        >
                          {new Date(m.createdAt).toLocaleString('es-ES', {
                            timeStyle: 'short',
                            timeZone: 'Europe/Madrid',
                          })}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {error && (
              <div className="px-6 py-2 bg-red-50 border-t border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            <form
              onSubmit={handleSend}
              className="border-t border-slate-200 p-4 flex items-end gap-2"
            >
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Escribe un mensaje..."
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend(e)
                  }
                }}
                className="flex-1 resize-none rounded-md border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand-color,#0B4B8C)]/30"
                disabled={isPending}
              />
              <button
                type="submit"
                disabled={isPending || !newMessage.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--brand-color,#0B4B8C)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Enviar
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
            <div className="text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <p>Selecciona una conversación o crea una nueva.</p>
            </div>
          </div>
        )}
      </main>

      {/* Modal nueva conversación */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Nueva conversación</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar socio por nombre o email..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  autoFocus
                  className="w-full rounded-md border border-slate-200 pl-9 pr-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredMembers.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">Sin socios</div>
              ) : (
                <ul>
                  {filteredMembers.map((m) => (
                    <li key={m.id}>
                      <button
                        onClick={() => handleCreateConversation(m.id)}
                        disabled={isPending}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 disabled:opacity-50"
                      >
                        <p className="font-medium text-sm text-slate-900">{m.name}</p>
                        {m.email && <p className="text-xs text-slate-500 truncate">{m.email}</p>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <BroadcastModal
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        tariffs={tariffs}
        onSent={() => {
          window.location.reload()
        }}
      />
    </div>
  )
}
