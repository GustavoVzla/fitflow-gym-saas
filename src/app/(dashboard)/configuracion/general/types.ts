// Settings General — paridad LegacyGym Tab General (37 toggles)
// Source of truth schema (DB = gyms.settings_general jsonb)

export type TimeFormat = '12h' | '24h'
export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
export type WeekStart = 'monday' | 'sunday'

export interface SettingsReservas {
  min_hours_cancel: number
  booking_window_days: number
  max_future_bookings: number
  auto_waitlist_enabled: boolean
  no_show_penalty_enabled: boolean
  no_show_block_days: number
}

export interface SettingsVisibilidad {
  classes_public: boolean
  show_capacity_occupancy: boolean
  show_instructor_names_public: boolean
}

export interface SettingsCalendario {
  timezone: string
  week_starts_on: WeekStart
  time_format: TimeFormat
  date_format: DateFormat
}

export interface SettingsLogin {
  require_email_verified: boolean
  magic_link_only: boolean
  password_min_length: number
  password_require_uppercase: boolean
  password_require_number: boolean
  password_require_special: boolean
  session_duration_hours: number
}

export interface SettingsFactura {
  default_series: string
  prefix_number: string
  default_vat_rate: number
  next_invoice_number: number
  reset_numbering_yearly: boolean
}

export interface SettingsNotificaciones {
  send_welcome_email: boolean
  send_booking_confirmation: boolean
  send_cancellation_confirmation: boolean
  send_payment_receipt: boolean
  reminder_hours_before_class: number
}

export interface SettingsPrivacidad {
  cookie_banner_enabled: boolean
  analytics_enabled: boolean
  data_retention_months: number
}

export interface SettingsGeneral {
  reservas: SettingsReservas
  visibilidad: SettingsVisibilidad
  calendario: SettingsCalendario
  login: SettingsLogin
  factura: SettingsFactura
  notificaciones: SettingsNotificaciones
  privacidad: SettingsPrivacidad
}

export const DEFAULT_SETTINGS: SettingsGeneral = {
  reservas: {
    min_hours_cancel: 2,
    booking_window_days: 14,
    max_future_bookings: 5,
    auto_waitlist_enabled: true,
    no_show_penalty_enabled: false,
    no_show_block_days: 7,
  },
  visibilidad: {
    classes_public: true,
    show_capacity_occupancy: true,
    show_instructor_names_public: true,
  },
  calendario: {
    timezone: 'Europe/Madrid',
    week_starts_on: 'monday',
    time_format: '24h',
    date_format: 'DD/MM/YYYY',
  },
  login: {
    require_email_verified: true,
    magic_link_only: false,
    password_min_length: 8,
    password_require_uppercase: false,
    password_require_number: false,
    password_require_special: false,
    session_duration_hours: 720,
  },
  factura: {
    default_series: 'A',
    prefix_number: '',
    default_vat_rate: 21,
    next_invoice_number: 1,
    reset_numbering_yearly: true,
  },
  notificaciones: {
    send_welcome_email: true,
    send_booking_confirmation: true,
    send_cancellation_confirmation: true,
    send_payment_receipt: true,
    reminder_hours_before_class: 2,
  },
  privacidad: {
    cookie_banner_enabled: true,
    analytics_enabled: false,
    data_retention_months: 60,
  },
}

export const TIMEZONES = [
  'Europe/Madrid',
  'Atlantic/Canary',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Paris',
  'America/Mexico_City',
  'America/Bogota',
  'America/Buenos_Aires',
]
