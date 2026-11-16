-- =============================================================================
-- 0022 Rollback — Revert admin CRUD schema + RPCs + cron
--
-- WARNING: rolling back does NOT restore soft-deleted data lost to the
-- 30-day auto-purge cron. Only use if 0022 was applied by mistake.
-- =============================================================================

-- 1. Unschedule cron job
SELECT cron.unschedule('gdpr_hard_delete_soft_gyms');

-- 2. Drop admin CRUD functions (keep existing pre-0022 signatures intact)
DROP FUNCTION IF EXISTS public.admin_update_gym(uuid,text,text,text,text,text,text,text,text,text,text,text);
DROP FUNCTION IF EXISTS public.admin_change_gym_plan(uuid, public.gym_plan);
DROP FUNCTION IF EXISTS public.admin_change_gym_payment_mode(uuid, public.payment_mode);
DROP FUNCTION IF EXISTS public.admin_suspend_gym(uuid, text);
DROP FUNCTION IF EXISTS public.admin_reactivate_gym(uuid);
DROP FUNCTION IF EXISTS public.admin_soft_delete_gym(uuid, text);
DROP FUNCTION IF EXISTS public.admin_restore_gym(uuid);
DROP FUNCTION IF EXISTS public.admin_list_gym_users(uuid);
DROP FUNCTION IF EXISTS public.admin_reset_user_password_temporary(uuid, text);
DROP FUNCTION IF EXISTS public.admin_log_magic_link_sent(uuid, uuid);
DROP FUNCTION IF EXISTS public.admin_remove_gym_user(uuid);
DROP FUNCTION IF EXISTS public.admin_transfer_gym_ownership(uuid, uuid);
DROP FUNCTION IF EXISTS public.admin_list_audit_log(uuid, int, int);
DROP FUNCTION IF EXISTS private.log_admin_action(text,text,uuid,uuid,jsonb);

-- 3. Restore admin_list_gyms to pre-0022 signature (zero args)
DROP FUNCTION IF EXISTS public.admin_list_gyms(boolean);

CREATE OR REPLACE FUNCTION public.admin_list_gyms()
RETURNS TABLE(
  id uuid, name text, slug text, plan public.gym_plan, status text,
  owner_email text, owner_name text,
  members_count bigint, active_members_count bigint, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT g.id, g.name, g.slug, g.plan, g.status::text,
    u.email::text,
    COALESCE(CASE WHEN u.raw_user_meta_data ? 'full_name' THEN u.raw_user_meta_data->>'full_name' ELSE NULL END, u.email::text),
    (SELECT COUNT(*) FROM members m WHERE m.gym_id = g.id)::bigint,
    (SELECT COUNT(*) FROM members m WHERE m.gym_id = g.id AND m.status = 'active')::bigint,
    g.created_at
  FROM gyms g
  LEFT JOIN gym_users gu ON gu.gym_id = g.id AND gu.role = 'owner' AND gu.is_active = true
  LEFT JOIN auth.users u ON u.id = gu.user_id
  ORDER BY g.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_gyms() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_gyms() TO authenticated;

-- 4. Restore admin_get_gym_detail to pre-0022 signature
DROP FUNCTION IF EXISTS public.admin_get_gym_detail(uuid);

CREATE OR REPLACE FUNCTION public.admin_get_gym_detail(p_gym_id uuid)
RETURNS TABLE(
  id uuid, name text, slug text, plan public.gym_plan, status text,
  payment_mode public.payment_mode, stripe_publishable_key text,
  stripe_key_vault_id uuid, stripe_onboarded_at timestamptz,
  fee_percent_sepa numeric, fee_percent_card numeric, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT g.id, g.name, g.slug, g.plan, g.status::text,
    g.payment_mode, g.stripe_publishable_key, g.stripe_key_vault_id,
    g.stripe_onboarded_at, g.fee_percent_sepa, g.fee_percent_card, g.created_at
  FROM gyms g WHERE g.id = p_gym_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_gym_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_gym_detail(uuid) TO authenticated;

-- 5. Drop audit log table
DROP TABLE IF EXISTS public.admin_audit_log;

-- 6. Drop new gym columns
ALTER TABLE public.gyms
  DROP COLUMN IF EXISTS suspended_at,
  DROP COLUMN IF EXISTS suspended_reason,
  DROP COLUMN IF EXISTS deleted_at;

DROP INDEX IF EXISTS idx_gyms_active;

-- pg_cron extension intentionally left enabled (harmless if nothing uses it)
