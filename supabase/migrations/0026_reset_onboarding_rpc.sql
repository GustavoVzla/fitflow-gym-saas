-- =============================================================================
-- 0026 — RPC reset_onboarding_dismissed (backlog 4)
--
-- Permite al gym owner/admin reactivar el checklist "Empieza aquí" después
-- de haberlo dismiss. Simplemente pone dismissed_at = NULL.
--
-- Parte de /configuracion → botón "Ver guía de nuevo".
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reset_onboarding_dismissed(p_gym_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticacion requerida' USING ERRCODE = '28000';
  END IF;

  -- UPDATE pasa por RLS onboarding_progress_update_gym_admin (migracion 0024)
  -- → solo owner/admin del gym puede ejecutar. Staff/viewer obtendrá 0 rows
  -- afectadas (silent fail), pero sin error para no revelar info.
  UPDATE public.gym_onboarding_progress
  SET dismissed_at = NULL, updated_at = now()
  WHERE gym_id = p_gym_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.reset_onboarding_dismissed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_onboarding_dismissed(uuid) TO authenticated;
