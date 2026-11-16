-- =============================================================================
-- 0014 — RPC admin_get_gym_detail(gym_id) para panel super-admin
-- Super-admin NO tiene gym_users → query directa a gyms bloqueada por RLS.
-- Este RPC SECURITY DEFINER le da acceso al detalle de cualquier gym.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_gym_detail(p_gym_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  plan public.gym_plan,
  status text,
  payment_mode public.payment_mode,
  stripe_publishable_key text,
  stripe_key_vault_id uuid,
  stripe_onboarded_at timestamptz,
  fee_percent_sepa numeric,
  fee_percent_card numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    g.id,
    g.name,
    g.slug,
    g.plan,
    g.status::text,
    g.payment_mode,
    g.stripe_publishable_key,
    g.stripe_key_vault_id,
    g.stripe_onboarded_at,
    g.fee_percent_sepa,
    g.fee_percent_card,
    g.created_at
  FROM gyms g
  WHERE g.id = p_gym_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_gym_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_gym_detail(uuid) TO authenticated;
