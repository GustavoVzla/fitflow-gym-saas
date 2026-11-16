-- =============================================================================
-- 0066 — instructor_check_ins (historial fichado instructor) — PB
--
-- Contexto: handoff paridad100 bloque 2 — Real Decreto-ley 8/2019 obligatorio
-- en España (registro horario laboral). App PWA registra fichaje cuando
-- instructor abre /inicio. Panel muestra historial + total horas mes.
--
-- Schema:
--   - instructor_id, gym_id (RLS desnormalizado)
--   - checked_in_at NOT NULL, checked_out_at NULLABLE (sesión abierta)
--   - location_lat/lng NULLABLE (geo opcional, día 1 sin geo real)
--   - source ('webapp' | 'pwa' | 'manual')
--
-- Decision #111: UPDATE/DELETE explícitas (manual puede corregir).
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.check_in_source AS ENUM ('webapp', 'pwa', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.instructor_check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  checked_out_at timestamptz,
  duration_minutes integer GENERATED ALWAYS AS (
    CASE
      WHEN checked_out_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (checked_out_at - checked_in_at))::integer / 60
      ELSE NULL
    END
  ) STORED,
  location_lat numeric(9,6),
  location_lng numeric(9,6),
  source public.check_in_source NOT NULL DEFAULT 'pwa',
  notes text,
  cancelled boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_in_dates_order CHECK (checked_out_at IS NULL OR checked_out_at >= checked_in_at)
);

CREATE INDEX IF NOT EXISTS idx_check_ins_instructor_date
  ON public.instructor_check_ins(instructor_id, checked_in_at DESC)
  WHERE cancelled = false;

CREATE INDEX IF NOT EXISTS idx_check_ins_gym_date
  ON public.instructor_check_ins(gym_id, checked_in_at DESC)
  WHERE cancelled = false;

-- Index parcial: sesión abierta (no checkout) por instructor — útil para validar
-- "no abrir sesión nueva sin cerrar la anterior"
CREATE INDEX IF NOT EXISTS idx_check_ins_open_session
  ON public.instructor_check_ins(instructor_id)
  WHERE checked_out_at IS NULL AND cancelled = false;

COMMENT ON TABLE public.instructor_check_ins IS
  'Historial fichado instructor (RD-ley 8/2019). App PWA INSERT, Panel SELECT/UPDATE manual correction.';

ALTER TABLE public.instructor_check_ins ENABLE ROW LEVEL SECURITY;

-- SELECT: staff del gym + instructor el suyo propio (auth user_id matching)
CREATE POLICY "check_ins_select_staff_or_self"
  ON public.instructor_check_ins FOR SELECT TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
    )
    OR instructor_id IN (
      SELECT id FROM public.instructors WHERE user_id = auth.uid()
    )
  );

-- INSERT: instructor propio (App PWA) o admin (entrada manual desde Panel)
CREATE POLICY "check_ins_insert_self_or_admin"
  ON public.instructor_check_ins FOR INSERT TO authenticated
  WITH CHECK (
    instructor_id IN (
      SELECT id FROM public.instructors WHERE user_id = auth.uid()
    )
    OR gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- UPDATE: instructor propio (cerrar su sesión) + admin (correcciones)
CREATE POLICY "check_ins_update_self_or_admin"
  ON public.instructor_check_ins FOR UPDATE TO authenticated
  USING (
    instructor_id IN (
      SELECT id FROM public.instructors WHERE user_id = auth.uid()
    )
    OR gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    instructor_id IN (
      SELECT id FROM public.instructors WHERE user_id = auth.uid()
    )
    OR gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- DELETE: solo admin (legal — no se borra registro horario, se anula)
CREATE POLICY "check_ins_delete_admin"
  ON public.instructor_check_ins FOR DELETE TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_check_ins TO authenticated;

-- ============================================================================
-- Trigger updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.touch_instructor_check_ins_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_instructor_check_ins_updated_at ON public.instructor_check_ins;
CREATE TRIGGER trg_instructor_check_ins_updated_at
  BEFORE UPDATE ON public.instructor_check_ins
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_instructor_check_ins_updated_at();

-- ============================================================================
-- RPC instructor_check_in (entrada simple — abre sesión)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.instructor_check_in(
  p_location_lat numeric DEFAULT NULL,
  p_location_lng numeric DEFAULT NULL,
  p_source public.check_in_source DEFAULT 'pwa'
)
RETURNS public.instructor_check_ins
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_instructor public.instructors;
  v_row public.instructor_check_ins;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_instructor FROM public.instructors WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
  IF v_instructor IS NULL THEN
    RAISE EXCEPTION 'No eres instructor activo' USING ERRCODE = '42501';
  END IF;

  -- Cierra sesión abierta previa si existe (auto-checkout silencioso)
  UPDATE public.instructor_check_ins
    SET checked_out_at = now(), updated_at = now()
    WHERE instructor_id = v_instructor.id
      AND checked_out_at IS NULL
      AND cancelled = false;

  -- Crea nueva entrada
  INSERT INTO public.instructor_check_ins (
    instructor_id, gym_id, checked_in_at, location_lat, location_lng, source, created_by
  )
  VALUES (
    v_instructor.id, v_instructor.gym_id, now(), p_location_lat, p_location_lng, p_source, auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$fn$;

REVOKE ALL ON FUNCTION public.instructor_check_in(numeric, numeric, public.check_in_source) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.instructor_check_in(numeric, numeric, public.check_in_source) TO authenticated;

-- ============================================================================
-- RPC instructor_check_out — cierra sesión abierta del instructor actual
-- ============================================================================

CREATE OR REPLACE FUNCTION public.instructor_check_out()
RETURNS public.instructor_check_ins
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_instructor public.instructors;
  v_row public.instructor_check_ins;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_instructor FROM public.instructors WHERE user_id = auth.uid() LIMIT 1;
  IF v_instructor IS NULL THEN
    RAISE EXCEPTION 'No eres instructor' USING ERRCODE = '42501';
  END IF;

  UPDATE public.instructor_check_ins
    SET checked_out_at = now(), updated_at = now()
    WHERE instructor_id = v_instructor.id
      AND checked_out_at IS NULL
      AND cancelled = false
    RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'No hay sesión abierta para cerrar' USING ERRCODE = '22023';
  END IF;

  RETURN v_row;
END;
$fn$;

REVOKE ALL ON FUNCTION public.instructor_check_out() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.instructor_check_out() TO authenticated;

-- ============================================================================
-- RPC: total horas trabajadas mes
-- ============================================================================

CREATE OR REPLACE FUNCTION public.instructor_check_ins_month_total(
  p_instructor_id uuid,
  p_month date DEFAULT date_trunc('month', CURRENT_DATE)::date
)
RETURNS TABLE(
  total_minutes integer,
  total_sessions integer
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_month_start date := date_trunc('month', p_month)::date;
  v_month_end date := (v_month_start + interval '1 month')::date;
  v_gym_id uuid;
BEGIN
  SELECT gym_id INTO v_gym_id FROM public.instructors WHERE id = p_instructor_id;
  IF v_gym_id IS NULL THEN
    RAISE EXCEPTION 'instructor no existe' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE user_id = auth.uid() AND gym_id = v_gym_id AND role IN ('owner', 'admin', 'trainer')
  ) AND NOT EXISTS (
    SELECT 1 FROM public.instructors WHERE id = p_instructor_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sin permiso' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT
      COALESCE(SUM(duration_minutes), 0)::integer,
      COUNT(*)::integer
    FROM public.instructor_check_ins
    WHERE instructor_id = p_instructor_id
      AND cancelled = false
      AND checked_in_at >= v_month_start
      AND checked_in_at < v_month_end
      AND checked_out_at IS NOT NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public.instructor_check_ins_month_total(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.instructor_check_ins_month_total(uuid, date) TO authenticated;
