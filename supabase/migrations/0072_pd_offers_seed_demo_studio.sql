-- =============================================================================
-- 0072 — PD paridad 100%: seed demo oferta Demo Studio
--
-- Idempotente (ON CONFLICT gym_id+code DO NOTHING). Safeguarded por slug='demo-studio'.
-- Permite walkthrough owner ver UI con dato real (cards + tariffsLabel + audienceLabel).
-- =============================================================================

DO $$
DECLARE
  v_gym_id uuid;
BEGIN
  SELECT id INTO v_gym_id FROM public.gyms WHERE slug = 'demo-studio' LIMIT 1;

  IF v_gym_id IS NOT NULL THEN
    INSERT INTO public.offers (
      gym_id, title, description,
      discount_type, discount_value,
      valid_from, valid_until,
      max_redemptions, code,
      target_audience, applicable_tariff_ids,
      is_active
    )
    VALUES (
      v_gym_id,
      'Bienvenida Demo Studio — 30% primera cuota',
      E'Oferta especial para socios nuevos (< 30 días).\n30% descuento sobre la primera cuota mensual.',
      'percentage',
      30.0,
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '60 days',
      100,
      'BIENVENIDA30',
      'new',
      ARRAY[]::uuid[], -- aplica a todas las tarifas
      true
    )
    ON CONFLICT (gym_id, code) DO NOTHING;
  END IF;
END $$;
