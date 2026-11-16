-- Rollback 0032 — restaurar current_user_gyms sin brand_color + quitar columna

DROP FUNCTION IF EXISTS public.current_user_gyms();

CREATE OR REPLACE FUNCTION public.current_user_gyms()
RETURNS TABLE(
  gym_id uuid, gym_name text, gym_slug text, gym_logo_url text,
  gym_status gym_status, gym_plan gym_plan, role gym_user_role
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT g.id, g.name, g.slug, g.logo_url, g.status, g.plan, gu.role
  FROM public.gyms g JOIN public.gym_users gu ON gu.gym_id = g.id
  WHERE gu.user_id = auth.uid() AND gu.is_active = true AND g.deleted_at IS NULL
  ORDER BY gu.accepted_at DESC NULLS LAST, gu.created_at DESC;
$fn$;
REVOKE ALL ON FUNCTION public.current_user_gyms() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_gyms() TO authenticated;

ALTER TABLE public.gyms DROP COLUMN IF EXISTS brand_color;
