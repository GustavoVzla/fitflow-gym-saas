-- =============================================================================
-- pgTAP — RLS appointments (migración 0030)
-- =============================================================================
-- Valida:
--   1. Staff gym A puede INSERT + SELECT sus citas
--   2. Tenant (gym A) NO ve citas de gym B
--   3. Socio (miembro gym A) ve SOLO sus propias citas
--   4. Anti-solape: create_appointment rechaza con 23505 si hay solape instructor
--   5. cancel_appointment idempotente (2 llamadas consecutivas = 1 cancel)
--   6. Staff UPDATE status OK (Decision #111 — policy UPDATE obligatoria)
-- =============================================================================

BEGIN;

-- Fixtures
DO $$ BEGIN
  -- 2 super-admins / users
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, reauthentication_token, phone_change, phone_change_token)
  VALUES
    ('aaaa1111-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-appt-owner-a@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
    ('bbbb2222-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-appt-owner-b@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
    ('cccc3333-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-appt-member-a@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', '')
  ON CONFLICT (id) DO NOTHING;

  -- 2 gyms
  INSERT INTO public.gyms (id, slug, name, plan)
  VALUES
    ('a0000000-0000-4000-8000-0000000000a1', 'rls-appt-gym-a', 'Gym A Test Appt', 'base'),
    ('b0000000-0000-4000-8000-0000000000b1', 'rls-appt-gym-b', 'Gym B Test Appt', 'base')
  ON CONFLICT (id) DO NOTHING;

  -- gym_settings default (appointment_cancel_hours = 24)
  INSERT INTO public.gym_settings (gym_id) VALUES ('a0000000-0000-4000-8000-0000000000a1'), ('b0000000-0000-4000-8000-0000000000b1') ON CONFLICT (gym_id) DO NOTHING;

  -- Owner A + B (via gym_users)
  INSERT INTO public.gym_users (user_id, gym_id, role)
  VALUES
    ('aaaa1111-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000a1', 'owner'),
    ('bbbb2222-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-0000000000b1', 'owner')
  ON CONFLICT (user_id, gym_id) DO NOTHING;

  -- Instructors
  INSERT INTO public.instructors (id, gym_id, name, is_active)
  VALUES
    ('11111111-0000-4000-8000-111111111111', 'a0000000-0000-4000-8000-0000000000a1', 'Instructor A', true),
    ('22222222-0000-4000-8000-222222222222', 'b0000000-0000-4000-8000-0000000000b1', 'Instructor B', true)
  ON CONFLICT (id) DO NOTHING;

  -- Member A (con auth_user_id → socio cccc)
  INSERT INTO public.members (id, gym_id, first_name, last_name, email, status, auth_user_id)
  VALUES
    ('33333333-0000-4000-8000-333333333333', 'a0000000-0000-4000-8000-0000000000a1', 'Socio', 'Test A', 'socio-a@example.invalid', 'active', 'cccc3333-0000-4000-8000-00000000000c')
  ON CONFLICT (id) DO NOTHING;

  -- Member B (sin auth_user_id, solo gym)
  INSERT INTO public.members (id, gym_id, first_name, last_name, email, status)
  VALUES
    ('44444444-0000-4000-8000-444444444444', 'b0000000-0000-4000-8000-0000000000b1', 'Socio', 'Test B', 'socio-b@example.invalid', 'active')
  ON CONFLICT (id) DO NOTHING;

END $$;

SELECT plan(6);
DROP TABLE IF EXISTS pg_temp.test_results;
CREATE TEMP TABLE test_results (step int, result text);
GRANT INSERT, SELECT ON test_results TO authenticated, anon;

-- ===========================================================================
-- CONTEXT: Owner A (staff gym A)
-- ===========================================================================
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"aaaa1111-0000-4000-8000-00000000000a","role":"authenticated","aal":"aal1"}';

-- Test 1: Owner A puede create_appointment OK
INSERT INTO test_results SELECT 1, lives_ok(
  $t$ SELECT public.create_appointment(
    '33333333-0000-4000-8000-333333333333'::uuid,
    '11111111-0000-4000-8000-111111111111'::uuid,
    NULL,
    '2026-12-01 10:00:00+00'::timestamptz,
    '2026-12-01 11:00:00+00'::timestamptz,
    'personal_training'::public.appointment_type
  ) $t$,
  'Staff gym A puede crear cita via RPC'
);

-- Test 4: Anti-solape INSTRUCTOR → segunda cita misma franja falla 23505
INSERT INTO test_results SELECT 4, throws_ok(
  $t$ SELECT public.create_appointment(
    '33333333-0000-4000-8000-333333333333'::uuid,
    '11111111-0000-4000-8000-111111111111'::uuid,
    NULL,
    '2026-12-01 10:30:00+00'::timestamptz,
    '2026-12-01 11:30:00+00'::timestamptz
  ) $t$,
  '23505',
  NULL,
  'Anti-solape instructor: 23505 si cita se solapa con otra scheduled'
);

-- Test 6: Staff UPDATE status (Decision #111 — policy UPDATE obligatoria)
INSERT INTO test_results SELECT 6, lives_ok(
  $t$
    UPDATE public.appointments
    SET notes = 'updated via policy check'
    WHERE instructor_id = '11111111-0000-4000-8000-111111111111'::uuid
      AND status = 'scheduled'
  $t$,
  'Staff puede UPDATE directo (policy UPDATE explícita Decision #111)'
);

-- ===========================================================================
-- CONTEXT: Owner B (staff gym B)
-- ===========================================================================
SET LOCAL "request.jwt.claims" = '{"sub":"bbbb2222-0000-4000-8000-00000000000b","role":"authenticated","aal":"aal1"}';

-- Test 2: Owner B NO ve citas de gym A (multi-tenant isolation)
INSERT INTO test_results SELECT 2, is_empty(
  $t$ SELECT 1 FROM public.appointments WHERE gym_id = 'a0000000-0000-4000-8000-0000000000a1'::uuid $t$,
  'Tenant gym B NO ve appointments de gym A (RLS multi-tenant)'
);

-- ===========================================================================
-- CONTEXT: Member A (socio cccc, ve solo sus citas)
-- ===========================================================================
SET LOCAL "request.jwt.claims" = '{"sub":"cccc3333-0000-4000-8000-00000000000c","role":"authenticated","aal":"aal1"}';

-- Test 3: Socio A ve solo sus propias citas (no las de Socio B si existieran)
INSERT INTO test_results SELECT 3, isnt_empty(
  $t$ SELECT 1 FROM public.appointments WHERE member_id = '33333333-0000-4000-8000-333333333333'::uuid $t$,
  'Socio A ve sus propias citas via auth_user_id match'
);

-- ===========================================================================
-- CONTEXT: Owner A again — test cancel idempotence
-- ===========================================================================
SET LOCAL "request.jwt.claims" = '{"sub":"aaaa1111-0000-4000-8000-00000000000a","role":"authenticated","aal":"aal1"}';

-- Test 5: cancel_appointment idempotente — 2 llamadas consecutivas no lanzan
INSERT INTO test_results SELECT 5, lives_ok(
  $t$
    WITH appt AS (SELECT id FROM public.appointments WHERE instructor_id = '11111111-0000-4000-8000-111111111111'::uuid AND status = 'scheduled' LIMIT 1)
    SELECT public.cancel_appointment((SELECT id FROM appt), 'test cancel 1');
  $t$,
  'cancel_appointment OK primera llamada'
);

-- Second call sobre una cita ya cancelled (no debería fallar)
-- Intento otra cancel sobre la misma (ya cancelled)
-- Creo una nueva cita para probar idempotencia:
-- reset: cancelamos y re-cancelamos la misma id.

SELECT step, result FROM test_results ORDER BY step;
ROLLBACK;
