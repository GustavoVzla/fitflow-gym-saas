-- =============================================================================
-- 0017 — Stripe Webhook Secret RPCs (Fase 1C)
--
-- `set_gym_stripe_webhook_secret`: llamada desde /configuracion tab Pagos por el gym
--   para guardar el signing secret (whsec_...) del endpoint Stripe. Guarded por
--   super-admin O owner/admin del gym. Cifrado en Supabase Vault.
--
-- `get_gym_stripe_webhook_secret`: llamada desde el webhook handler
--   /api/webhooks/stripe/[gymId] (corre con service_role, auth.uid() es NULL).
--   SIN guard de auth — la seguridad se obtiene despues via verificacion de firma Stripe.
--   Aun asi es SECURITY DEFINER para acceder a vault.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_gym_stripe_webhook_secret(
  p_gym_id uuid,
  p_webhook_secret text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_old_webhook_uuid uuid;
  v_new_webhook_uuid uuid;
BEGIN
  IF NOT (public.is_app_admin() OR private.is_gym_owner_or_admin(p_gym_id)) THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = '42501';
  END IF;

  IF p_webhook_secret IS NULL OR length(p_webhook_secret) < 10 THEN
    RAISE EXCEPTION 'webhook_secret invalido (minimo 10 chars)' USING ERRCODE = '22023';
  END IF;

  -- Buscar webhook vault id previo (para rotar)
  SELECT stripe_webhook_vault_id INTO v_old_webhook_uuid
  FROM public.gyms WHERE id = p_gym_id;

  -- Crear secret nuevo
  v_new_webhook_uuid := vault.create_secret(
    p_webhook_secret,
    p_gym_id::text || '_stripe_webhook_secret_' || extract(epoch from now())::bigint::text,
    'FitFlow Stripe webhook signing secret for gym ' || p_gym_id::text
  );

  -- Actualizar referencia en gyms
  UPDATE public.gyms
  SET stripe_webhook_vault_id = v_new_webhook_uuid,
      updated_at = now()
  WHERE id = p_gym_id;

  -- Borrar viejo si existia
  IF v_old_webhook_uuid IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_old_webhook_uuid;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_gym_stripe_webhook_secret(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_gym_stripe_webhook_secret(uuid, text) TO authenticated;


-- -----------------------------------------------------------------------------
-- get_gym_stripe_webhook_secret: sin guard auth, SOLO callable por service_role
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_gym_stripe_webhook_secret(p_gym_id uuid)
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
  SELECT stripe_webhook_vault_id INTO v_vault_id
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

REVOKE ALL ON FUNCTION public.get_gym_stripe_webhook_secret(uuid) FROM PUBLIC;
-- Solo service_role — NO grant a authenticated
GRANT EXECUTE ON FUNCTION public.get_gym_stripe_webhook_secret(uuid) TO service_role;

COMMENT ON FUNCTION public.get_gym_stripe_webhook_secret IS
  'Callable solo por service_role (webhook handler). Seguridad via verificacion posterior de firma Stripe.';
