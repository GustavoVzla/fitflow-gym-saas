-- =============================================================================
-- 0016 — RPC mark_tariff_stripe_synced (Fase 1C)
--
-- Llamada desde Server Action tras crear/actualizar Product+Price en Stripe.
-- Actualiza tariffs con sync info. Guard: owner/admin del gym O super-admin.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mark_tariff_stripe_synced(
  p_tariff_id uuid,
  p_product_id text,
  p_price_id text,
  p_sync_status text DEFAULT 'synced',
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gym_id uuid;
  v_product_id text;
  v_price_id text;
BEGIN
  -- Validar sync_status
  IF p_sync_status NOT IN ('pending', 'synced', 'manual', 'error', 'disabled') THEN
    RAISE EXCEPTION 'Invalid sync_status: %', p_sync_status USING ERRCODE = '22023';
  END IF;

  -- Tratar '' como NULL (limitacion de tipos TS generados por supabase — param es 'string', no 'string|null')
  v_product_id := NULLIF(p_product_id, '');
  v_price_id := NULLIF(p_price_id, '');

  -- Obtener gym_id de la tarifa
  SELECT t.gym_id INTO v_gym_id
  FROM public.tariffs t
  WHERE t.id = p_tariff_id;

  IF v_gym_id IS NULL THEN
    RAISE EXCEPTION 'Tarifa no encontrada: %', p_tariff_id USING ERRCODE = '42P01';
  END IF;

  -- Guard: owner/admin del gym O super-admin
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.gym_users gu
      WHERE gu.gym_id = v_gym_id
        AND gu.user_id = auth.uid()
        AND gu.is_active = true
        AND gu.role IN ('owner', 'admin')
    )
    OR public.is_app_admin()
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: requiere rol owner/admin o super-admin' USING ERRCODE = '42501';
  END IF;

  -- Update tarifa
  UPDATE public.tariffs SET
    stripe_product_id = v_product_id,
    stripe_price_id = v_price_id,
    stripe_sync_status = p_sync_status,
    stripe_sync_error = p_error,
    stripe_last_synced_at = CASE
      WHEN p_sync_status IN ('synced', 'manual') THEN now()
      ELSE stripe_last_synced_at
    END,
    updated_at = now()
  WHERE id = p_tariff_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_tariff_stripe_synced(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_tariff_stripe_synced(uuid, text, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.mark_tariff_stripe_synced IS
  'Marca tarifa como sincronizada con Stripe (Fase 1C). Guarded por owner/admin del gym o super-admin. Llamada desde Server Action tras stripe.products.create + stripe.prices.create.';
