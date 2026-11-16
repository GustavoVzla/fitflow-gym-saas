-- =============================================================================
-- 0012 — admin_create_gym_with_owner soporta p_payment_mode (Decision #102)
-- Drop+recreate porque cambia la signatura (añade param).
-- =============================================================================

DROP FUNCTION IF EXISTS public.admin_create_gym_with_owner(text,text,text,text,public.gym_plan,text,text);

CREATE OR REPLACE FUNCTION public.admin_create_gym_with_owner(
  p_client_email text,
  p_temp_password text,
  p_gym_name text,
  p_gym_slug text,
  p_plan public.gym_plan DEFAULT 'base',
  p_gym_phone text DEFAULT NULL,
  p_gym_email text DEFAULT NULL,
  p_payment_mode public.payment_mode DEFAULT 'manual'
)
RETURNS TABLE(out_user_id uuid, out_gym_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_admin_id uuid;
  v_new_user_id uuid;
  v_new_gym_id uuid;
BEGIN
  SELECT a.user_id INTO v_admin_id
  FROM public.app_admins a
  WHERE a.user_id = auth.uid() AND a.is_active = true;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: requiere privilegios de super-admin' USING ERRCODE = '42501';
  END IF;

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

  IF EXISTS (SELECT 1 FROM auth.users u WHERE u.email = p_client_email) THEN
    RAISE EXCEPTION 'Email ya registrado: %', p_client_email USING ERRCODE = '23505';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gyms g WHERE g.slug = p_gym_slug) THEN
    RAISE EXCEPTION 'Slug ya en uso: %', p_gym_slug USING ERRCODE = '23505';
  END IF;

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

  INSERT INTO public.gyms (name, slug, email, phone, plan, timezone, currency, status, payment_mode)
  VALUES (p_gym_name, p_gym_slug, p_gym_email, p_gym_phone, p_plan, 'Europe/Madrid', 'EUR', 'active', p_payment_mode)
  RETURNING id INTO v_new_gym_id;

  INSERT INTO public.gym_users (gym_id, user_id, role, is_active, invited_by, accepted_at)
  VALUES (v_new_gym_id, v_new_user_id, 'owner', true, auth.uid(), NOW());

  INSERT INTO public.gym_settings (gym_id) VALUES (v_new_gym_id)
  ON CONFLICT (gym_id) DO NOTHING;

  out_user_id := v_new_user_id;
  out_gym_id := v_new_gym_id;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_gym_with_owner(text,text,text,text,public.gym_plan,text,text,public.payment_mode) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_gym_with_owner(text,text,text,text,public.gym_plan,text,text,public.payment_mode) TO authenticated;
