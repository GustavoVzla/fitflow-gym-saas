-- Sprint paridad 100% — Tab Configuración > General (37 toggles LegacyGym)
-- JSONB flexible: evita 37 columnas y permite extender sin migraciones.
-- Default refleja sane defaults Demo Studio (zona ES, formato 24h, lunes inicio semana).

ALTER TABLE public.gyms
  ADD COLUMN IF NOT EXISTS settings_general jsonb NOT NULL DEFAULT '{
    "reservas": {
      "min_hours_cancel": 2,
      "booking_window_days": 14,
      "max_future_bookings": 5,
      "auto_waitlist_enabled": true,
      "no_show_penalty_enabled": false,
      "no_show_block_days": 7
    },
    "visibilidad": {
      "classes_public": true,
      "show_capacity_occupancy": true,
      "show_instructor_names_public": true
    },
    "calendario": {
      "timezone": "Europe/Madrid",
      "week_starts_on": "monday",
      "time_format": "24h",
      "date_format": "DD/MM/YYYY"
    },
    "login": {
      "require_email_verified": true,
      "magic_link_only": false,
      "password_min_length": 8,
      "password_require_uppercase": false,
      "password_require_number": false,
      "password_require_special": false,
      "session_duration_hours": 720
    },
    "factura": {
      "default_series": "A",
      "prefix_number": "",
      "default_vat_rate": 21,
      "next_invoice_number": 1,
      "reset_numbering_yearly": true
    },
    "notificaciones": {
      "send_welcome_email": true,
      "send_booking_confirmation": true,
      "send_cancellation_confirmation": true,
      "send_payment_receipt": true,
      "reminder_hours_before_class": 2
    },
    "privacidad": {
      "cookie_banner_enabled": true,
      "analytics_enabled": false,
      "data_retention_months": 60
    }
  }'::jsonb;

COMMENT ON COLUMN public.gyms.settings_general IS
  'JSONB flexible con 37 toggles globales (paridad LegacyGym Tab General). 7 secciones: reservas, visibilidad, calendario, login, factura, notificaciones, privacidad.';
