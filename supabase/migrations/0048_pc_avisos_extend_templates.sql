-- ════════════════════════════════════════════════════════════════════════
-- 0048 — Panel-C Avisos cron · Extender engagement_alerts (plantillas)
-- ════════════════════════════════════════════════════════════════════════
-- Gap F7-P0-2 (cron disparador automático Avisos).
--
-- Antes: 3 triggers (no_attendance_x_days, birthday, subscription_expires_x_days).
-- Ahora: 7 triggers paridad LegacyGym + extras operativos:
--   - welcome                : al crear member (onboarding)
--   - payment_due            : pago con due_date próxima
--   - payment_overdue        : pago vencido sin pagar
--   - booking_reminder       : N min antes de inicio clase
--   - booking_cancelled      : al cancelar reserva
--   - membership_expiring    : renamed from subscription_expires_x_days (BC)
--   - no_attendance          : renamed from no_attendance_x_days (BC)
--   - birthday               : cumpleaños (sin cambios)
--
-- Nuevos campos:
--   - subject            : asunto email (null si channel != email)
--   - send_offset_minutes: minutos respecto al evento trigger (negativo = antes)
--
-- Valores trigger_type antiguos quedan como alias válidos (mapping):
--   no_attendance_x_days       → no_attendance
--   subscription_expires_x_days → membership_expiring

-- ───────────────────────────────────────────────────────────────────────
-- 1. Drop old CHECK constraint y crear el nuevo con más eventos
-- ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.engagement_alerts
  DROP CONSTRAINT IF EXISTS engagement_alerts_trigger_type_check;

-- Normalizar valores existentes (backward-compatible)
UPDATE public.engagement_alerts
SET trigger_type = 'no_attendance'
WHERE trigger_type = 'no_attendance_x_days';

UPDATE public.engagement_alerts
SET trigger_type = 'membership_expiring'
WHERE trigger_type = 'subscription_expires_x_days';

ALTER TABLE public.engagement_alerts
  ADD CONSTRAINT engagement_alerts_trigger_type_check
  CHECK (trigger_type IN (
    'welcome',
    'payment_due',
    'payment_overdue',
    'birthday',
    'booking_reminder',
    'booking_cancelled',
    'membership_expiring',
    'no_attendance'
  ));

-- ───────────────────────────────────────────────────────────────────────
-- 2. Drop old channel CHECK y añadir sms/whatsapp/in_app
-- ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.engagement_alerts
  DROP CONSTRAINT IF EXISTS engagement_alerts_channel_check;

-- Normalizar 'message' → 'in_app'
UPDATE public.engagement_alerts
SET channel = 'in_app'
WHERE channel = 'message';

ALTER TABLE public.engagement_alerts
  ADD CONSTRAINT engagement_alerts_channel_check
  CHECK (channel IN ('email', 'sms', 'whatsapp', 'in_app'));

ALTER TABLE public.engagement_alerts
  ALTER COLUMN channel SET DEFAULT 'in_app';

-- ───────────────────────────────────────────────────────────────────────
-- 3. Nuevos campos: subject + send_offset_minutes
-- ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.engagement_alerts
  ADD COLUMN IF NOT EXISTS subject text CHECK (subject IS NULL OR char_length(subject) BETWEEN 1 AND 200);

ALTER TABLE public.engagement_alerts
  ADD COLUMN IF NOT EXISTS send_offset_minutes integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.engagement_alerts.subject IS 'Asunto del email (obligatorio si channel=email).';
COMMENT ON COLUMN public.engagement_alerts.send_offset_minutes IS
  'Offset en minutos respecto al evento trigger. Negativo = antes (ej: -60 = 1h antes de la clase). Positivo = después. 0 = al momento.';

-- ───────────────────────────────────────────────────────────────────────
-- 4. Idx para lookup rápido por trigger_type en dispatch RPC
-- ───────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_engagement_alerts_trigger_active
  ON public.engagement_alerts (gym_id, trigger_type)
  WHERE is_active = true;

-- ───────────────────────────────────────────────────────────────────────
-- 5. Ajustar history CHECK de channel (paridad)
-- ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.engagement_history
  DROP CONSTRAINT IF EXISTS engagement_history_channel_check;

UPDATE public.engagement_history
SET channel = 'in_app'
WHERE channel = 'message';

ALTER TABLE public.engagement_history
  ADD CONSTRAINT engagement_history_channel_check
  CHECK (channel IN ('email', 'sms', 'whatsapp', 'in_app'));
