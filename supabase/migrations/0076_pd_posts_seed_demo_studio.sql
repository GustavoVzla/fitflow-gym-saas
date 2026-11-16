-- =============================================================================
-- 0076 — PD paridad 100%: seed demo publicaciones Demo Studio
--
-- Idempotente (insert solo si no existe post con mismo gym+title+created_at).
-- Safeguarded por slug='demo-studio'. Permite walkthrough owner ver feed real.
-- =============================================================================

DO $$
DECLARE
  v_gym_id uuid;
BEGIN
  SELECT id INTO v_gym_id FROM public.gyms WHERE slug = 'demo-studio' LIMIT 1;
  IF v_gym_id IS NULL THEN RETURN; END IF;

  -- Post 1: Bienvenida (audiencia all)
  IF NOT EXISTS (SELECT 1 FROM public.posts WHERE gym_id = v_gym_id AND title = '¡Bienvenidos a Demo Studio!') THEN
    INSERT INTO public.posts (gym_id, title, content, tags, media_urls, audience, is_published, published_at)
    VALUES (
      v_gym_id,
      '¡Bienvenidos a Demo Studio!',
      E'Gracias por unirte a nuestra comunidad.\n\nRecuerda que puedes reservar clases desde la app y consultar el horario semanal. Si tienes cualquier duda, escríbenos o pregunta a tu entrenador.',
      ARRAY['bienvenida', 'comunidad']::text[],
      ARRAY[]::text[],
      '{"type":"all"}'::jsonb,
      true,
      now() - INTERVAL '2 days'
    );
  END IF;

  -- Post 2: Evento especial (audiencia active — solo socios activos)
  IF NOT EXISTS (SELECT 1 FROM public.posts WHERE gym_id = v_gym_id AND title = 'Master Class sábado 09:00') THEN
    INSERT INTO public.posts (gym_id, title, content, tags, media_urls, audience, is_published, published_at)
    VALUES (
      v_gym_id,
      'Master Class sábado 09:00',
      E'Este sábado a las 09:00 tenemos sesión especial de movilidad + fuerza dirigida por Alex.\n\nPlazas limitadas a 15. Reserva en la app desde el lunes.',
      ARRAY['evento', 'masterclass', 'fin-de-semana']::text[],
      ARRAY[]::text[],
      '{"type":"active"}'::jsonb,
      true,
      now() - INTERVAL '6 hours'
    );
  END IF;

  -- Post 3: Borrador (sin publicar todavía)
  IF NOT EXISTS (SELECT 1 FROM public.posts WHERE gym_id = v_gym_id AND title = 'Nuevo horario verano (borrador)') THEN
    INSERT INTO public.posts (gym_id, title, content, tags, media_urls, audience, is_published, published_at)
    VALUES (
      v_gym_id,
      'Nuevo horario verano (borrador)',
      E'A partir del 1 de julio ajustamos el horario:\n- Lunes-viernes: 07:00 a 21:00\n- Sábados: 09:00 a 14:00\n- Domingos: cerrado\n\n[Pendiente de confirmar con owner antes de publicar]',
      ARRAY['horario', 'verano']::text[],
      ARRAY[]::text[],
      '{"type":"all"}'::jsonb,
      false,
      NULL
    );
  END IF;
END $$;
