-- =============================================================================
-- 0047 — Matriz permisos instructores (paridad LegacyGym ficha instructor) — PB
--
-- Contexto: F1 audit LegacyGym ficha instructor sección "PERMISOS" — matriz
-- de 20 permission_keys × niveles 0-3 (Sin acceso / Parcial / Sólo propias /
-- Total). Sin esto, gym >5 empleados no puede limitar acceso a Jordan "ver
-- clases solo donde es instructor" sin acceso a pagos.
--
-- Schema:
--   PRIMARY KEY (instructor_id, permission_key)
--   level: 0-3 (semántica varía por permission_key — UI map a labels)
--   gym_id desnormalizado para RLS sin join extra
--
-- Decision #111: UPDATE/DELETE policies explícitas desde día 1.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.instructor_permissions (
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  permission_key text NOT NULL CHECK (length(permission_key) BETWEEN 1 AND 60),
  level integer NOT NULL CHECK (level BETWEEN 0 AND 3),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instructor_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_instructor_permissions_gym
  ON public.instructor_permissions(gym_id, instructor_id);

COMMENT ON TABLE public.instructor_permissions IS
  'Matriz permisos por instructor. permission_key + level. UI mapea level a label semántico (ver F1).';

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.instructor_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instructor_permissions_select_staff"
  ON public.instructor_permissions FOR SELECT TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
    )
  );

CREATE POLICY "instructor_permissions_insert_admin"
  ON public.instructor_permissions FOR INSERT TO authenticated
  WITH CHECK (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "instructor_permissions_update_admin"
  ON public.instructor_permissions FOR UPDATE TO authenticated
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

CREATE POLICY "instructor_permissions_delete_admin"
  ON public.instructor_permissions FOR DELETE TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_permissions TO authenticated;

-- ============================================================================
-- Trigger updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.touch_instructor_permissions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_instructor_permissions_updated_at ON public.instructor_permissions;
CREATE TRIGGER trg_instructor_permissions_updated_at
  BEFORE UPDATE ON public.instructor_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_instructor_permissions_updated_at();

-- ============================================================================
-- RPC bulk_set_instructor_permissions
--
-- Upsert atómico de la matriz completa. La UI envía el array de pares
-- (permission_key, level) y el RPC sustituye in-place.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.bulk_set_instructor_permissions(
  p_instructor_id uuid,
  p_perms jsonb  -- array [{"key":"manage_payments","level":2},...]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_gym_id uuid;
  v_inserted integer := 0;
  v_perm jsonb;
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
    RAISE EXCEPTION 'Sin permiso para configurar permisos del instructor' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_perms) <> 'array' THEN
    RAISE EXCEPTION 'p_perms debe ser un array JSON' USING ERRCODE = '22023';
  END IF;

  FOR v_perm IN SELECT * FROM jsonb_array_elements(p_perms)
  LOOP
    INSERT INTO public.instructor_permissions (
      instructor_id, gym_id, permission_key, level, updated_by
    )
    VALUES (
      p_instructor_id,
      v_gym_id,
      v_perm->>'key',
      (v_perm->>'level')::integer,
      auth.uid()
    )
    ON CONFLICT (instructor_id, permission_key) DO UPDATE SET
      level = EXCLUDED.level,
      updated_by = auth.uid(),
      updated_at = now();
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN v_inserted;
END;
$fn$;

REVOKE ALL ON FUNCTION public.bulk_set_instructor_permissions(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_set_instructor_permissions(uuid, jsonb) TO authenticated;
