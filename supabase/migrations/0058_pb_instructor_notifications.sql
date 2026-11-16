-- =============================================================================
-- 0058 — Instructor notification preferences (paridad LegacyGym ficha) — PB
--
-- Contexto: G1 audit V5 P1 #4 — sección Notificaciones ficha instructor.
-- LegacyGym muestra 5 categorías × 4 opciones radio:
--   - Nuevos cliente / Bajas cliente / Nuevo pago / Pagos online / Boletín
--   - Cada uno: No enviar | Email | Push | Email + Push
--
-- Schema:
--   PRIMARY KEY (instructor_id, category)
--   delivery: enum 'none' | 'email' | 'push' | 'both'
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.notification_delivery AS ENUM (
    'none',
    'email',
    'push',
    'both'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.instructor_notification_prefs (
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (length(category) BETWEEN 1 AND 60),
  delivery public.notification_delivery NOT NULL DEFAULT 'none',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instructor_id, category)
);

CREATE INDEX IF NOT EXISTS idx_instructor_notif_prefs_gym
  ON public.instructor_notification_prefs(gym_id, instructor_id);

COMMENT ON TABLE public.instructor_notification_prefs IS
  'Preferencias de notificación por instructor. category + delivery. UI define las categorías visibles (paridad LegacyGym).';

ALTER TABLE public.instructor_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instructor_notif_prefs_select_staff"
  ON public.instructor_notification_prefs FOR SELECT TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
    )
  );

CREATE POLICY "instructor_notif_prefs_insert_admin"
  ON public.instructor_notification_prefs FOR INSERT TO authenticated
  WITH CHECK (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "instructor_notif_prefs_update_admin"
  ON public.instructor_notification_prefs FOR UPDATE TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "instructor_notif_prefs_delete_admin"
  ON public.instructor_notification_prefs FOR DELETE TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_notification_prefs TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_instructor_notif_prefs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_instructor_notif_prefs_updated_at ON public.instructor_notification_prefs;
CREATE TRIGGER trg_instructor_notif_prefs_updated_at
  BEFORE UPDATE ON public.instructor_notification_prefs
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_instructor_notif_prefs_updated_at();

-- ============================================================================
-- RPC bulk_set_instructor_notif_prefs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.bulk_set_instructor_notif_prefs(
  p_instructor_id uuid,
  p_prefs jsonb  -- array [{"category":"new_client","delivery":"email"},...]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_gym_id uuid;
  v_count integer := 0;
  v_pref jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE = '28000';
  END IF;

  SELECT gym_id INTO v_gym_id FROM public.instructors WHERE id = p_instructor_id;
  IF v_gym_id IS NULL THEN
    RAISE EXCEPTION 'instructor no existe' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE user_id = auth.uid() AND gym_id = v_gym_id AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Sin permiso' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_prefs) <> 'array' THEN
    RAISE EXCEPTION 'p_prefs debe ser array' USING ERRCODE = '22023';
  END IF;

  FOR v_pref IN SELECT * FROM jsonb_array_elements(p_prefs)
  LOOP
    INSERT INTO public.instructor_notification_prefs (
      instructor_id, gym_id, category, delivery, updated_by
    )
    VALUES (
      p_instructor_id,
      v_gym_id,
      v_pref->>'category',
      (v_pref->>'delivery')::public.notification_delivery,
      auth.uid()
    )
    ON CONFLICT (instructor_id, category) DO UPDATE SET
      delivery = EXCLUDED.delivery,
      updated_by = auth.uid(),
      updated_at = now();
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$fn$;

REVOKE ALL ON FUNCTION public.bulk_set_instructor_notif_prefs(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_set_instructor_notif_prefs(uuid, jsonb) TO authenticated;
