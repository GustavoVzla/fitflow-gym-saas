-- Migracion 0009: arquitectura super-admin separada del tenant
-- 1. Tabla app_admins (super-admins de la plataforma, NO pertenecen a ningun gym)
-- 2. Helper is_app_admin()
-- 3. RPC admin_create_gym_with_owner refactorizado para validar via app_admins
-- 4. RPC admin_list_gyms para panel /admin (lista de tenants + KPIs)

-- Tabla app_admins
CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: solo lectura para el propio admin; escritura via SECURITY DEFINER
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_admins self read" ON public.app_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Helper: comprueba si el user actual es super-admin
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_admins
    WHERE user_id = auth.uid() AND is_active = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated, anon;

-- Refactor: admin_create_gym_with_owner usa app_admins en lugar de email hardcoded
CREATE OR REPLACE FUNCTION public.admin_create_gym_with_owner(
  p_client_email text,
  p_temp_password text,
  p_gym_name text,
  p_gym_slug text,
  p_plan public.gym_plan DEFAULT 'base',
  p_gym_phone text DEFAULT NULL,
  p_gym_email text DEFAULT NULL
)
RETURNS TABLE(user_id uuid, gym_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_admin_id uuid;
  v_new_user_id uuid;
  v_new_gym_id uuid;
BEGIN
  -- 0. Solo super-admins activos
  SELECT user_id INTO v_admin_id
  FROM public.app_admins
  WHERE user_id = auth.uid() AND is_active = true;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: requiere privilegios de super-admin' USING ERRCODE = '42501';
  END IF;

  -- 1. Validaciones
  IF p_client_email IS NULL OR p_client_email = '' THEN
    RAISE EXCEPTION 'Email del cliente requerido';
  END IF;
  IF p_temp_password IS NULL OR length(p_temp_password) < 8 THEN
    RAISE EXCEPTION 'Password temporal requerido (min 8 chars)';
  END IF;
  IF p_gym_name IS NULL OR p_gym_name = '' THEN
    RAISE EXCEPTION 'Nombre del gym requerido';
  END IF;
  IF p_gym_slug IS NULL OR p_gym_slug !~ '^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$' THEN
    RAISE EXCEPTION 'Slug invalido (solo a-z 0-9 y guiones, 1-50 chars)';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_client_email) THEN
    RAISE EXCEPTION 'Email ya registrado: %', p_client_email USING ERRCODE = '23505';
  END IF;
  IF EXISTS (SELECT 1 FROM gyms WHERE slug = p_gym_slug) THEN
    RAISE EXCEPTION 'Slug ya en uso: %', p_gym_slug USING ERRCODE = '23505';
  END IF;

  -- 2. Crear user auth
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated', 'authenticated',
    p_client_email,
    extensions.crypt(p_temp_password, extensions.gen_salt('bf')),
    NOW(), '', '', '', '',
    jsonb_build_object('provider','email','providers',ARRAY['email']),
    jsonb_build_object('must_change_password', true, 'created_by_admin', v_admin_id),
    FALSE, NOW(), NOW()
  )
  RETURNING id INTO v_new_user_id;

  -- 3. Identidad email
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_new_user_id,
    jsonb_build_object('sub', v_new_user_id::text, 'email', p_client_email, 'email_verified', true),
    'email',
    v_new_user_id::text,
    NOW(), NOW(), NOW()
  );

  -- 4. Crear gym
  INSERT INTO gyms (name, slug, email, phone, plan, timezone, currency, status)
  VALUES (p_gym_name, p_gym_slug, p_gym_email, p_gym_phone, p_plan, 'Europe/Madrid', 'EUR', 'active')
  RETURNING id INTO v_new_gym_id;

  -- 5. Asociar owner
  INSERT INTO gym_users (gym_id, user_id, role, is_active, invited_by, accepted_at)
  VALUES (v_new_gym_id, v_new_user_id, 'owner', true, auth.uid(), NOW());

  -- 6. Settings default
  INSERT INTO gym_settings (gym_id) VALUES (v_new_gym_id)
  ON CONFLICT (gym_id) DO NOTHING;

  RETURN QUERY SELECT v_new_user_id, v_new_gym_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_gym_with_owner(text,text,text,text,public.gym_plan,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_gym_with_owner(text,text,text,text,public.gym_plan,text,text) TO authenticated;

-- RPC admin_list_gyms: lista todos los gyms + stats basicos (para /admin home)
CREATE OR REPLACE FUNCTION public.admin_list_gyms()
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
    g.created_at
  FROM gyms g
  LEFT JOIN gym_users gu ON gu.gym_id = g.id AND gu.role = 'owner' AND gu.is_active = true
  LEFT JOIN auth.users u ON u.id = gu.user_id
  ORDER BY g.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_gyms() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_gyms() TO authenticated;

-- RPC admin_global_stats: KPIs agregados (para /admin home header)
CREATE OR REPLACE FUNCTION public.admin_global_stats()
RETURNS TABLE(
  total_gyms bigint,
  active_gyms bigint,
  total_members bigint,
  total_active_members bigint,
  revenue_this_month_cents bigint,
  new_gyms_this_month bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_start date := date_trunc('month', now())::date;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM gyms)::bigint,
    (SELECT COUNT(*) FROM gyms WHERE status = 'active')::bigint,
    (SELECT COUNT(*) FROM members)::bigint,
    (SELECT COUNT(*) FROM members WHERE status = 'active')::bigint,
    COALESCE(
      (SELECT ROUND(SUM(amount) * 100)::bigint FROM payments
       WHERE status = 'completed' AND paid_at >= v_month_start),
      0
    ),
    (SELECT COUNT(*) FROM gyms WHERE created_at >= v_month_start)::bigint;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_global_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_global_stats() TO authenticated;
