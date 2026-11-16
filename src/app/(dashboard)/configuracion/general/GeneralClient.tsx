'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
import { updateSettingsGeneralAction } from './actions'
import {
  type SettingsGeneral,
  type TimeFormat,
  type DateFormat,
  type WeekStart,
  TIMEZONES,
} from './types'

interface Props {
  initialSettings: SettingsGeneral
}

type SectionKey =
  | 'reservas'
  | 'visibilidad'
  | 'calendario'
  | 'login'
  | 'factura'
  | 'notificaciones'
  | 'privacidad'

const SECTIONS: { key: SectionKey; title: string; description: string }[] = [
  {
    key: 'reservas',
    title: 'Reservas',
    description: 'Ventanas de reserva, cancelación, lista de espera.',
  },
  {
    key: 'visibilidad',
    title: 'Visibilidad pública',
    description: 'Qué información de clases es visible sin login.',
  },
  {
    key: 'calendario',
    title: 'Calendario y zona horaria',
    description: 'Formato fechas/horas, zona horaria, día inicio semana.',
  },
  {
    key: 'login',
    title: 'Login y contraseñas',
    description: 'Seguridad de acceso a la app de socios.',
  },
  {
    key: 'factura',
    title: 'Facturación',
    description: 'Serie, numeración, IVA por defecto.',
  },
  {
    key: 'notificaciones',
    title: 'Notificaciones automáticas',
    description: 'Emails y recordatorios enviados al socio.',
  },
  {
    key: 'privacidad',
    title: 'Privacidad y cookies',
    description: 'Banner cookies, analytics, retención de datos.',
  },
]

export default function GeneralClient({ initialSettings }: Props) {
  const [baseline, setBaseline] = useState<SettingsGeneral>(initialSettings)
  const [settings, setSettings] = useState<SettingsGeneral>(initialSettings)
  const [openSection, setOpenSection] = useState<SectionKey | null>('reservas')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const isDirty = JSON.stringify(settings) !== JSON.stringify(baseline)

  function handleSave() {
    setMsg(null)
    startTransition(async () => {
      const res = await updateSettingsGeneralAction(settings)
      if (res.error) setMsg({ type: 'error', text: res.error })
      else {
        setMsg({ type: 'success', text: res.success ?? 'Guardado' })
        setBaseline(settings) // reset dirty state tras guardar OK
      }
      setTimeout(() => setMsg(null), 3500)
    })
  }

  function handleDiscard() {
    setSettings(baseline)
    setMsg(null)
  }

  function toggleSection(key: SectionKey) {
    setOpenSection((current) => (current === key ? null : key))
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-[var(--brand-color,#0B4B8C)]" />
            Configuración general
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            37 ajustes globales del centro. Afectan a todos los socios y al comportamiento por defecto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              onClick={handleDiscard}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Descartar
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isPending || !isDirty}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-color,#0B4B8C)] px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </header>

      {isDirty && !msg && (
        <div className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm bg-sky-50 border border-sky-200 text-sky-800">
          <AlertCircle className="h-4 w-4" />
          Tienes cambios sin guardar. Haz clic en <strong className="font-semibold">Guardar cambios</strong> para aplicarlos.
        </div>
      )}

      {msg && (
        <div
          className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
            msg.type === 'error'
              ? 'bg-red-50 border border-red-200 text-red-800'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}
        >
          {msg.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {msg.text}
        </div>
      )}

      <div className="space-y-3">
        {SECTIONS.map((section) => {
          const isOpen = openSection === section.key
          const sectionDirty =
            JSON.stringify((settings as unknown as Record<string, unknown>)[section.key]) !==
            JSON.stringify((baseline as unknown as Record<string, unknown>)[section.key])
          return (
            <div
              key={section.key}
              className="rounded-xl border border-slate-200 bg-white overflow-hidden"
            >
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-slate-900">{section.title}</h2>
                      {sectionDirty && (
                        <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                          Modificado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{section.description}</p>
                  </div>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </button>

              {isOpen && (
                <div className="border-t border-slate-200 px-5 py-5 bg-slate-50/30">
                  {section.key === 'reservas' && (
                    <ReservasSection settings={settings} setSettings={setSettings} />
                  )}
                  {section.key === 'visibilidad' && (
                    <VisibilidadSection settings={settings} setSettings={setSettings} />
                  )}
                  {section.key === 'calendario' && (
                    <CalendarioSection settings={settings} setSettings={setSettings} />
                  )}
                  {section.key === 'login' && (
                    <LoginSection settings={settings} setSettings={setSettings} />
                  )}
                  {section.key === 'factura' && (
                    <FacturaSection settings={settings} setSettings={setSettings} />
                  )}
                  {section.key === 'notificaciones' && (
                    <NotificacionesSection settings={settings} setSettings={setSettings} />
                  )}
                  {section.key === 'privacidad' && (
                    <PrivacidadSection settings={settings} setSettings={setSettings} />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Helper components por sección
// ──────────────────────────────────────────────────────────────────────

type SectionProps = {
  settings: SettingsGeneral
  setSettings: React.Dispatch<React.SetStateAction<SettingsGeneral>>
}

function ReservasSection({ settings, setSettings }: SectionProps) {
  const s = settings.reservas
  const update = (patch: Partial<typeof s>) =>
    setSettings((prev) => ({ ...prev, reservas: { ...prev.reservas, ...patch } }))

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <NumField
        label="Horas mínimas para cancelar (sin penalización)"
        value={s.min_hours_cancel}
        onChange={(v) => update({ min_hours_cancel: v })}
        min={0}
        max={168}
      />
      <NumField
        label="Ventana de reserva (días hacia adelante)"
        value={s.booking_window_days}
        onChange={(v) => update({ booking_window_days: v })}
        min={1}
        max={365}
      />
      <NumField
        label="Reservas simultáneas máximas por socio"
        value={s.max_future_bookings}
        onChange={(v) => update({ max_future_bookings: v })}
        min={1}
        max={100}
      />
      <ToggleField
        label="Lista de espera automática (si clase llena)"
        checked={s.auto_waitlist_enabled}
        onChange={(v) => update({ auto_waitlist_enabled: v })}
      />
      <ToggleField
        label="Penalizar no-show (no apareció)"
        checked={s.no_show_penalty_enabled}
        onChange={(v) => update({ no_show_penalty_enabled: v })}
      />
      <NumField
        label="Días de bloqueo por no-show"
        value={s.no_show_block_days}
        onChange={(v) => update({ no_show_block_days: v })}
        min={0}
        max={365}
        disabled={!s.no_show_penalty_enabled}
      />
    </div>
  )
}

function VisibilidadSection({ settings, setSettings }: SectionProps) {
  const s = settings.visibilidad
  const update = (patch: Partial<typeof s>) =>
    setSettings((prev) => ({ ...prev, visibilidad: { ...prev.visibilidad, ...patch } }))
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ToggleField
        label="Mostrar clases en web pública"
        checked={s.classes_public}
        onChange={(v) => update({ classes_public: v })}
        helper="Anónimos pueden ver el horario sin iniciar sesión"
      />
      <ToggleField
        label="Mostrar capacidad ocupada"
        checked={s.show_capacity_occupancy}
        onChange={(v) => update({ show_capacity_occupancy: v })}
        helper="Ej: 6/10 plazas reservadas"
      />
      <ToggleField
        label="Mostrar nombres de instructores en público"
        checked={s.show_instructor_names_public}
        onChange={(v) => update({ show_instructor_names_public: v })}
      />
    </div>
  )
}

function CalendarioSection({ settings, setSettings }: SectionProps) {
  const s = settings.calendario
  const update = (patch: Partial<typeof s>) =>
    setSettings((prev) => ({ ...prev, calendario: { ...prev.calendario, ...patch } }))
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Zona horaria</label>
        <select
          value={s.timezone}
          onChange={(e) => update({ timezone: e.target.value })}
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Día de inicio de semana
        </label>
        <select
          value={s.week_starts_on}
          onChange={(e) => update({ week_starts_on: e.target.value as WeekStart })}
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="monday">Lunes</option>
          <option value="sunday">Domingo</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Formato de hora</label>
        <select
          value={s.time_format}
          onChange={(e) => update({ time_format: e.target.value as TimeFormat })}
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="24h">24h (18:30)</option>
          <option value="12h">12h (6:30 PM)</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Formato de fecha</label>
        <select
          value={s.date_format}
          onChange={(e) => update({ date_format: e.target.value as DateFormat })}
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
        </select>
      </div>
    </div>
  )
}

function LoginSection({ settings, setSettings }: SectionProps) {
  const s = settings.login
  const update = (patch: Partial<typeof s>) =>
    setSettings((prev) => ({ ...prev, login: { ...prev.login, ...patch } }))
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ToggleField
        label="Requerir email verificado"
        checked={s.require_email_verified}
        onChange={(v) => update({ require_email_verified: v })}
      />
      <ToggleField
        label="Solo magic link (sin contraseña)"
        checked={s.magic_link_only}
        onChange={(v) => update({ magic_link_only: v })}
        helper="Si activo, deshabilita formulario password"
      />
      <NumField
        label="Longitud mínima de contraseña"
        value={s.password_min_length}
        onChange={(v) => update({ password_min_length: v })}
        min={6}
        max={128}
        disabled={s.magic_link_only}
      />
      <NumField
        label="Duración de sesión (horas)"
        value={s.session_duration_hours}
        onChange={(v) => update({ session_duration_hours: v })}
        min={1}
        max={8760}
        helper="720 = 30 días"
      />
      <ToggleField
        label="Exigir mayúscula en contraseña"
        checked={s.password_require_uppercase}
        onChange={(v) => update({ password_require_uppercase: v })}
        disabled={s.magic_link_only}
      />
      <ToggleField
        label="Exigir número en contraseña"
        checked={s.password_require_number}
        onChange={(v) => update({ password_require_number: v })}
        disabled={s.magic_link_only}
      />
      <ToggleField
        label="Exigir carácter especial en contraseña"
        checked={s.password_require_special}
        onChange={(v) => update({ password_require_special: v })}
        disabled={s.magic_link_only}
      />
    </div>
  )
}

function FacturaSection({ settings, setSettings }: SectionProps) {
  const s = settings.factura
  const update = (patch: Partial<typeof s>) =>
    setSettings((prev) => ({ ...prev, factura: { ...prev.factura, ...patch } }))
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Serie por defecto
        </label>
        <input
          type="text"
          value={s.default_series}
          onChange={(e) => update({ default_series: e.target.value })}
          maxLength={10}
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          placeholder="A"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Prefijo numeración (opcional)
        </label>
        <input
          type="text"
          value={s.prefix_number}
          onChange={(e) => update({ prefix_number: e.target.value })}
          maxLength={20}
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          placeholder="FAC-2026-"
        />
      </div>
      <NumField
        label="IVA por defecto (%)"
        value={s.default_vat_rate}
        onChange={(v) => update({ default_vat_rate: v })}
        min={0}
        max={100}
        step="0.01"
      />
      <NumField
        label="Próximo número de factura"
        value={s.next_invoice_number}
        onChange={(v) => update({ next_invoice_number: v })}
        min={1}
      />
      <ToggleField
        label="Reiniciar numeración cada año"
        checked={s.reset_numbering_yearly}
        onChange={(v) => update({ reset_numbering_yearly: v })}
      />
    </div>
  )
}

function NotificacionesSection({ settings, setSettings }: SectionProps) {
  const s = settings.notificaciones
  const update = (patch: Partial<typeof s>) =>
    setSettings((prev) => ({ ...prev, notificaciones: { ...prev.notificaciones, ...patch } }))
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ToggleField
        label="Email de bienvenida al alta"
        checked={s.send_welcome_email}
        onChange={(v) => update({ send_welcome_email: v })}
      />
      <ToggleField
        label="Confirmación al reservar clase"
        checked={s.send_booking_confirmation}
        onChange={(v) => update({ send_booking_confirmation: v })}
      />
      <ToggleField
        label="Confirmación al cancelar reserva"
        checked={s.send_cancellation_confirmation}
        onChange={(v) => update({ send_cancellation_confirmation: v })}
      />
      <ToggleField
        label="Recibo de pago automático"
        checked={s.send_payment_receipt}
        onChange={(v) => update({ send_payment_receipt: v })}
      />
      <NumField
        label="Horas antes de clase para recordatorio"
        value={s.reminder_hours_before_class}
        onChange={(v) => update({ reminder_hours_before_class: v })}
        min={0}
        max={168}
        helper="0 = desactivar recordatorio"
      />
    </div>
  )
}

function PrivacidadSection({ settings, setSettings }: SectionProps) {
  const s = settings.privacidad
  const update = (patch: Partial<typeof s>) =>
    setSettings((prev) => ({ ...prev, privacidad: { ...prev.privacidad, ...patch } }))
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ToggleField
        label="Banner de cookies activo"
        checked={s.cookie_banner_enabled}
        onChange={(v) => update({ cookie_banner_enabled: v })}
      />
      <ToggleField
        label="Analytics/telemetría habilitada"
        checked={s.analytics_enabled}
        onChange={(v) => update({ analytics_enabled: v })}
        helper="Solo con consentimiento del usuario"
      />
      <NumField
        label="Retención de datos (meses)"
        value={s.data_retention_months}
        onChange={(v) => update({ data_retention_months: v })}
        min={12}
        max={120}
        helper="RGPD: mínimo 12 meses facturación"
      />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Primitives reusables
// ──────────────────────────────────────────────────────────────────────

function ToggleField({
  label,
  checked,
  onChange,
  helper,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  helper?: string
  disabled?: boolean
}) {
  return (
    <label
      className={`flex items-start gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 rounded border-slate-300"
      />
      <div className="flex-1">
        <p className="text-sm text-slate-800">{label}</p>
        {helper && <p className="text-xs text-slate-500 mt-0.5">{helper}</p>}
      </div>
    </label>
  )
}

function NumField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  helper,
  disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: string
  helper?: string
  disabled?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400"
      />
      {helper && <p className="text-xs text-slate-500 mt-0.5">{helper}</p>}
    </div>
  )
}
