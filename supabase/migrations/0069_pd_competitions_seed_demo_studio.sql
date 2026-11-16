-- =============================================================================
-- 0069 — PD paridad 100%: seed demo competición Demo Studio
--
-- Contexto: tras 0067-0068 (schema expand + registrations), sembrar 1 ejemplo
-- real para que owner / walkthrough vea contenido tangible en /competiciones
-- y en la ruta pública /c/{slug}.
--
-- Decisión:
--   - ON CONFLICT (gym_id, slug) DO NOTHING — idempotente (re-run safe).
--   - Safeguard por slug='demo-studio' — solo aplica si el gym existe.
--   - Fechas relativas a CURRENT_DATE + intervalos para no quedar obsoleto.
-- =============================================================================

DO $$
DECLARE
  v_gym_id uuid;
BEGIN
  SELECT id INTO v_gym_id FROM public.gyms WHERE slug = 'demo-studio' LIMIT 1;

  IF v_gym_id IS NOT NULL THEN
    INSERT INTO public.competitions (
      gym_id, name, description, start_date, end_date, type,
      slug, conditions,
      online_registration_enabled, price_cents, tax_percent,
      max_registrations, waitlist_enabled, categories,
      contact_email, contact_phone, location_address,
      latitude, longitude, is_active
    )
    VALUES (
      v_gym_id,
      'Reto Primavera Demo Studio 2026',
      E'Competición interna individual abierta a todos los socios y visitantes.\nEn cada sesión acumulas puntos según rondas y reps completadas.\nPremios para top-3 de cada categoría.',
      CURRENT_DATE + INTERVAL '10 days',
      CURRENT_DATE + INTERVAL '24 days',
      'Individual',
      'reto-primavera-2026',
      E'Edad mínima 16 años. Certificado médico obligatorio si >40 años.\nEquipamiento estándar del centro incluido.\nCancelación gratis hasta 48h antes del inicio.',
      true,
      2500, -- 25 €
      21.0,
      40,
      true,
      ARRAY['RX', 'Scaled', 'Masters']::text[],
      'info@demo-studio.example.com',
      '+34 600 000 000',
      'Calle Ejemplo 1, 28001 Madrid',
      40.460000,
      -3.700000,
      true
    )
    ON CONFLICT (gym_id, slug) DO NOTHING;
  END IF;
END $$;
