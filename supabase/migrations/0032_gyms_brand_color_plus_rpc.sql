-- =============================================================================
-- 0032 — gyms.brand_color + extender current_user_gyms RPC (internal ticket)
--
-- Contexto: walkthrough D4 sáb 26-abr con owner exige branding real
-- (logo Demo Studio + colores marca en sidebar). gym_settings.brand_color ya
-- existe pero requiere JOIN extra y no está en current_user_gyms.
--
-- Decisión: añadir brand_color a gyms (fuente de verdad única, 1 query para
-- obtener gym + branding). Mantener gym_settings.brand_color mirror temporal
-- (sync via trigger si UI actual lo actualiza) — deprecable en sprint 30d.
--
-- Schema:
--   - gyms.brand_color text DEFAULT '#3b8bea'
--   - current_user_gyms RPC extendida con gym_brand_color
--
-- NO crea bucket storage (upload UI se hace en sprint 30d, seed manual por ahora).
-- =============================================================================

ALTER TABLE public.gyms
  ADD COLUMN IF NOT EXISTS brand_color text NOT NULL DEFAULT '#3b8bea';

COMMENT ON COLUMN public.gyms.brand_color IS
  'Color primario del gym (hex). Aplicado a sidebar, botones primarios, accents. Default brand FitFlow #3b8bea.';

-- Sync initial desde gym_settings si había valor ahí
UPDATE public.gyms g
  SET brand_color = gs.brand_color
  FROM public.gym_settings gs
  WHERE gs.gym_id = g.id
    AND gs.brand_color IS NOT NULL
    AND gs.brand_color <> '#3b8bea';

-- =============================================================================
-- Extender current_user_gyms con gym_brand_color
-- =============================================================================

DROP FUNCTION IF EXISTS public.current_user_gyms();

CREATE OR REPLACE FUNCTION public.current_user_gyms()
RETURNS TABLE(
  gym_id uuid,
  gym_name text,
  gym_slug text,
  gym_logo_url text,
  gym_brand_color text,
  gym_status gym_status,
  gym_plan gym_plan,
  role gym_user_role
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    g.id AS gym_id,
    g.name AS gym_name,
    g.slug AS gym_slug,
    g.logo_url AS gym_logo_url,
    g.brand_color AS gym_brand_color,
    g.status AS gym_status,
    g.plan AS gym_plan,
    gu.role
  FROM public.gyms g
  JOIN public.gym_users gu ON gu.gym_id = g.id
  WHERE gu.user_id = auth.uid()
    AND gu.is_active = true
    AND g.deleted_at IS NULL
  ORDER BY gu.accepted_at DESC NULLS LAST, gu.created_at DESC;
$fn$;

REVOKE ALL ON FUNCTION public.current_user_gyms() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_gyms() TO authenticated;
