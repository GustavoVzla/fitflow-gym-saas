-- =============================================================================
-- 0023 — Extend current_user_gyms to return plan
--
-- Motivacion: Fase 2 plan gating necesita saber el plan del gym activo para
-- renderizar badges en sidebar y gating de features. Hoy current_user_gyms
-- devuelve gym_id/name/slug/logo/status/role pero NO el plan.
-- =============================================================================

-- Postgres no permite cambiar RETURNS TABLE con OR REPLACE → DROP first
DROP FUNCTION IF EXISTS public.current_user_gyms();

CREATE FUNCTION public.current_user_gyms()
RETURNS TABLE(
  gym_id uuid,
  gym_name text,
  gym_slug text,
  gym_logo_url text,
  gym_status public.gym_status,
  gym_plan public.gym_plan,
  role public.gym_user_role
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id AS gym_id,
    g.name AS gym_name,
    g.slug AS gym_slug,
    g.logo_url AS gym_logo_url,
    g.status AS gym_status,
    g.plan AS gym_plan,
    gu.role
  FROM public.gyms g
  JOIN public.gym_users gu ON gu.gym_id = g.id
  WHERE gu.user_id = auth.uid()
    AND gu.is_active = true
    AND g.deleted_at IS NULL
  ORDER BY gu.accepted_at DESC NULLS LAST, gu.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.current_user_gyms() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_gyms() TO authenticated;
