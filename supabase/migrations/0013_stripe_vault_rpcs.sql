-- =============================================================================
-- 0013 — Supabase Vault helpers para credenciales Stripe del gym (modo direct_keys)
-- Decision #102. La secret key del gym se cifra con Vault (AES-256) y se guarda
-- referencia UUID en gyms.stripe_key_vault_id. Solo super-admin y owner del gym
-- pueden leer/escribir.
-- =============================================================================

-- Helper interno: verifica si auth.uid() es owner del gym (rol owner o admin)
CREATE OR REPLACE FUNCTION private.is_gym_owner_or_admin(p_gym_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gym_users gu
    WHERE gu.gym_id = p_gym_id
      AND gu.user_id = auth.uid()
      AND gu.is_active = true
      AND gu.role IN ('owner', 'admin', 'super_admin')
  );
$$;

GRANT EXECUTE ON FUNCTION private.is_gym_owner_or_admin(uuid) TO authenticated;

-- =============================================================================
-- RPC set_gym_stripe_keys: guarda publishable key + cifra secret key en Vault
-- Accesible por super-admin O owner/admin del propio gym (self-service)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_gym_stripe_keys(
  p_gym_id uuid,
  p_publishable_key text,
  p_secret_key text,
  p_webhook_secret text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_uuid uuid;
  v_webhook_uuid uuid;
  v_old_secret_uuid uuid;
  v_old_webhook_uuid uuid;
  v_secret_name text;
  v_webhook_name text;
BEGIN
  -- Solo super-admin o owner/admin del gym
  IF NOT (public.is_app_admin() OR private.is_gym_owner_or_admin(p_gym_id)) THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  IF p_publishable_key IS NULL OR length(p_publishable_key) < 10 THEN
    RAISE EXCEPTION 'Publishable key invalida';
  END IF;
  IF p_secret_key IS NULL OR length(p_secret_key) < 10 THEN
    RAISE EXCEPTION 'Secret key invalida';
  END IF;

  -- Nombres unicos en vault.secrets (deben ser UNIQUE). Incluimos timestamp
  -- para permitir rotar keys sin conflicto de nombre. El UUID en gyms apunta
  -- siempre al mas reciente; los viejos quedan huerfanos en vault.
  v_secret_name := 'fitflow_gym_' || p_gym_id::text || '_stripe_secret_' || extract(epoch from now())::bigint::text;
  v_webhook_name := 'fitflow_gym_' || p_gym_id::text || '_stripe_webhook_' || extract(epoch from now())::bigint::text;

  -- Guardar nuevos secrets en Vault
  v_secret_uuid := vault.create_secret(
    p_secret_key,
    v_secret_name,
    'FitFlow Stripe secret key for gym ' || p_gym_id::text
  );

  IF p_webhook_secret IS NOT NULL AND length(p_webhook_secret) > 10 THEN
    v_webhook_uuid := vault.create_secret(
      p_webhook_secret,
      v_webhook_name,
      'FitFlow Stripe webhook secret for gym ' || p_gym_id::text
    );
  END IF;

  -- Recoger UUIDs anteriores para limpieza (opcional; Vault no auto-borra)
  SELECT stripe_key_vault_id, stripe_webhook_vault_id
    INTO v_old_secret_uuid, v_old_webhook_uuid
  FROM public.gyms WHERE id = p_gym_id;

  -- Actualizar gyms con nuevos UUIDs y publishable key (no sensible)
  UPDATE public.gyms
  SET
    stripe_publishable_key = p_publishable_key,
    stripe_key_vault_id = v_secret_uuid,
    stripe_webhook_vault_id = COALESCE(v_webhook_uuid, stripe_webhook_vault_id),
    stripe_onboarded_at = now(),
    updated_at = now()
  WHERE id = p_gym_id;

  -- Borrar secrets antiguos de vault.secrets si existian
  IF v_old_secret_uuid IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_old_secret_uuid;
  END IF;
  IF v_old_webhook_uuid IS NOT NULL AND v_webhook_uuid IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_old_webhook_uuid;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_gym_stripe_keys(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_gym_stripe_keys(uuid, text, text, text) TO authenticated;

-- =============================================================================
-- RPC get_gym_stripe_secret: devuelve la secret decifrada
-- Accesible por super-admin O owner/admin del gym
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_gym_stripe_secret(p_gym_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_vault_id uuid;
  v_secret text;
BEGIN
  IF NOT (public.is_app_admin() OR private.is_gym_owner_or_admin(p_gym_id)) THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  SELECT stripe_key_vault_id INTO v_vault_id
  FROM public.gyms WHERE id = p_gym_id;

  IF v_vault_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE id = v_vault_id;

  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.get_gym_stripe_secret(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gym_stripe_secret(uuid) TO authenticated;

-- =============================================================================
-- RPC clear_gym_stripe_keys: revoca credenciales (borra secrets de Vault + nulifica gyms)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.clear_gym_stripe_keys(p_gym_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_uuid uuid;
  v_webhook_uuid uuid;
BEGIN
  IF NOT (public.is_app_admin() OR private.is_gym_owner_or_admin(p_gym_id)) THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  SELECT stripe_key_vault_id, stripe_webhook_vault_id
    INTO v_secret_uuid, v_webhook_uuid
  FROM public.gyms WHERE id = p_gym_id;

  UPDATE public.gyms
  SET
    stripe_publishable_key = NULL,
    stripe_key_vault_id = NULL,
    stripe_webhook_vault_id = NULL,
    stripe_onboarded_at = NULL,
    updated_at = now()
  WHERE id = p_gym_id;

  IF v_secret_uuid IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_secret_uuid;
  END IF;
  IF v_webhook_uuid IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_webhook_uuid;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_gym_stripe_keys(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_gym_stripe_keys(uuid) TO authenticated;
