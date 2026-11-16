-- 0023 Rollback — restore current_user_gyms to pre-0023 signature (no gym_plan)

CREATE OR REPLACE FUNCTION public.current_user_gyms()
RETURNS TABLE(
  gym_id uuid,
  gym_name text,
  gym_slug text,
  gym_logo_url text,
  gym_status public.gym_status,
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
    gu.role
  FROM public.gyms g
  JOIN public.gym_users gu ON gu.gym_id = g.id
  WHERE gu.user_id = auth.uid()
    AND gu.is_active = true
  ORDER BY gu.accepted_at DESC NULLS LAST, gu.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.current_user_gyms() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_gyms() TO authenticated;
