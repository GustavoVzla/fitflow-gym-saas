-- =============================================================================
-- pgTAP test — RLS policies en public.gym_users
-- =============================================================================
-- Valida:
--   1. Owner gym A ve gym_users de gym A (incluyendose a si mismo)
--   2. Owner gym A NO ve gym_users de gym B
--   3. Owner B NO puede INSERT gym_user en gym A (42501)
-- =============================================================================

BEGIN;

DO $$ BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES
    ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-owner-a@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb),
    ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-owner-b@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb),
    ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-new-staff@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.gyms (id, slug, name, country, timezone, currency, status, plan) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', 'rls-test-gym-a', 'RLS Test Gym A', 'ES', 'Europe/Madrid', 'EUR', 'active', 'base'),
  ('bbbb2222-2222-2222-2222-222222222222', 'rls-test-gym-b', 'RLS Test Gym B', 'ES', 'Europe/Madrid', 'EUR', 'active', 'base');

INSERT INTO public.gym_users (gym_id, user_id, role, is_active, accepted_at) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'owner', true, now()),
  ('bbbb2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'owner', true, now());

SELECT plan(3);
CREATE TEMP TABLE test_results (step int, result text);
GRANT INSERT, SELECT ON test_results TO authenticated;

SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

INSERT INTO test_results SELECT 1, results_eq(
  $t$ SELECT count(*)::int FROM public.gym_users WHERE gym_id = 'aaaa1111-1111-1111-1111-111111111111' $t$,
  $t$ VALUES (1::int) $t$,
  'Owner A ve su propio gym_user row en gym A'
);

INSERT INTO test_results SELECT 2, is_empty(
  $t$ SELECT id FROM public.gym_users WHERE gym_id = 'bbbb2222-2222-2222-2222-222222222222' $t$,
  'Owner A NO ve gym_users de gym B'
);

-- Owner B intenta añadir staff a gym A
SET LOCAL "request.jwt.claims" = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

INSERT INTO test_results SELECT 3, throws_ok(
  $t$ INSERT INTO public.gym_users (gym_id, user_id, role, is_active, accepted_at)
     VALUES ('aaaa1111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', 'staff', true, now()) $t$,
  '42501',
  NULL,
  'Owner B NO puede INSERT gym_user en gym A'
);

SELECT step, result FROM test_results ORDER BY step;
ROLLBACK;
