-- =============================================================================
-- 0073 — PD paridad 100%: seed 5 WODs Demo Studio (CrossFit benchmark)
--
-- Idempotente (insert solo si no existe ya un workout con mismo name+gym).
-- Safeguarded por slug='demo-studio'. JSONB exercises estructurado con blocks
-- (warmup/main/cooldown) + rx + scaled matching types.ts:WorkoutExercisesJson.
-- =============================================================================

DO $$
DECLARE
  v_gym_id uuid;
BEGIN
  SELECT id INTO v_gym_id FROM public.gyms WHERE slug = 'demo-studio' LIMIT 1;
  IF v_gym_id IS NULL THEN RETURN; END IF;

  -- Murph — Hero WOD
  IF NOT EXISTS (SELECT 1 FROM public.workouts WHERE gym_id = v_gym_id AND name = 'Murph') THEN
    INSERT INTO public.workouts (gym_id, name, type, description, difficulty, duration_minutes, tags, exercises, is_published, published_date)
    VALUES (
      v_gym_id, 'Murph', 'custom',
      'Hero WOD clásico. For Time con chaleco 20lb (RX).',
      'advanced', 60,
      ARRAY['hero', 'for-time', 'benchmark']::text[],
      '{"blocks":[{"type":"warmup","description":"5 min jog suave + movilidad de hombros y caderas + 10 air squats","durationMinutes":10},{"type":"main","description":"For Time:\n1 mile Run\n100 Pull-ups\n200 Push-ups\n300 Air Squats\n1 mile Run\n\nSi llevas chaleco, particionar como 20 rondas de 5-10-15.","durationMinutes":45},{"type":"cooldown","description":"5 min caminata + estiramientos de isquios, cuádriceps y pecho","durationMinutes":5}],"rx":"Con chaleco lastrado 20lb (hombres) / 14lb (mujeres). Pull-ups estrictas.","scaled":"Sin chaleco. Band-assisted pull-ups. Push-ups con rodillas si necesario. Meta 50min."}'::jsonb,
      true, CURRENT_DATE
    );
  END IF;

  -- Cindy — AMRAP 20 min benchmark
  IF NOT EXISTS (SELECT 1 FROM public.workouts WHERE gym_id = v_gym_id AND name = 'Cindy') THEN
    INSERT INTO public.workouts (gym_id, name, type, description, difficulty, duration_minutes, tags, exercises, is_published, published_date)
    VALUES (
      v_gym_id, 'Cindy', 'amrap',
      'Girl benchmark WOD. Total body endurance.',
      'intermediate', 30,
      ARRAY['girl', 'amrap', 'benchmark', 'bodyweight']::text[],
      '{"blocks":[{"type":"warmup","description":"3 rondas: 10 jumping jacks, 5 inchworms, 10 squats","durationMinutes":5},{"type":"main","description":"AMRAP 20 min:\n5 Pull-ups\n10 Push-ups\n15 Air Squats\n\nObjetivo: 15-20 rondas.","durationMinutes":20},{"type":"cooldown","description":"Movilidad de hombros, 5 min caminata","durationMinutes":5}],"rx":"Pull-ups estrictas o kipping. Full push-ups.","scaled":"Ring rows en vez de pull-ups. Push-ups con rodillas. 18+ rondas es excelente."}'::jsonb,
      true, CURRENT_DATE
    );
  END IF;

  -- Fran — For Time benchmark
  IF NOT EXISTS (SELECT 1 FROM public.workouts WHERE gym_id = v_gym_id AND name = 'Fran') THEN
    INSERT INTO public.workouts (gym_id, name, type, description, difficulty, duration_minutes, tags, exercises, is_published, published_date)
    VALUES (
      v_gym_id, 'Fran', 'custom',
      'Girl benchmark. Sprint corto, muy intenso.',
      'advanced', 20,
      ARRAY['girl', 'for-time', 'benchmark']::text[],
      '{"blocks":[{"type":"warmup","description":"5 min rower + técnica thrusters + kipping pull-ups","durationMinutes":10},{"type":"main","description":"For Time:\n21-15-9 reps of:\nThrusters (95lb/65lb)\nPull-ups","durationMinutes":8},{"type":"cooldown","description":"Movilidad de muñecas y hombros, 3 min rower suave","durationMinutes":5}],"rx":"Thrusters 95lb (M) / 65lb (W). Pull-ups estrictas o kipping.","scaled":"55lb/35lb barra. Ring rows. Sub-5min es excelente."}'::jsonb,
      true, CURRENT_DATE
    );
  END IF;

  -- Helen — For Time benchmark
  IF NOT EXISTS (SELECT 1 FROM public.workouts WHERE gym_id = v_gym_id AND name = 'Helen') THEN
    INSERT INTO public.workouts (gym_id, name, type, description, difficulty, duration_minutes, tags, exercises, is_published, published_date)
    VALUES (
      v_gym_id, 'Helen', 'custom',
      'Girl benchmark. Cardio + fuerza.',
      'intermediate', 25,
      ARRAY['girl', 'for-time', 'benchmark']::text[],
      '{"blocks":[{"type":"warmup","description":"5 min jog + KB swings técnica + pull-ups prep","durationMinutes":8},{"type":"main","description":"For Time 3 rondas:\n400m Run\n21 Kettlebell Swings (53lb/35lb)\n12 Pull-ups","durationMinutes":12},{"type":"cooldown","description":"Caminata 5 min + estiramiento espalda y caderas","durationMinutes":5}],"rx":"KB 53lb (M) / 35lb (W). Swings rusos o americanos (altura ojos).","scaled":"35lb/25lb KB. Jumping pull-ups. Meta <15min."}'::jsonb,
      true, CURRENT_DATE
    );
  END IF;

  -- WOD Mañana Custom (no-benchmark, propio Demo Studio)
  IF NOT EXISTS (SELECT 1 FROM public.workouts WHERE gym_id = v_gym_id AND name = 'WOD Mañana Custom') THEN
    INSERT INTO public.workouts (gym_id, name, type, description, difficulty, duration_minutes, tags, exercises, is_published, published_date)
    VALUES (
      v_gym_id, 'WOD Mañana Custom', 'emom',
      'EMOM 30 min perfecto para empezar el día. Alterna esfuerzo y descanso activo.',
      'intermediate', 45,
      ARRAY['mañana', 'emom', 'funcional']::text[],
      '{"blocks":[{"type":"warmup","description":"5 min bike + 2 rondas de: 10 air squats, 8 push-ups, 6 inchworms","durationMinutes":10},{"type":"main","description":"EMOM 30 min — 5 estaciones rotando:\nMin 1: 10 Wall Balls\nMin 2: 8 Burpees\nMin 3: 12 KB Swings\nMin 4: 15 Sit-ups\nMin 5: Descanso\nRepetir 6 rondas.","durationMinutes":30},{"type":"cooldown","description":"5 min movilidad espalda baja + estiramientos piernas","durationMinutes":5}],"rx":"Wall Ball 20lb (M) / 14lb (W) a 10ft. KB 53lb/35lb.","scaled":"Wall Ball 14lb/10lb. Burpees sin plancha. Reduce reps 20%."}'::jsonb,
      true, CURRENT_DATE
    );
  END IF;
END $$;
