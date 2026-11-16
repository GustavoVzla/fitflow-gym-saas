'use client'

import { useState, useTransition } from 'react'
import { Heart, Plus, Power, Trash2, Mail, MessageSquare } from 'lucide-react'
import type { AlertRow, VipMember, HistoryRow } from './data'
import { createAlertAction, toggleAlertAction, deleteAlertAction } from './actions'

interface Props {
  alerts: AlertRow[]
  vips: VipMember[]
  history: HistoryRow[]
}

const TRIGGER_LABEL: Record<string, string> = {
  no_attendance_x_days: 'No viene hace X días',
  birthday: 'Cumpleaños',
  subscription_expires_x_days: 'Tarifa vence en X días',
}

const PRESETS = [
  {
    name: 'Te echamos de menos (14 días sin venir)',
    triggerType: 'no_attendance_x_days' as const,
    triggerValue: 14,
    channel: 'message' as const,
    messageTemplate:
      '¡Hola {nombre}! Llevas 2 semanas sin aparecer por el gym. ¿Todo bien? Si necesitas ajustar tu plan o reagendar, aquí estamos.',
  },
  {
    name: 'Feliz cumpleaños',
    triggerType: 'birthday' as const,
    triggerValue: null,
    channel: 'message' as const,
    messageTemplate:
      '¡Feliz cumpleaños, {nombre}! 🎉 Todo el equipo de Demo Studio te desea un día genial. Como regalo, invitamos a un amigo a probar una clase contigo esta semana.',
  },
  {
    name: 'Tu tarifa vence en 7 días',
    triggerType: 'subscription_expires_x_days' as const,
    triggerValue: 7,
    channel: 'message' as const,
    messageTemplate:
      'Hola {nombre}, solo un recordatorio: tu tarifa actual vence en 7 días. Si quieres renovar o cambiar de plan, pásate por recepción o escríbenos aquí.',
  },
]

export default function FidelizacionClient({ alerts, vips, history }: Props) {
  const [tab, setTab] = useState<'alerts' | 'vips' | 'history'>('alerts')
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [preset, setPreset] = useState<(typeof PRESETS)[number] | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleCreate(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await createAlertAction({}, formData)
      if (res.error) {
        setError(res.error)
        return
      }
      setModalOpen(false)
      setPreset(null)
    })
  }

  function handleToggle(id: string, currentActive: boolean) {
    startTransition(() => {
      void toggleAlertAction(id, !currentActive)
    })
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar este aviso?')) return
    startTransition(() => {
      void deleteAlertAction(id)
    })
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Heart className="h-6 w-6 text-[var(--brand-color,#0B4B8C)]" />
            Fidelización
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Avisos automáticos, clientes destacados e historial de envíos. Paridad LegacyGym.
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-6">
        {(['alerts', 'vips', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-[var(--brand-color,#0B4B8C)] text-[var(--brand-color,#0B4B8C)]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'alerts' && `Avisos automáticos ${alerts.length > 0 ? `(${alerts.length})` : ''}`}
            {t === 'vips' && `Clientes destacados ${vips.length > 0 ? `(${vips.length})` : ''}`}
            {t === 'history' && `Historial envíos ${history.length > 0 ? `(${history.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* Tab 1: Alertas */}
      {tab === 'alerts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              {alerts.length === 0
                ? 'Sin avisos configurados. Empieza con una plantilla.'
                : `${alerts.filter((a) => a.isActive).length} activos / ${alerts.length} totales`}
            </p>
            <button
              onClick={() => {
                setPreset(null)
                setModalOpen(true)
              }}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--brand-color,#0B4B8C)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Nuevo aviso
            </button>
          </div>

          {alerts.length === 0 && (
            <div className="grid md:grid-cols-3 gap-4">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => {
                    setPreset(p)
                    setModalOpen(true)
                  }}
                  className="text-left rounded-lg border-2 border-dashed border-slate-200 p-4 hover:border-[var(--brand-color,#0B4B8C)] hover:bg-blue-50/30 transition"
                >
                  <p className="font-medium text-sm text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">{p.messageTemplate}</p>
                  <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-wide">
                    Plantilla · click para activar
                  </p>
                </button>
              ))}
            </div>
          )}

          {alerts.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Nombre</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Disparador</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Canal</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Estado</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{a.name}</p>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {a.messageTemplate}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {TRIGGER_LABEL[a.triggerType]}
                        {a.triggerValue !== null && ` (${a.triggerValue})`}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                          {a.channel === 'email' ? (
                            <Mail className="h-3.5 w-3.5" />
                          ) : (
                            <MessageSquare className="h-3.5 w-3.5" />
                          )}
                          {a.channel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            a.isActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {a.isActive ? 'Activo' : 'Pausado'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => handleToggle(a.id, a.isActive)}
                            disabled={isPending}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                            title={a.isActive ? 'Pausar' : 'Activar'}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(a.id)}
                            disabled={isPending}
                            className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800">
            <p className="font-medium">
              Motor de avisos activo — el cron procesa la cola cada 5 minutos.
            </p>
            <p className="mt-0.5 text-emerald-700/90">
              Para configurar plantillas, canales y offsets ve a{' '}
              <a href="/configuracion/avisos" className="underline font-medium hover:text-emerald-900">
                Configuración › Avisos
              </a>
              . Los workflows IA multicanal (WhatsApp, editor visual) son parte de{' '}
              <a href="/automatizaciones" className="underline font-medium hover:text-emerald-900">
                Automatizaciones
              </a>{' '}
              (plan Smart / Pro).
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: VIPs */}
      {tab === 'vips' && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          {vips.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Aún no hay datos suficientes. Se calcula con pagos + reservas.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">#</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Socio</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Pagado total</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Reservas</th>
                </tr>
              </thead>
              <tbody>
                {vips.map((v, i) => (
                  <tr key={v.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-400 font-medium">{i + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{v.name}</p>
                      {v.email && <p className="text-xs text-slate-500">{v.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {new Intl.NumberFormat('es-ES', {
                        style: 'currency',
                        currency: 'EUR',
                      }).format(v.totalPaid)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{v.bookingsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 3: Historial */}
      {tab === 'history' && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          {history.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Sin envíos en los últimos 90 días.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Socio</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Aviso</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Canal</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Estado</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(h.sentAt).toLocaleString('es-ES', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                        timeZone: 'Europe/Madrid',
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{h.memberName}</td>
                    <td className="px-4 py-3 text-slate-600">{h.alertName ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{h.channel}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          h.status === 'sent'
                            ? 'bg-emerald-100 text-emerald-700'
                            : h.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {h.status === 'sent' ? 'Enviado' : h.status === 'failed' ? 'Fallido' : 'Programado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal crear aviso */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-200">
              <h3 className="font-semibold text-lg text-slate-900">Nuevo aviso automático</h3>
            </div>
            <form
              action={handleCreate}
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              <div>
                <label className="text-xs font-medium text-slate-700">Nombre *</label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={preset?.name ?? ''}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700">Tipo disparador *</label>
                  <select
                    name="triggerType"
                    required
                    defaultValue={preset?.triggerType ?? 'no_attendance_x_days'}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="no_attendance_x_days">No viene hace X días</option>
                    <option value="birthday">Cumpleaños</option>
                    <option value="subscription_expires_x_days">Tarifa vence en X días</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Valor (días)</label>
                  <input
                    name="triggerValue"
                    type="number"
                    min={1}
                    max={365}
                    defaultValue={preset?.triggerValue ?? 14}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">Canal *</label>
                <select
                  name="channel"
                  required
                  defaultValue={preset?.channel ?? 'message'}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="message">Mensaje in-app</option>
                  <option value="email">Email</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">Plantilla de mensaje *</label>
                <textarea
                  name="messageTemplate"
                  required
                  rows={5}
                  defaultValue={preset?.messageTemplate ?? ''}
                  placeholder="Usa {nombre} para insertar el nombre del socio"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm resize-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Tokens disponibles: {'{nombre}'}, {'{fecha_vencimiento}'}, {'{nombre_tarifa}'}
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-2">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm rounded-md bg-[var(--brand-color,#0B4B8C)] text-white hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? 'Creando...' : 'Crear aviso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
