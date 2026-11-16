-- =============================================================================
-- 0027 — Onboarding step overrides (backlog 5, Fase 3B)
--
-- Añade flags per-step a gym_onboarding_progress:
--   - skipped: el paso no aplica para este gym (ej. no necesitan instructores)
--   - manually_completed: el paso está hecho fuera del sistema (ej. migración
--     de socios desde otra plataforma, sin crear rows en members)
--
-- Una sola columna JSONB `step_overrides` en gym_onboarding_progress con
-- estructura por step:
--   { "profile": { "skipped": false, "manually_completed": true }, ... }
--
-- Refactoriza get_onboarding_state para que un paso sea "done" si
-- (has_data OR manually_completed) AND NOT skipped. Cuando skipped=true
-- el paso se cuenta igual como "done" para el progreso total (no molesta).
-- =============================================================================

-- 1. Añade columna JSONB con default empty object
ALTER TABLE public.gym_onboarding_progress
  ADD COLUMN IF NOT EXISTS step_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. RPCs para modificar overrides

CREATE OR REPLACE FUNCTION public.mark_step_skipped(
  p_gym_id uuid,
  p_step_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticacion requerida' USING ERRCODE = '28000';
  END IF;

  IF p_step_key NOT IN ('profile', 'instructors', 'tariffs', 'classes', 'instances', 'members') THEN
    RAISE EXCEPTION 'step_key invalido: %', p_step_key USING ERRCODE = '22023';
  END IF;

  -- Upsert: si no existe row, se crea con el override. Si existe, merge JSON.
  INSERT INTO public.gym_onboarding_progress (gym_id, step_overrides)
  VALUES (p_gym_id, jsonb_build_object(p_step_key, jsonb_build_object('skipped', true, 'manually_completed', false)))
  ON CONFLICT (gym_id) DO UPDATE SET
    step_overrides = public.gym_onboarding_progress.step_overrides
      || jsonb_build_object(p_step_key, jsonb_build_object('skipped', true, 'manually_completed', false)),
    updated_at = now();
END;
$fn$;

REVOKE ALL ON FUNCTION public.mark_step_skipped(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_step_skipped(uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.mark_step_completed_manually(
  p_gym_id uuid,
  p_step_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticacion requerida' USING ERRCODE = '28000';
  END IF;

  IF p_step_key NOT IN ('profile', 'instructors', 'tariffs', 'classes', 'instances', 'members') THEN
    RAISE EXCEPTION 'step_key invalido: %', p_step_key USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.gym_onboarding_progress (gym_id, step_overrides)
  VALUES (p_gym_id, jsonb_build_object(p_step_key, jsonb_build_object('skipped', false, 'manually_completed', true)))
  ON CONFLICT (gym_id) DO UPDATE SET
    step_overrides = public.gym_onboarding_progress.step_overrides
      || jsonb_build_object(p_step_key, jsonb_build_object('skipped', false, 'manually_completed', true)),
    updated_at = now();
END;
$fn$;

REVOKE ALL ON FUNCTION public.mark_step_completed_manually(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_step_completed_manually(uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.clear_step_override(
  p_gym_id uuid,
  p_step_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticacion requerida' USING ERRCODE = '28000';
  END IF;

  IF p_step_key NOT IN ('profile', 'instructors', 'tariffs', 'classes', 'instances', 'members') THEN
    RAISE EXCEPTION 'step_key invalido: %', p_step_key USING ERRCODE = '22023';
  END IF;

  UPDATE public.gym_onboarding_progress
  SET step_overrides = step_overrides - p_step_key,
      updated_at = now()
  WHERE gym_id = p_gym_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.clear_step_override(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_step_override(uuid, text) TO authenticated;

-- 3. Refactor get_onboarding_state para incluir overrides en cálculo + output
-- Mantiene backward compat: devuelve los mismos campos anteriores + step_overrides

CREATE OR REPLACE FUNCTION public.get_onboarding_state(p_gym_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed boolean;
  v_profile_complete_data boolean := false;
  v_has_instructors_data boolean := false;
  v_has_tariffs_data boolean := false;
  v_has_classes_data boolean := false;
  v_has_instances_data boolean := false;
  v_has_members_data boolean := false;
  v_dismissed_at timestamptz;
  v_overrides jsonb := '{}'::jsonb;

  -- Effective (data-derived OR manually_completed) AND NOT skipped=hidden
  -- Para el contador, skipped cuenta como "done" (no molesta)
  v_profile_done boolean;
  v_instructors_done boolean;
  v_tariffs_done boolean;
  v_classes_done boolean;
  v_instances_done boolean;
  v_members_done boolean;
  v_completed_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticacion requerida' USING ERRCODE = '28000';
  END IF;

  SELECT
    EXISTS (
      SELECT 1 FROM public.gym_users
      WHERE gym_id = p_gym_id AND user_id = v_uid AND is_active = true
    ) OR public.is_app_admin()
  INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  -- 1. Profile complete (data-derived): phone + address + tax_id
  SELECT COALESCE(
    (phone IS NOT NULL AND phone <> '') AND
    (address IS NOT NULL AND address <> '') AND
    (tax_id IS NOT NULL AND tax_id <> ''),
    false
  )
  INTO v_profile_complete_data
  FROM public.gyms WHERE id = p_gym_id;

  -- 2-6: counts
  SELECT EXISTS (SELECT 1 FROM public.instructors WHERE gym_id = p_gym_id AND is_active = true)
    INTO v_has_instructors_data;
  SELECT EXISTS (SELECT 1 FROM public.tariffs WHERE gym_id = p_gym_id AND is_active = true)
    INTO v_has_tariffs_data;
  SELECT EXISTS (SELECT 1 FROM public.classes WHERE gym_id = p_gym_id AND is_active = true)
    INTO v_has_classes_data;
  SELECT EXISTS (SELECT 1 FROM public.class_instances WHERE gym_id = p_gym_id AND end_at >= now())
    INTO v_has_instances_data;
  SELECT EXISTS (SELECT 1 FROM public.members WHERE gym_id = p_gym_id)
    INTO v_has_members_data;

  -- Overrides + dismissed
  SELECT dismissed_at, step_overrides
  INTO v_dismissed_at, v_overrides
  FROM public.gym_onboarding_progress
  WHERE gym_id = p_gym_id;

  v_overrides := COALESCE(v_overrides, '{}'::jsonb);

  -- Effective done per step:
  -- done = (data OR manually_completed) OR skipped
  --   if skipped → counted as done (no molesta al usuario)
  --   if manually_completed → counted as done (aunque no haya data)
  --   otherwise → check data-derived
  v_profile_done := v_profile_complete_data
    OR COALESCE((v_overrides #>> '{profile,manually_completed}')::boolean, false)
    OR COALESCE((v_overrides #>> '{profile,skipped}')::boolean, false);
  v_instructors_done := v_has_instructors_data
    OR COALESCE((v_overrides #>> '{instructors,manually_completed}')::boolean, false)
    OR COALESCE((v_overrides #>> '{instructors,skipped}')::boolean, false);
  v_tariffs_done := v_has_tariffs_data
    OR COALESCE((v_overrides #>> '{tariffs,manually_completed}')::boolean, false)
    OR COALESCE((v_overrides #>> '{tariffs,skipped}')::boolean, false);
  v_classes_done := v_has_classes_data
    OR COALESCE((v_overrides #>> '{classes,manually_completed}')::boolean, false)
    OR COALESCE((v_overrides #>> '{classes,skipped}')::boolean, false);
  v_instances_done := v_has_instances_data
    OR COALESCE((v_overrides #>> '{instances,manually_completed}')::boolean, false)
    OR COALESCE((v_overrides #>> '{instances,skipped}')::boolean, false);
  v_members_done := v_has_members_data
    OR COALESCE((v_overrides #>> '{members,manually_completed}')::boolean, false)
    OR COALESCE((v_overrides #>> '{members,skipped}')::boolean, false);

  v_completed_count :=
    (v_profile_done::int) +
    (v_instructors_done::int) +
    (v_tariffs_done::int) +
    (v_classes_done::int) +
    (v_instances_done::int) +
    (v_members_done::int);

  RETURN jsonb_build_object(
    -- Effective done (lo que la UI usa para pintar el checkmark)
    'profile_complete', v_profile_done,
    'has_instructors', v_instructors_done,
    'has_tariffs', v_tariffs_done,
    'has_classes', v_classes_done,
    'has_instances', v_instances_done,
    'has_members', v_members_done,
    -- Overrides detallados (para mostrar badges "manual"/"omitido" en UI)
    'step_overrides', v_overrides,
    -- Summary
    'completed_count', v_completed_count,
    'total_count', 6,
    'all_done', v_completed_count = 6,
    'dismissed_at', v_dismissed_at
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_onboarding_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_onboarding_state(uuid) TO authenticated;
