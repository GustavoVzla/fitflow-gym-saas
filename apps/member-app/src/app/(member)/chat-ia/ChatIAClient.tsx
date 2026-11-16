'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, MessageCircle } from 'lucide-react'

type Message = {
  id: string
  role: 'bot' | 'user'
  content: string
  ts: number
}

// FAQ inline pragmática — match por keywords. Sprint 30d: migrar a Fuse.js
// fuzzy + RAG IA real (handoff D-A6 documenta plan).
type FaqItem = { keywords: string[]; answer: string }
const FAQ: FaqItem[] = [
  {
    keywords: ['horario', 'hora', 'cuando', 'cuándo'],
    answer:
      'Nuestro horario es lunes a viernes de 7:00 a 21:00 y sábados de 9:00 a 14:00. Puedes ver las clases disponibles y reservar desde la pestaña "Reservar" 📅',
  },
  {
    keywords: ['precio', 'tarifa', 'cuesta', 'cuanto', 'cuánto', 'plan'],
    answer:
      'Tenemos varias tarifas adaptadas a tu ritmo: Dinámico 2 días/semana, Dinámico 3 días/semana, Premium ilimitado y Personal 1:1. Consulta tu tarifa actual en "Perfil" 💳',
  },
  {
    keywords: ['cancelar', 'cancelación', 'cancelacion', 'anular'],
    answer:
      'Puedes cancelar una reserva desde "Reservar" → tu clase reservada → botón "Cancelar". Te recomendamos hacerlo con al menos 4 horas de antelación para no consumir sesión 🕐',
  },
  {
    keywords: ['reservar', 'apuntar', 'apuntarme', 'inscribir'],
    answer:
      'Para reservar una clase: ve a la pestaña "Reservar" 📅, selecciona el día y la clase que quieras, y pulsa "Reservar plaza". Verás confirmación instantánea ✓',
  },
  {
    keywords: ['ubicación', 'ubicacion', 'donde', 'dónde', 'dirección', 'direccion'],
    answer:
      'Demo Studio está en Calle Ejemplo 1, 28001 Madrid. Cerca de las paradas de Metro Centro 📍',
  },
  {
    keywords: ['pago', 'pagar', 'factura', 'cobro'],
    answer:
      'Tus pagos pendientes y el historial los tienes en "Perfil" → Pagos. Si tu gimnasio tiene cobros online activados, puedes pagar con tarjeta directamente desde la app 💳',
  },
  {
    keywords: ['contraseña', 'contrasena', 'password', 'olvide', 'olvidé'],
    answer:
      'Si olvidaste tu contraseña, en la pantalla de inicio de sesión pulsa "¿Prefieres recibir un enlace por correo?" para entrar con un enlace mágico sin contraseña ✉️',
  },
  {
    keywords: ['prueba', 'gratis', 'gratuita', 'trial'],
    answer:
      'Si nunca has venido, escríbenos por WhatsApp y coordinamos una clase de prueba gratuita para que conozcas Demo Studio antes de decidirte 🎁',
  },
  {
    keywords: ['instructor', 'profesor', 'entrenador', 'coach'],
    answer:
      'Nuestro equipo: Coach Alex, Coach Sam y Coach Jordan. En cada clase verás quién imparte. Todos certificados y con experiencia en entrenamiento personal y funcional 🏋️',
  },
  {
    keywords: ['premium', 'personal', '1:1'],
    answer:
      'Las clases Premium son grupales reducidas (máximo 4 personas) con atención más personalizada. Las sesiones Personal 1:1 son entrenamiento individual completamente adaptado a ti 💪',
  },
]

const QUICK_REPLIES = ['Horarios', 'Precios', 'Cancelar reserva', 'Ubicación', 'Cómo reservar']

const WHATSAPP_FALLBACK = 'https://wa.me/34911234567?text=Hola%20Demo Studio%2C%20tengo%20una%20duda%20que%20la%20app%20no%20resuelve'

function findAnswer(query: string): string | null {
  const q = query.toLowerCase().trim()
  if (q.length < 2) return null
  for (const item of FAQ) {
    if (item.keywords.some((kw) => q.includes(kw))) {
      return item.answer
    }
  }
  return null
}

export function ChatIAClient() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'bot',
      content:
        '¡Hola! Soy tu asistente de Demo Studio. Puedo ayudarte con horarios, reservas, precios, ubicación, pagos y más. ¿En qué te ayudo?',
      ts: Date.now(),
    },
  ])
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  function send(content: string) {
    const text = content.trim()
    if (!text) return
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text, ts: Date.now() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    // Respuesta bot tras pequeño delay para sensación natural
    setTimeout(() => {
      const ans = findAnswer(text)
      const botMsg: Message = {
        id: `b-${Date.now()}`,
        role: 'bot',
        content:
          ans ??
          'No tengo una respuesta exacta a eso. ¿Quieres contactar con Demo Studio directamente por WhatsApp?',
        ts: Date.now() + 1,
      }
      setMessages((prev) => [...prev, botMsg])
    }, 600)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    send(input)
  }

  // Detectar último msg sin match para mostrar CTA WhatsApp
  const lastBot = [...messages].reverse().find((m) => m.role === 'bot')
  const showWhatsappCta = lastBot?.content.includes('WhatsApp')

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] -mt-6 -mx-6 px-6 pt-6">
      {/* Header sub */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(59,139,234,0.15)]">
          <Sparkles className="h-4 w-4 text-[#5da0ef]" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <h2 className="font-[family-name:var(--font-display)] text-[16px] font-semibold leading-tight text-[#f0f0f5]">
            Asistente Demo Studio
          </h2>
          <p className="text-[10px] text-[rgba(240,240,245,0.5)]">Powered by FitFlow IA</p>
        </div>
      </div>

      {/* Messages scroll */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2.5 pr-1 pb-2"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
          >
            <div
              className={
                m.role === 'user'
                  ? 'max-w-[78%] rounded-2xl rounded-tr-sm bg-[#3b8bea] px-3.5 py-2.5 text-[13.5px] text-white shadow-sm'
                  : 'max-w-[82%] rounded-2xl rounded-tl-sm bg-[rgba(255,255,255,0.06)] px-3.5 py-2.5 text-[13.5px] text-[#f0f0f5] border border-[rgba(255,255,255,0.06)]'
              }
            >
              {m.content}
            </div>
          </div>
        ))}

        {/* CTA WhatsApp si último bot no encontró respuesta */}
        {showWhatsappCta && (
          <div className="flex justify-start">
            <a
              href={WHATSAPP_FALLBACK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-[rgba(52,211,153,0.15)] border border-[rgba(52,211,153,0.3)] px-3.5 py-2 text-[12px] font-semibold text-[#34d399] hover:bg-[rgba(52,211,153,0.25)] transition"
            >
              <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} />
              Abrir WhatsApp
            </a>
          </div>
        )}
      </div>

      {/* Quick replies */}
      {messages.length <= 2 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_REPLIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              className="rounded-full border border-[rgba(59,139,234,0.3)] bg-[rgba(59,139,234,0.08)] px-3 py-1 text-[11px] text-[#5da0ef] hover:bg-[rgba(59,139,234,0.15)] transition"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-[rgba(255,255,255,0.06)] pt-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta…"
          className="flex-1 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3.5 py-2.5 text-[13.5px] text-[#f0f0f5] placeholder-[rgba(240,240,245,0.3)] outline-none focus:border-[rgba(59,139,234,0.5)] focus:ring-1 focus:ring-[rgba(59,139,234,0.2)]"
          aria-label="Tu pregunta"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#3b8bea] text-white transition hover:bg-[#5da0ef] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" strokeWidth={2} />
        </button>
      </form>
    </div>
  )
}
