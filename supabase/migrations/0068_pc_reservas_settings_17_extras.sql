-- ════════════════════════════════════════════════════════════════════════
-- 0068 — Panel-C · Extiende settings_general.reservas con 17 settings faltantes
-- ════════════════════════════════════════════════════════════════════════
-- Panel creó 0065 con 6 settings en `gyms.settings_general.reservas` (JSONB).
-- Handoff PM pide 23 settings paridad LegacyGym. Añadimos los 17 faltantes.
-- Mantenemos JSONB (decisión coordinada con Panel) — no tabla dedicada.
--
-- Los 23 settings cubren: cancelación, ventanas, penalizaciones no-show,
-- lista espera, invitados, cancelación tardía, overrides staff, auditoría.

-- Merge 17 settings extras en el bloque `reservas` sin tocar los 6 existentes.
-- Uso `||` + jsonb_set para preservar cualquier valor ya modificado por usuarios.

UPDATE public.gyms
SET settings_general = jsonb_set(
  settings_general,
  '{reservas}',
  coalesce(settings_general->'reservas', '{}'::jsonb) || '{
    "no_show_penalty_type": "block",
    "no_show_penalty_value": 7,
    "no_show_threshold_count": 3,
    "no_show_threshold_window_days": 30,
    "waitlist_auto_promote": true,
    "waitlist_response_window_minutes": 30,
    "auto_confirm_booking": true,
    "guests_enabled": false,
    "guests_max_per_month": 0,
    "guests_price_eur": 0,
    "late_cancel_threshold_hours": 2,
    "late_cancel_penalty": "warning",
    "same_day_booking_cutoff_minutes": 0,
    "multi_class_same_day": true,
    "staff_override_penalties": true,
    "staff_override_full_class": true,
    "audit_log_reservations": true
  }'::jsonb,
  true
);

-- Actualiza default de la columna para nuevos gyms (todos los 23 settings sane defaults).
-- Tocamos el DEFAULT completo sin romper los existentes (0065 sigue válido).
ALTER TABLE public.gyms
  ALTER COLUMN settings_general
  SET DEFAULT '{
    "reservas": {
      "min_hours_cancel": 2,
      "booking_window_days": 14,
      "max_future_bookings": 5,
      "auto_waitlist_enabled": true,
      "no_show_penalty_enabled": false,
      "no_show_block_days": 7,
      "no_show_penalty_type": "block",
      "no_show_penalty_value": 7,
      "no_show_threshold_count": 3,
      "no_show_threshold_window_days": 30,
      "waitlist_auto_promote": true,
      "waitlist_response_window_minutes": 30,
      "auto_confirm_booking": true,
      "guests_enabled": false,
      "guests_max_per_month": 0,
      "guests_price_eur": 0,
      "late_cancel_threshold_hours": 2,
      "late_cancel_penalty": "warning",
      "same_day_booking_cutoff_minutes": 0,
      "multi_class_same_day": true,
      "staff_override_penalties": true,
      "staff_override_full_class": true,
      "audit_log_reservations": true
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
  'JSONB flexible con settings globales LegacyGym. Sección reservas: 23 settings (paridad completa LegacyGym). Otras 6 secciones: visibilidad, calendario, login, factura, notificaciones, privacidad.';
