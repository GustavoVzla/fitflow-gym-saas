-- =============================================================================
-- 0024 — Onboarding persistence (Fase 3A)
--
-- Scope minimo:
--   1. Tabla gym_onboarding_progress con dismissed_at (persistencia del "No volver a mostrar")
--   2. RLS: members del gym SELECT/UPDATE su fila. Super-admin aal2 SELECT all.
--   3. RPC get_onboarding_state(p_gym_id) computa 6 pasos derivados de data real
--      + merge con dismissed_at. Reemplaza el bloque inline en dashboard-data.ts.
--   4. RPC dismiss_onboarding(p_gym_id) marca dismissed_at = now() (Server Action).
--
-- Quitado deliberadamente (backlog post-Demo Studio):
--   - Flags skipped/manually_completed por paso (Fase 3B)
--   - Boton "Ver guia de nuevo" en /configuracion (Fase 3C)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gym_onboarding_progress (
  gym_id uuid PRIMARY KEY REFERENCES public.gyms(id) ON DELETE CASCADE,
  dismissed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger updated_at (reuse pattern from 0001_initial_schema)
CREATE TRIGGER set_gym_onboarding_progress_updated_at
  BEFORE UPDATE ON public.gym_onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.gym_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- SELECT: members of the gym see own gym's row. Super-admins see all.
CREATE POLICY "onboarding_progress_select_members"
  ON public.gym_onboarding_progress FOR SELECT TO authenticated
  USING (
    gym_id = ANY (SELECT private.current_user_gym_ids())
    OR public.is_app_admin()
  );

-- INSERT: only gym owner/admin can create the row (first dismiss triggers it).
-- Super-admin could also insert via service role if needed for migrations.
CREATE POLICY "onboarding_progress_insert_gym_admin"
  ON public.gym_onboarding_progress FOR INSERT TO authenticated
  WITH CHECK (private.is_gym_owner_or_admin(gym_id));

-- UPDATE: only gym owner/admin mutates their own row.
CREATE POLICY "onboarding_progress_update_gym_admin"
  ON public.gym_onboarding_progress FOR UPDATE TO authenticated
  USING (private.is_gym_owner_or_admin(gym_id))
  WITH CHECK (private.is_gym_owner_or_admin(gym_id));

-- No DELETE policy — rows follow gym lifecycle (CASCADE when gym is hard-deleted).

-- =============================================================================
-- RPC get_onboarding_state
-- Returns jsonb with the 6 derived steps + dismissed_at + counts.
-- Security definer so it bypasses the member-only RLS when super-admins call
-- it (they can see onboarding state of any gym). Auth check: must be either a
-- member of the gym or an app_admin.
-- =============================================================================

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

  -- Auth: member of gym OR super-admin
  SELECT
    EXISTS (
      SELECT 1 FROM public.gym_users
      WHERE gym_id = p_gym_id AND user_id = v_uid AND is_active = true
    ) OR public.is_app_admin()
  INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  -- 1. Profile complete: phone + address + tax_id
  SELECT COALESCE(
    (phone IS NOT NULL AND phone <> '') AND
    (address IS NOT NULL AND address <> '') AND
    (tax_id IS NOT NULL AND tax_id <> ''),
    false
  )
  INTO v_profile_complete
  FROM public.gyms WHERE id = p_gym_id;

  -- 2-6: counts
  SELECT EXISTS (SELECT 1 FROM public.instructors WHERE gym_id = p_gym_id AND is_active = true)
    INTO v_has_instructors;
  SELECT EXISTS (SELECT 1 FROM public.tariffs WHERE gym_id = p_gym_id AND is_active = true)
    INTO v_has_tariffs;
  SELECT EXISTS (SELECT 1 FROM public.classes WHERE gym_id = p_gym_id AND is_active = true)
    INTO v_has_classes;
  SELECT EXISTS (SELECT 1 FROM public.class_instances WHERE gym_id = p_gym_id AND end_at >= now())
    INTO v_has_instances;
  SELECT EXISTS (SELECT 1 FROM public.members WHERE gym_id = p_gym_id)
    INTO v_has_members;

  v_completed_count :=
    (v_profile_complete::int) +
    (v_has_instructors::int) +
    (v_has_tariffs::int) +
    (v_has_classes::int) +
    (v_has_instances::int) +
    (v_has_members::int);

  -- Dismissed flag from onboarding table (row may not exist yet)
  SELECT dismissed_at INTO v_dismissed_at
  FROM public.gym_onboarding_progress
  WHERE gym_id = p_gym_id;

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

-- =============================================================================
-- RPC dismiss_onboarding
-- Upserts the row with dismissed_at = now() for the given gym.
-- Only gym owner/admin allowed (via RLS on UPDATE + WITH CHECK on INSERT).
-- SECURITY INVOKER so RLS applies.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.dismiss_onboarding(p_gym_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticacion requerida' USING ERRCODE = '28000';
  END IF;

  INSERT INTO public.gym_onboarding_progress (gym_id, dismissed_at)
  VALUES (p_gym_id, now())
  ON CONFLICT (gym_id) DO UPDATE SET
    dismissed_at = now(),
    updated_at = now();
END;
$fn$;

REVOKE ALL ON FUNCTION public.dismiss_onboarding(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dismiss_onboarding(uuid) TO authenticated;
