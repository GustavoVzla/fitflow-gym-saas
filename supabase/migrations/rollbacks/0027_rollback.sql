-- 0027 Rollback — remove step overrides + restore previous get_onboarding_state

DROP FUNCTION IF EXISTS public.mark_step_skipped(uuid, text);
DROP FUNCTION IF EXISTS public.mark_step_completed_manually(uuid, text);
DROP FUNCTION IF EXISTS public.clear_step_override(uuid, text);

ALTER TABLE public.gym_onboarding_progress DROP COLUMN IF EXISTS step_overrides;

-- Restore previous get_onboarding_state (pre-0027, sin overrides)
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
  v_profile_complete boolean := false;
  v_has_instructors boolean := false;
  v_has_tariffs boolean := false;
  v_has_classes boolean := false;
  v_has_instances boolean := false;
  v_has_members boolean := false;
  v_completed_count int := 0;
  v_dismissed_at timestamptz;
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

  SELECT COALESCE(
    (phone IS NOT NULL AND phone <> '') AND
    (address IS NOT NULL AND address <> '') AND
    (tax_id IS NOT NULL AND tax_id <> ''),
    false
  )
  INTO v_profile_complete
  FROM public.gyms WHERE id = p_gym_id;

  SELECT EXISTS (SELECT 1 FROM public.instructors WHERE gym_id = p_gym_id AND is_active = true) INTO v_has_instructors;
  SELECT EXISTS (SELECT 1 FROM public.tariffs WHERE gym_id = p_gym_id AND is_active = true) INTO v_has_tariffs;
  SELECT EXISTS (SELECT 1 FROM public.classes WHERE gym_id = p_gym_id AND is_active = true) INTO v_has_classes;
  SELECT EXISTS (SELECT 1 FROM public.class_instances WHERE gym_id = p_gym_id AND end_at >= now()) INTO v_has_instances;
  SELECT EXISTS (SELECT 1 FROM public.members WHERE gym_id = p_gym_id) INTO v_has_members;

  v_completed_count :=
    (v_profile_complete::int) + (v_has_instructors::int) + (v_has_tariffs::int) +
    (v_has_classes::int) + (v_has_instances::int) + (v_has_members::int);

  SELECT dismissed_at INTO v_dismissed_at FROM public.gym_onboarding_progress WHERE gym_id = p_gym_id;

  RETURN jsonb_build_object(
    'profile_complete', v_profile_complete,
    'has_instructors', v_has_instructors,
    'has_tariffs', v_has_tariffs,
    'has_classes', v_has_classes,
    'has_instances', v_has_instances,
    'has_members', v_has_members,
    'completed_count', v_completed_count,
    'total_count', 6,
    'all_done', v_completed_count = 6,
    'dismissed_at', v_dismissed_at
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_onboarding_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_onboarding_state(uuid) TO authenticated;
