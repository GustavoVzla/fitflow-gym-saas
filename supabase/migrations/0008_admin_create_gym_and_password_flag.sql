-- Migracion 0008: alta asistida desde /admin/new-gym
-- 1. RPC admin_create_gym_with_owner: crea auth user + gym + gym_users owner atomicamente
-- 2. Marca raw_user_meta_data.must_change_password=true para forzar cambio en primer login
-- 3. Proteccion por lista blanca de emails FitFlow (hardcoded en la funcion)

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
  v_admin_email text;
  v_new_user_id uuid;
  v_new_gym_id uuid;
  v_allowed_admins text[] := ARRAY[
    'admin@example.com',
    'soluciones@example.com',
    'owner@example.com',
    'ops@example.com'
  ];
BEGIN
  -- 0. Solo owners FitFlow pueden ejecutar
  SELECT email INTO v_admin_email FROM auth.users WHERE id = auth.uid();
  IF v_admin_email IS NULL OR NOT (v_admin_email = ANY(v_allowed_admins)) THEN
    RAISE EXCEPTION 'Acceso denegado: este endpoint es solo para administradores FitFlow' USING ERRCODE = '42501';
  END IF;

  -- 1. Validaciones basicas
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

  -- 2. Crear user auth con password temporal + email ya confirmado + flag must_change_password
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
    jsonb_build_object('must_change_password', true, 'created_by_admin', v_admin_email),
    FALSE, NOW(), NOW()
  )
  RETURNING id INTO v_new_user_id;

  -- 3. Registro identidad email (necesario para que funcione login)
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

  -- 5. Asociar user como owner del gym
  INSERT INTO gym_users (gym_id, user_id, role, is_active, invited_by, accepted_at)
  VALUES (v_new_gym_id, v_new_user_id, 'owner', true, auth.uid(), NOW());

  -- 6. Gym settings default (FK trigger lo puede hacer tambien, por si acaso explicito)
  INSERT INTO gym_settings (gym_id) VALUES (v_new_gym_id)
  ON CONFLICT (gym_id) DO NOTHING;

  RETURN QUERY SELECT v_new_user_id, v_new_gym_id;
END;
$$;

-- Permiso: solo authenticated users (la funcion valida admin internamente)
REVOKE ALL ON FUNCTION public.admin_create_gym_with_owner(text,text,text,text,public.gym_plan,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_gym_with_owner(text,text,text,text,public.gym_plan,text,text) TO authenticated;

-- Helper: limpiar flag must_change_password tras cambio exitoso
CREATE OR REPLACE FUNCTION public.clear_must_change_password()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data - 'must_change_password'
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.clear_must_change_password() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_must_change_password() TO authenticated;
