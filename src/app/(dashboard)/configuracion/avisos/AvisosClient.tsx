'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  Plus,
  Power,
  Trash2,
  Mail,
  MessageSquare,
  MessageCircle,
  Phone,
  X,
  Clock,
  History as HistoryIcon,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import {
  createAvisoTemplateAction,
  updateAvisoTemplateAction,
  toggleAvisoTemplateAction,
  deleteAvisoTemplateAction,
  createFromRecommendedAction,
} from './actions'
import {
  type AvisoTemplate,
  type DispatchQueueRow,
  type TriggerType,
  type Channel,
  TRIGGER_LABEL,
  TRIGGER_DESCRIPTION,
  CHANNEL_LABEL,
  RECOMMENDED_TEMPLATES,
  STATUS_STYLES,
} from './types'

type Props = {
  initialTemplates: AvisoTemplate[]
  initialDispatches: DispatchQueueRow[]
}

type Tab = 'templates' | 'history'

const CHANNEL_ICON: Record<Channel, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  email: Mail,
  sms: Phone,
  whatsapp: MessageCircle,
  in_app: MessageSquare,
}

export default function AvisosClient({ initialTemplates, initialDispatches }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('templates')
  const [templates, setTemplates] = useState(initialTemplates)
  const [dispatches] = useState(initialDispatches)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AvisoTemplate | null>(null)

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const missingRecommended = useMemo(() => {
    const existing = new Set(templates.map((t) => t.name))
    return RECOMMENDED_TEMPLATES.filter((r) => !existing.has(r.name))
  }, [templates])

  const openNew = () => {
    setEditing(null)
    setModalOpen(true)
  }
  const openEdit = (tpl: AvisoTemplate) => {
    setEditing(tpl)
    setModalOpen(true)
  }
  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
  }

  const toggle = (tpl: AvisoTemplate) => {
    startTransition(async () => {
      const res = await toggleAvisoTemplateAction(tpl.id, !tpl.isActive)
      if (res.error) return showToast(res.error, 'error')
      setTemplates((prev) =>
        prev.map((t) => (t.id === tpl.id ? { ...t, isActive: !tpl.isActive } : t)),
      )
      showToast(res.success ?? 'Actualizado')
      router.refresh()
    })
  }

  const remove = (tpl: AvisoTemplate) => {
    if (!confirm(`¿Eliminar plantilla "${tpl.name}"? No se puede deshacer.`)) return
    startTransition(async () => {
      const res = await deleteAvisoTemplateAction(tpl.id)
      if (res.error) return showToast(res.error, 'error')
      setTemplates((prev) => prev.filter((t) => t.id !== tpl.id))
      showToast(res.success ?? 'Eliminada')
      router.refresh()
    })
  }

  const installRecommended = (preset: (typeof RECOMMENDED_TEMPLATES)[number]) => {
    startTransition(async () => {
      const res = await createFromRecommendedAction(
        preset.name,
        preset.triggerType,
        preset.triggerValue,
        preset.channel,
        preset.subject,
        preset.messageTemplate,
        preset.sendOffsetMinutes,
      )
      if (res.error) return showToast(res.error, 'error')
      showToast(`Instalada: ${preset.name}`)
      router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-[#3b8bea]" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Avisos automáticos</h1>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            Motor real · Operativo
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Plantillas que se disparan automáticamente cuando ocurre un evento (cumpleaños, tarifa
          por vencer, pago fallido…). El cron procesa la cola cada 5 minutos.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Esto es el motor básico incluido en tu plan. Para <strong>workflows IA avanzados</strong>{' '}
          (editor visual drag-and-drop, WhatsApp, retry automático, métricas de apertura) visita{' '}
          <a href="/automatizaciones" className="text-[#3b8bea] underline hover:text-[#2a6fc7]">
            Automatizaciones
          </a>{' '}
          (plan Smart / Pro).
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0">
          <TabButton active={tab === 'templates'} onClick={() => setTab('templates')} icon={Bell}>
            Plantillas ({templates.length})
          </TabButton>
          <TabButton active={tab === 'history'} onClick={() => setTab('history')} icon={HistoryIcon}>
            Historial 24h ({dispatches.length})
          </TabButton>
        </div>
      </div>

      {tab === 'templates' && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">
              {templates.filter((t) => t.isActive).length} activas · {templates.filter((t) => !t.isActive).length} en pausa
            </div>
            <button
              onClick={openNew}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-[#3b8bea] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#2a6fc7] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Nueva plantilla
            </button>
          </div>

          {/* Recommended to install */}
          {missingRecommended.length > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#3b8bea]" />
                <h3 className="text-sm font-semibold text-slate-800">
                  Plantillas recomendadas ({missingRecommended.length})
                </h3>
              </div>
              <p className="mb-3 text-xs text-slate-600">
                Instálalas con 1 clic. Puedes editarlas o pausarlas después.
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {missingRecommended.map((r) => {
                  const Icon = CHANNEL_ICON[r.channel]
                  return (
                    <button
                      key={r.name}
                      disabled={isPending}
                      onClick={() => installRecommended(r)}
                      className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-[#3b8bea] hover:shadow-sm disabled:opacity-60"
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#3b8bea]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800">{r.name}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {TRIGGER_LABEL[r.triggerType]} · {CHANNEL_LABEL[r.channel]}
                          {r.sendOffsetMinutes !== 0 &&
                            ` · ${r.sendOffsetMinutes > 0 ? '+' : ''}${r.sendOffsetMinutes} min`}
                        </p>
                      </div>
                      <Plus className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Templates list */}
          {templates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <Bell className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-600">Sin plantillas creadas</p>
              <p className="mt-1 text-xs text-slate-400">
                Instala una plantilla recomendada o crea la tuya.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white shadow-sm">
              {templates.map((tpl) => (
                <TemplateRow
                  key={tpl.id}
                  tpl={tpl}
                  disabled={isPending}
                  onToggle={() => toggle(tpl)}
                  onEdit={() => openEdit(tpl)}
                  onDelete={() => remove(tpl)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'history' && <HistoryTab rows={dispatches} />}

      {modalOpen && (
        <TemplateModal
          initial={editing}
          isPending={isPending}
          onClose={closeModal}
          onSubmitted={() => {
            closeModal()
            router.refresh()
          }}
          onToast={showToast}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.text}
        </div>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`relative -mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
        active ? 'border-[#3b8bea] text-[#3b8bea]' : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  )
}

function TemplateRow({
  tpl,
  disabled,
  onToggle,
  onEdit,
  onDelete,
}: {
  tpl: AvisoTemplate
  disabled: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const Icon = CHANNEL_ICON[tpl.channel]
  const preview = tpl.messageTemplate.length > 140
    ? tpl.messageTemplate.slice(0, 140) + '…'
    : tpl.messageTemplate

  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
        tpl.isActive ? 'bg-blue-50 text-[#3b8bea]' : 'bg-slate-100 text-slate-400'
      }`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-800">{tpl.name}</h4>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
              tpl.isActive
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : 'bg-slate-100 text-slate-500 ring-slate-200'
            }`}
          >
            {tpl.isActive ? 'Activa' : 'Pausada'}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          <strong>Disparador:</strong> {TRIGGER_LABEL[tpl.triggerType]}
          {tpl.triggerValue !== null && ` · ${tpl.triggerValue}`} · <strong>Canal:</strong>{' '}
          {CHANNEL_LABEL[tpl.channel]}
          {tpl.sendOffsetMinutes !== 0 && (
            <>
              {' '}
              · <Clock className="inline h-3 w-3" /> {tpl.sendOffsetMinutes > 0 ? '+' : ''}
              {tpl.sendOffsetMinutes} min
            </>
          )}
        </p>
        {tpl.subject && (
          <p className="mt-1 text-xs text-slate-500">
            <strong>Asunto:</strong> {tpl.subject}
          </p>
        )}
        <p className="mt-1 text-sm text-slate-600">{preview}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          title={tpl.isActive ? 'Pausar' : 'Activar'}
          onClick={onToggle}
          disabled={disabled}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
            tpl.isActive
              ? 'text-emerald-600 hover:bg-emerald-50'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
          }`}
        >
          <Power className="h-4 w-4" />
        </button>
        <button
          title="Editar"
          onClick={onEdit}
          disabled={disabled}
          className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
        >
          Editar
        </button>
        <button
          title="Eliminar"
          onClick={onDelete}
          disabled={disabled}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function HistoryTab({ rows }: { rows: DispatchQueueRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <HistoryIcon className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-600">Sin envíos en las últimas 24h</p>
        <p className="mt-1 text-xs text-slate-400">
          El cron procesa la cola cada 5 minutos. Cuando se dispare un evento, aparecerá aquí.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Hora</th>
              <th className="px-4 py-2">Plantilla</th>
              <th className="px-4 py-2">Socio</th>
              <th className="px-4 py-2">Canal</th>
              <th className="px-4 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const st = STATUS_STYLES[r.status]
              const Icon = CHANNEL_ICON[r.channel]
              return (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(r.scheduledFor).toLocaleString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">
                    {r.templateName ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{r.memberName}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Icon className="h-3 w-3" />
                      {CHANNEL_LABEL[r.channel]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${st.classes}`}
                    >
                      {st.label}
                    </span>
                    {r.errorMessage && (
                      <p className="mt-1 text-[10px] text-red-600">{r.errorMessage}</p>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TemplateModal({
  initial,
  isPending,
  onClose,
  onSubmitted,
  onToast,
}: {
  initial: AvisoTemplate | null
  isPending: boolean
  onClose: () => void
  onSubmitted: () => void
  onToast: (text: string, type?: 'success' | 'error') => void
}) {
  const [, startTransition] = useTransition()
  const [name, setName] = useState(initial?.name ?? '')
  const [triggerType, setTriggerType] = useState<TriggerType>(initial?.triggerType ?? 'welcome')
  const [triggerValue, setTriggerValue] = useState<string>(
    initial?.triggerValue !== undefined && initial?.triggerValue !== null ? String(initial.triggerValue) : '',
  )
  const [channel, setChannel] = useState<Channel>(initial?.channel ?? 'in_app')
  const [subject, setSubject] = useState(initial?.subject ?? '')
  const [body, setBody] = useState(initial?.messageTemplate ?? '')
  const [offset, setOffset] = useState<string>(String(initial?.sendOffsetMinutes ?? 0))
  const [error, setError] = useState<string | null>(null)

  const preview = useMemo(() => {
    return body
      .replace(/\{nombre\}/g, 'María')
      .replace(/\{nombre_tarifa\}/g, 'Premium Mensual')
      .replace(/\{fecha_vencimiento\}/g, '15/05/2026')
  }, [body])

  const needsTriggerValue =
    triggerType === 'no_attendance' || triggerType === 'membership_expiring'

  const submit = () => {
    setError(null)
    const fd = new FormData()
    if (initial) fd.set('id', initial.id)
    fd.set('name', name)
    fd.set('triggerType', triggerType)
    fd.set('triggerValue', triggerValue)
    fd.set('channel', channel)
    fd.set('subject', subject)
    fd.set('messageTemplate', body)
    fd.set('sendOffsetMinutes', offset)

    startTransition(async () => {
      const res = initial
        ? await updateAvisoTemplateAction({}, fd)
        : await createAvisoTemplateAction({}, fd)
      if (res.error) {
        setError(res.error)
        return
      }
      onToast(res.success ?? 'Guardado')
      onSubmitted()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {initial ? 'Editar plantilla' : 'Nueva plantilla'}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[13px] font-medium text-slate-700">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Ej: Recordatorio tarifa 7 días"
              disabled={!!initial}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm disabled:bg-slate-50 focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
            />
            {initial && (
              <p className="mt-1 text-[11px] text-slate-400">
                El nombre no es editable después de crear.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-700">
                Disparador
              </label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as TriggerType)}
                disabled={!!initial}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm disabled:bg-slate-50"
              >
                {(Object.keys(TRIGGER_LABEL) as TriggerType[]).map((t) => (
                  <option key={t} value={t}>
                    {TRIGGER_LABEL[t]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">{TRIGGER_DESCRIPTION[triggerType]}</p>
            </div>

            {needsTriggerValue && (
              <div>
                <label className="mb-1 block text-[13px] font-medium text-slate-700">
                  Valor (días)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={triggerValue}
                  onChange={(e) => setTriggerValue(e.target.value)}
                  placeholder={triggerType === 'no_attendance' ? '14' : '7'}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-700">Canal</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as Channel)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm"
              >
                <option value="in_app">Mensaje in-app</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
              {(channel === 'sms' || channel === 'whatsapp') && (
                <p className="mt-1 text-[11px] text-amber-600">
                  Canal no conectado aún. Los envíos se registran como &quot;sent&quot; pero no se entregan.
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-700">
                Offset (minutos)
              </label>
              <input
                type="number"
                step={1}
                value={offset}
                onChange={(e) => setOffset(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Negativo = antes del evento (ej: -60 = 1h antes). 0 = inmediato.
              </p>
            </div>
          </div>

          {channel === 'email' && (
            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-700">
                Asunto del email
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                placeholder="Ej: Tu tarifa vence pronto"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-[13px] font-medium text-slate-700">
              Plantilla del mensaje
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder="Usa {nombre}, {fecha_vencimiento} y {nombre_tarifa} para personalizar"
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 shadow-sm focus:border-[#3b8bea] focus:ring-2 focus:ring-blue-100 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Merge tags disponibles:{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">{'{nombre}'}</code>{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">{'{fecha_vencimiento}'}</code>{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">{'{nombre_tarifa}'}</code>
            </p>
          </div>

          <div>
            <p className="mb-1 text-[13px] font-medium text-slate-700">Vista previa</p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              {preview || <span className="text-slate-400">— escribe el mensaje para ver el preview —</span>}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={isPending || !name || !body}
              className="rounded-lg bg-[#3b8bea] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#2a6fc7] disabled:opacity-60"
            >
              {isPending ? 'Guardando...' : initial ? 'Guardar cambios' : 'Crear plantilla'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
