-- =============================================================================
-- pgTAP test — RLS policies en public.bookings
-- =============================================================================
-- Valida:
--   1. Owner gym A ve SUS bookings
--   2. Owner gym A NO ve bookings de gym B
--   3. Owner gym B NO puede INSERT booking en class_instance de gym A (42501)
-- =============================================================================

BEGIN;

DO $$ BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES
    ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-owner-a@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb),
    ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-owner-b@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.gyms (id, slug, name, country, timezone, currency, status, plan) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', 'rls-test-gym-a', 'RLS Test Gym A', 'ES', 'Europe/Madrid', 'EUR', 'active', 'base'),
  ('bbbb2222-2222-2222-2222-222222222222', 'rls-test-gym-b', 'RLS Test Gym B', 'ES', 'Europe/Madrid', 'EUR', 'active', 'base');

INSERT INTO public.gym_users (gym_id, user_id, role, is_active, accepted_at) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'owner', true, now()),
  ('bbbb2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'owner', true, now());

INSERT INTO public.members (id, gym_id, first_name, last_name, email, status, join_date) VALUES
  ('eeee1111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 'AnaA', 'X', 'rls-ma@example.invalid', 'active', current_date),
  ('eeee2222-2222-2222-2222-222222222222', 'bbbb2222-2222-2222-2222-222222222222', 'AnaB', 'X', 'rls-mb@example.invalid', 'active', current_date);

-- Classes (plantilla)
INSERT INTO public.classes (id, gym_id, name, type, day_of_week, start_time, end_time, max_spots, valid_from, is_active) VALUES
  ('ffff1111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 'Test Class A', 'grupal', 1, '08:00', '09:00', 10, current_date, true),
  ('ffff2222-2222-2222-2222-222222222222', 'bbbb2222-2222-2222-2222-222222222222', 'Test Class B', 'grupal', 1, '08:00', '09:00', 10, current_date, true);

-- Class instances
INSERT INTO public.class_instances (id, gym_id, class_id, scheduled_date, start_at, end_at, status) VALUES
  ('abcd1111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 'ffff1111-1111-1111-1111-111111111111', current_date, now(), now() + interval '1 hour', 'scheduled'),
  ('abcd2222-2222-2222-2222-222222222222', 'bbbb2222-2222-2222-2222-222222222222', 'ffff2222-2222-2222-2222-222222222222', current_date, now(), now() + interval '1 hour', 'scheduled');

-- 1 booking en cada gym
INSERT INTO public.bookings (id, gym_id, class_instance_id, member_id, status, booked_at, consumed_session) VALUES
  ('1bbb1111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 'abcd1111-1111-1111-1111-111111111111', 'eeee1111-1111-1111-1111-111111111111', 'confirmed', now(), false),
  ('1bbb2222-2222-2222-2222-222222222222', 'bbbb2222-2222-2222-2222-222222222222', 'abcd2222-2222-2222-2222-222222222222', 'eeee2222-2222-2222-2222-222222222222', 'confirmed', now(), false);

SELECT plan(3);
CREATE TEMP TABLE test_results (step int, result text);
GRANT INSERT, SELECT ON test_results TO authenticated;

-- Test 1 + 2: Owner A
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

INSERT INTO test_results SELECT 1, results_eq(
  $t$ SELECT count(*)::int FROM public.bookings WHERE gym_id = 'aaaa1111-1111-1111-1111-111111111111' $t$,
  $t$ VALUES (1::int) $t$,
  'Owner A ve SUS bookings (1)'
);

INSERT INTO test_results SELECT 2, is_empty(
  $t$ SELECT id FROM public.bookings WHERE gym_id = 'bbbb2222-2222-2222-2222-222222222222' $t$,
  'Owner A NO ve bookings de gym B'
);

-- Test 3: Owner B intenta INSERT booking cross-tenant
SET LOCAL "request.jwt.claims" = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

INSERT INTO test_results SELECT 3, throws_ok(
  $t$ INSERT INTO public.bookings (gym_id, class_instance_id, member_id, status, booked_at, consumed_session)
     VALUES ('aaaa1111-1111-1111-1111-111111111111', 'abcd1111-1111-1111-1111-111111111111', 'eeee1111-1111-1111-1111-111111111111', 'confirmed', now(), false) $t$,
  '42501',
  NULL,
  'Owner B NO puede INSERT booking en class_instance de gym A'
);

SELECT step, result FROM test_results ORDER BY step;
ROLLBACK;
