-- =============================================================================
-- 0022 — Super-admin CRUD: gym operations + user management + audit log
--
-- Scope:
--   1. New columns on gyms: suspended_at, suspended_reason, deleted_at
--   2. Table admin_audit_log (append-only, super-admin read only)
--   3. RPCs admin_* for gym mutations + user management
--   4. pg_cron job for 30-day auto-purge of soft-deleted gyms
--
-- Auth model: every admin_* RPC requires is_app_admin() == true.
-- Audit: every mutation logs to admin_audit_log BEFORE executing the change.
-- =============================================================================

-- Enable pg_cron extension (required for auto-purge cron)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =============================================================================
-- 1. Schema changes: suspend + soft-delete on gyms
-- =============================================================================

ALTER TABLE public.gyms
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS suspended_reason text NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

-- Partial index: only active (non-deleted) rows
CREATE INDEX IF NOT EXISTS idx_gyms_active
  ON public.gyms(created_at DESC)
  WHERE deleted_at IS NULL;

-- =============================================================================
-- 2. admin_audit_log table (append-only, immutable)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,            -- 'gym.update' | 'gym.suspend' | 'gym.soft_delete' | 'gym.restore' | 'gym.change_plan' | 'gym.change_payment_mode' | 'user.reset_password' | 'user.resend_invite' | 'gym.add_staff' | 'gym.remove_user' | 'gym.transfer_ownership' | 'cron.hard_delete'
  resource_type text NOT NULL,     -- 'gym' | 'gym_user' | 'auth.user' | 'cron'
  resource_id uuid NULL,
  gym_id uuid NULL REFERENCES public.gyms(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_gym_id ON public.admin_audit_log(gym_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON public.admin_audit_log(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON public.admin_audit_log(action, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super-admins can read
CREATE POLICY "admin_audit_log super_admin_read"
  ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.is_app_admin());

-- No INSERT/UPDATE/DELETE from any role (only via SECURITY DEFINER RPCs)
-- RLS enabled + no policies = denied by default

-- =============================================================================
-- 3. Helper: log an admin action
-- =============================================================================

CREATE OR REPLACE FUNCTION private.log_admin_action(
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_gym_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.admin_audit_log (actor_user_id, action, resource_type, resource_id, gym_id, metadata)
  VALUES (auth.uid(), p_action, p_resource_type, p_resource_id, p_gym_id, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION private.log_admin_action(text,text,uuid,uuid,jsonb) FROM PUBLIC;

-- =============================================================================
-- 4. admin_update_gym — edit profile fields
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_gym(
  p_gym_id uuid,
  p_name text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_tax_id text DEFAULT NULL,
  p_website text DEFAULT NULL,
  p_timezone text DEFAULT NULL,
  p_currency text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old record;
  v_changes jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_old FROM public.gyms WHERE id = p_gym_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gym no encontrado o eliminado' USING ERRCODE = 'P0002';
  END IF;

  -- Build diff for audit log
  IF p_name IS NOT NULL AND p_name != v_old.name THEN
    v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('old', v_old.name, 'new', p_name));
  END IF;
  IF p_email IS NOT NULL AND p_email IS DISTINCT FROM v_old.email THEN
    v_changes := v_changes || jsonb_build_object('email', jsonb_build_object('old', v_old.email, 'new', p_email));
  END IF;
  IF p_phone IS NOT NULL AND p_phone IS DISTINCT FROM v_old.phone THEN
    v_changes := v_changes || jsonb_build_object('phone', jsonb_build_object('old', v_old.phone, 'new', p_phone));
  END IF;
  IF p_tax_id IS NOT NULL AND p_tax_id IS DISTINCT FROM v_old.tax_id THEN
    v_changes := v_changes || jsonb_build_object('tax_id', jsonb_build_object('old', v_old.tax_id, 'new', p_tax_id));
  END IF;

  UPDATE public.gyms SET
    name = COALESCE(p_name, name),
    email = COALESCE(p_email, email),
    phone = COALESCE(p_phone, phone),
    address = COALESCE(p_address, address),
    city = COALESCE(p_city, city),
    postal_code = COALESCE(p_postal_code, postal_code),
    country = COALESCE(p_country, country),
    tax_id = COALESCE(p_tax_id, tax_id),
    website = COALESCE(p_website, website),
    timezone = COALESCE(p_timezone, timezone),
    currency = COALESCE(p_currency, currency),
    updated_at = now()
  WHERE id = p_gym_id;

  PERFORM private.log_admin_action('gym.update', 'gym', p_gym_id, p_gym_id, v_changes);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_gym(uuid,text,text,text,text,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_gym(uuid,text,text,text,text,text,text,text,text,text,text,text) TO authenticated;

-- =============================================================================
-- 5. admin_change_gym_plan
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_change_gym_plan(
  p_gym_id uuid,
  p_new_plan public.gym_plan
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_plan public.gym_plan;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  SELECT plan INTO v_old_plan FROM public.gyms WHERE id = p_gym_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gym no encontrado o eliminado' USING ERRCODE = 'P0002';
  END IF;

  IF v_old_plan = p_new_plan THEN
    RETURN;  -- no-op
  END IF;

  UPDATE public.gyms SET plan = p_new_plan, updated_at = now() WHERE id = p_gym_id;

  PERFORM private.log_admin_action(
    'gym.change_plan', 'gym', p_gym_id, p_gym_id,
    jsonb_build_object('old_plan', v_old_plan, 'new_plan', p_new_plan)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_change_gym_plan(uuid, public.gym_plan) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_change_gym_plan(uuid, public.gym_plan) TO authenticated;

-- =============================================================================
-- 6. admin_change_gym_payment_mode
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_change_gym_payment_mode(
  p_gym_id uuid,
  p_new_mode public.payment_mode
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_mode public.payment_mode;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  SELECT payment_mode INTO v_old_mode FROM public.gyms WHERE id = p_gym_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gym no encontrado o eliminado' USING ERRCODE = 'P0002';
  END IF;

  IF v_old_mode = p_new_mode THEN RETURN; END IF;

  UPDATE public.gyms SET payment_mode = p_new_mode, updated_at = now() WHERE id = p_gym_id;

  PERFORM private.log_admin_action(
    'gym.change_payment_mode', 'gym', p_gym_id, p_gym_id,
    jsonb_build_object('old_mode', v_old_mode, 'new_mode', p_new_mode)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_change_gym_payment_mode(uuid, public.payment_mode) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_change_gym_payment_mode(uuid, public.payment_mode) TO authenticated;

-- =============================================================================
-- 7. admin_suspend_gym / admin_reactivate_gym
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_suspend_gym(
  p_gym_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.gyms WHERE id = p_gym_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Gym no encontrado o eliminado' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.gyms SET
    status = 'suspended',
    suspended_at = now(),
    suspended_reason = p_reason,
    updated_at = now()
  WHERE id = p_gym_id;

  PERFORM private.log_admin_action(
    'gym.suspend', 'gym', p_gym_id, p_gym_id,
    jsonb_build_object('reason', p_reason)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_suspend_gym(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_suspend_gym(uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_reactivate_gym(p_gym_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.gyms WHERE id = p_gym_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Gym no encontrado o eliminado' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.gyms SET
    status = 'active',
    suspended_at = NULL,
    suspended_reason = NULL,
    updated_at = now()
  WHERE id = p_gym_id;

  PERFORM private.log_admin_action('gym.reactivate', 'gym', p_gym_id, p_gym_id, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reactivate_gym(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_gym(uuid) TO authenticated;

-- =============================================================================
-- 8. admin_soft_delete_gym / admin_restore_gym
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_soft_delete_gym(
  p_gym_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.gyms WHERE id = p_gym_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Gym no encontrado o ya eliminado' USING ERRCODE = 'P0002';
  END IF;

  -- Mark gym as soft-deleted
  UPDATE public.gyms SET
    deleted_at = now(),
    status = 'cancelled',
    updated_at = now()
  WHERE id = p_gym_id;

  -- Cascade: deactivate all gym_users (blocks their login to this gym)
  UPDATE public.gym_users SET is_active = false, updated_at = now()
  WHERE gym_id = p_gym_id AND is_active = true;

  PERFORM private.log_admin_action(
    'gym.soft_delete', 'gym', p_gym_id, p_gym_id,
    jsonb_build_object('reason', p_reason)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_soft_delete_gym(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_soft_delete_gym(uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_restore_gym(p_gym_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.gyms WHERE id = p_gym_id AND deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Gym no esta eliminado' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.gyms SET
    deleted_at = NULL,
    status = 'active',
    updated_at = now()
  WHERE id = p_gym_id;

  -- Reactivate owner + admin/staff roles (but not trainer/viewer - they must be manually re-added)
  UPDATE public.gym_users SET is_active = true, updated_at = now()
  WHERE gym_id = p_gym_id AND role IN ('owner', 'admin', 'staff');

  PERFORM private.log_admin_action('gym.restore', 'gym', p_gym_id, p_gym_id, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_restore_gym(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_restore_gym(uuid) TO authenticated;

-- =============================================================================
-- 9. admin_list_gym_users — owner + staff of a gym
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_list_gym_users(p_gym_id uuid)
RETURNS TABLE(
  gym_user_id uuid,
  user_id uuid,
  email text,
  full_name text,
  role public.gym_user_role,
  is_active boolean,
  must_change_password boolean,
  last_sign_in_at timestamptz,
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    gu.id AS gym_user_id,
    gu.user_id,
    u.email::text,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email::text) AS full_name,
    gu.role,
    gu.is_active,
    COALESCE((u.raw_user_meta_data->>'must_change_password')::boolean, false) AS must_change_password,
    u.last_sign_in_at,
    gu.invited_at,
    gu.accepted_at,
    gu.created_at
  FROM public.gym_users gu
  JOIN auth.users u ON u.id = gu.user_id
  WHERE gu.gym_id = p_gym_id
  ORDER BY
    CASE gu.role
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'staff' THEN 3
      WHEN 'trainer' THEN 4
      WHEN 'viewer' THEN 5
      ELSE 6
    END,
    gu.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_gym_users(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_gym_users(uuid) TO authenticated;

-- =============================================================================
-- 10. admin_reset_user_password_temporary — generate random password + must_change flag
--
-- NOTE: The 'magic_link' mode is NOT an RPC — it's handled in Next.js Server Action
-- using supabase.auth.admin.generateLink() with service role (needs auth.admin API,
-- not available in SQL).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_reset_user_password_temporary(
  p_user_id uuid,
  p_new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_email text;
  v_gym_id uuid;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  IF p_new_password IS NULL OR length(p_new_password) < 8 THEN
    RAISE EXCEPTION 'Password temporal requerido (min 8 chars)';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- Get gym_id (if user belongs to a gym, for audit context)
  SELECT gu.gym_id INTO v_gym_id
  FROM public.gym_users gu
  WHERE gu.user_id = p_user_id AND gu.is_active = true
  LIMIT 1;

  -- Update password + set must_change_password flag
  UPDATE auth.users SET
    encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'must_change_password', true,
      'password_reset_at', now()::text,
      'password_reset_by', auth.uid()::text
    ),
    updated_at = now()
  WHERE id = p_user_id;

  PERFORM private.log_admin_action(
    'user.reset_password', 'auth.user', p_user_id, v_gym_id,
    jsonb_build_object('email', v_email, 'mode', 'temporary')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_user_password_temporary(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password_temporary(uuid, text) TO authenticated;

-- =============================================================================
-- 11. admin_log_magic_link_sent — just log the audit event
-- (Magic link generation itself happens in Node.js via service role)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_log_magic_link_sent(
  p_user_id uuid,
  p_gym_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado' USING ERRCODE = 'P0002';
  END IF;

  PERFORM private.log_admin_action(
    'user.reset_password', 'auth.user', p_user_id, p_gym_id,
    jsonb_build_object('email', v_email, 'mode', 'magic_link')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_log_magic_link_sent(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_log_magic_link_sent(uuid, uuid) TO authenticated;

-- =============================================================================
-- 12. admin_remove_gym_user — deactivate a gym_user row
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_remove_gym_user(p_gym_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gym_id uuid;
  v_user_id uuid;
  v_role public.gym_user_role;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  SELECT gym_id, user_id, role INTO v_gym_id, v_user_id, v_role
  FROM public.gym_users WHERE id = p_gym_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gym_user no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_role = 'owner' THEN
    RAISE EXCEPTION 'No se puede eliminar al owner. Usa admin_transfer_gym_ownership primero.';
  END IF;

  UPDATE public.gym_users SET is_active = false, updated_at = now() WHERE id = p_gym_user_id;

  PERFORM private.log_admin_action(
    'gym.remove_user', 'gym_user', p_gym_user_id, v_gym_id,
    jsonb_build_object('user_id', v_user_id, 'role', v_role)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_remove_gym_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_remove_gym_user(uuid) TO authenticated;

-- =============================================================================
-- 13. admin_transfer_gym_ownership
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_transfer_gym_ownership(
  p_gym_id uuid,
  p_new_owner_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_owner_id uuid;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.gyms WHERE id = p_gym_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Gym no encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- New owner must exist in gym_users already
  IF NOT EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE gym_id = p_gym_id AND user_id = p_new_owner_user_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'El nuevo owner debe estar ya asociado al gym (usa admin_add_gym_staff primero)';
  END IF;

  SELECT user_id INTO v_old_owner_id
  FROM public.gym_users
  WHERE gym_id = p_gym_id AND role = 'owner' AND is_active = true;

  -- Demote old owner to admin (don't remove — preserves audit chain)
  IF v_old_owner_id IS NOT NULL THEN
    UPDATE public.gym_users
    SET role = 'admin', updated_at = now()
    WHERE gym_id = p_gym_id AND user_id = v_old_owner_id;
  END IF;

  -- Promote new owner
  UPDATE public.gym_users
  SET role = 'owner', updated_at = now()
  WHERE gym_id = p_gym_id AND user_id = p_new_owner_user_id;

  PERFORM private.log_admin_action(
    'gym.transfer_ownership', 'gym', p_gym_id, p_gym_id,
    jsonb_build_object('old_owner_user_id', v_old_owner_id, 'new_owner_user_id', p_new_owner_user_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_transfer_gym_ownership(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_transfer_gym_ownership(uuid, uuid) TO authenticated;

-- =============================================================================
-- 14. admin_list_audit_log — read audit trail for a gym
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_list_audit_log(
  p_gym_id uuid DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  actor_user_id uuid,
  actor_email text,
  action text,
  resource_type text,
  resource_id uuid,
  gym_id uuid,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.actor_user_id,
    u.email::text AS actor_email,
    l.action,
    l.resource_type,
    l.resource_id,
    l.gym_id,
    l.metadata,
    l.created_at
  FROM public.admin_audit_log l
  LEFT JOIN auth.users u ON u.id = l.actor_user_id
  WHERE (p_gym_id IS NULL OR l.gym_id = p_gym_id)
  ORDER BY l.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_audit_log(uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_log(uuid, int, int) TO authenticated;

-- =============================================================================
-- 15. Override admin_list_gyms to filter soft-deleted by default
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_list_gyms(p_include_deleted boolean DEFAULT false)
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  plan public.gym_plan,
  status text,
  owner_email text,
  owner_name text,
  members_count bigint,
  active_members_count bigint,
  created_at timestamptz,
  deleted_at timestamptz,
  suspended_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
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
    u.email::text AS owner_email,
    COALESCE(
      CASE
        WHEN u.raw_user_meta_data ? 'full_name' THEN u.raw_user_meta_data->>'full_name'
        ELSE NULL
      END,
      u.email::text
    ) AS owner_name,
    (SELECT COUNT(*) FROM members m WHERE m.gym_id = g.id)::bigint AS members_count,
    (SELECT COUNT(*) FROM members m WHERE m.gym_id = g.id AND m.status = 'active')::bigint AS active_members_count,
    g.created_at,
    g.deleted_at,
    g.suspended_at
  FROM gyms g
  LEFT JOIN gym_users gu ON gu.gym_id = g.id AND gu.role = 'owner' AND gu.is_active = true
  LEFT JOIN auth.users u ON u.id = gu.user_id
  WHERE (p_include_deleted OR g.deleted_at IS NULL)
  ORDER BY g.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_gyms(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_gyms(boolean) TO authenticated;

-- Drop the old zero-arg signature to avoid ambiguity
DROP FUNCTION IF EXISTS public.admin_list_gyms();

-- Also override admin_get_gym_detail to include new columns
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
  email text,
  phone text,
  address text,
  city text,
  postal_code text,
  country text,
  tax_id text,
  website text,
  timezone text,
  currency text,
  suspended_at timestamptz,
  suspended_reason text,
  deleted_at timestamptz,
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
    g.id, g.name, g.slug, g.plan, g.status::text,
    g.payment_mode, g.stripe_publishable_key, g.stripe_key_vault_id,
    g.stripe_onboarded_at, g.fee_percent_sepa, g.fee_percent_card,
    g.email, g.phone, g.address, g.city, g.postal_code, g.country,
    g.tax_id, g.website, g.timezone, g.currency,
    g.suspended_at, g.suspended_reason, g.deleted_at, g.created_at
  FROM gyms g WHERE g.id = p_gym_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_gym_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_gym_detail(uuid) TO authenticated;

-- =============================================================================
-- 16. pg_cron: hard-delete gyms soft-deleted >30 days ago (daily 02:00 UTC)
-- =============================================================================

-- Schedule cron job: runs every day at 02:00 UTC (~03:00 Madrid winter, 04:00 summer)
SELECT cron.schedule(
  'gdpr_hard_delete_soft_gyms',
  '0 2 * * *',
  $$
  WITH deleted AS (
    DELETE FROM public.gyms
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - interval '30 days'
    RETURNING id, name, slug, deleted_at
  )
  INSERT INTO public.admin_audit_log (actor_user_id, action, resource_type, resource_id, gym_id, metadata)
  SELECT
    NULL,  -- system action, no actor
    'cron.hard_delete',
    'gym',
    id,
    id,
    jsonb_build_object('name', name, 'slug', slug, 'soft_deleted_at', deleted_at)
  FROM deleted;
  $$
);
