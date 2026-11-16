-- ════════════════════════════════════════════════════════════════════════
-- Migración 0037: engagement_alerts + engagement_history (Fidelización Base)
-- ════════════════════════════════════════════════════════════════════════
-- Añade tablas para módulo Fidelización (paridad LegacyGym /engagement).
-- RLS multi-tenant estricto desde día 1 (Decision #111).

CREATE TABLE IF NOT EXISTS public.engagement_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  trigger_type text NOT NULL CHECK (
    trigger_type IN ('no_attendance_x_days','birthday','subscription_expires_x_days')
  ),
  trigger_value integer,
  channel text NOT NULL DEFAULT 'message' CHECK (channel IN ('email','message')),
  message_template text NOT NULL CHECK (char_length(message_template) BETWEEN 1 AND 4000),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_engagement_alerts_gym ON public.engagement_alerts(gym_id, is_active);

CREATE TABLE IF NOT EXISTS public.engagement_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  alert_id uuid REFERENCES public.engagement_alerts(id) ON DELETE SET NULL,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','message')),
  status text NOT NULL CHECK (status IN ('sent','failed','scheduled')),
  error_message text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_engagement_history_gym ON public.engagement_history(gym_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_history_member ON public.engagement_history(member_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_engagement_alerts_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS engagement_alerts_updated_at ON public.engagement_alerts;
CREATE TRIGGER engagement_alerts_updated_at
  BEFORE UPDATE ON public.engagement_alerts
  FOR EACH ROW EXECUTE FUNCTION public.tg_engagement_alerts_updated_at();

-- RLS
ALTER TABLE public.engagement_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY engagement_alerts_staff_select ON public.engagement_alerts
  FOR SELECT TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY engagement_alerts_staff_insert ON public.engagement_alerts
  FOR INSERT TO authenticated
  WITH CHECK (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY engagement_alerts_staff_update ON public.engagement_alerts
  FOR UPDATE TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()))
  WITH CHECK (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY engagement_alerts_staff_delete ON public.engagement_alerts
  FOR DELETE TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY engagement_history_staff_select ON public.engagement_history
  FOR SELECT TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY engagement_history_staff_insert ON public.engagement_history
  FOR INSERT TO authenticated
  WITH CHECK (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

COMMENT ON TABLE public.engagement_alerts IS 'Plantillas de avisos automáticos (Fidelización Base). Paridad LegacyGym /engagement.';
COMMENT ON TABLE public.engagement_history IS 'Histórico envíos engagement (sent/failed). Retención mín 90d.';
