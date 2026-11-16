-- =============================================================================
-- pgTAP test — RLS policies en public.members
-- =============================================================================
-- Valida:
--   1. Owner gym A ve SUS members
--   2. Owner gym A NO ve members de gym B
--   3. Owner gym B NO puede INSERT member en gym A (42501)
--   4. Member linkeado (auth_user_id) ve su propio row (member_read_own_record)
-- =============================================================================

BEGIN;

-- Fixtures
DO $$ BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES
    ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-owner-a@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb),
    ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-owner-b@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb),
    ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-member@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.gyms (id, slug, name, country, timezone, currency, status, plan) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', 'rls-test-gym-a', 'RLS Test Gym A', 'ES', 'Europe/Madrid', 'EUR', 'active', 'base'),
  ('bbbb2222-2222-2222-2222-222222222222', 'rls-test-gym-b', 'RLS Test Gym B', 'ES', 'Europe/Madrid', 'EUR', 'active', 'base');

INSERT INTO public.gym_users (gym_id, user_id, role, is_active, accepted_at) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'owner', true, now()),
  ('bbbb2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'owner', true, now());

INSERT INTO public.members (id, gym_id, first_name, last_name, email, auth_user_id, status, join_date) VALUES
  ('cccc3333-3333-3333-3333-333333333333', 'aaaa1111-1111-1111-1111-111111111111', 'Ana', 'Socio', 'rls-test-member@example.invalid', '33333333-3333-3333-3333-333333333333', 'active', current_date);
INSERT INTO public.members (id, gym_id, first_name, last_name, email, status, join_date) VALUES
  ('dddd4444-4444-4444-4444-444444444444', 'bbbb2222-2222-2222-2222-222222222222', 'Bruno', 'Otro', 'rls-test-b@example.invalid', 'active', current_date);

SELECT plan(4);
CREATE TEMP TABLE test_results (step int, result text);
GRANT INSERT, SELECT ON test_results TO authenticated;

-- Test 1 + 2: Owner A
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

INSERT INTO test_results SELECT 1, results_eq(
  $t$ SELECT count(*)::int FROM public.members WHERE gym_id = 'aaaa1111-1111-1111-1111-111111111111' $t$,
  $t$ VALUES (1::int) $t$,
  'Owner A ve SUS members (1)'
);

INSERT INTO test_results SELECT 2, is_empty(
  $t$ SELECT id FROM public.members WHERE gym_id = 'bbbb2222-2222-2222-2222-222222222222' $t$,
  'Owner A NO ve members de gym B'
);

-- Test 3: Owner B intenta INSERT cross-tenant
SET LOCAL "request.jwt.claims" = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

INSERT INTO test_results SELECT 3, throws_ok(
  $t$ INSERT INTO public.members (gym_id, first_name, last_name, email, status, join_date)
     VALUES ('aaaa1111-1111-1111-1111-111111111111', 'Intruso', 'X', 'intruso@example.invalid', 'active', current_date) $t$,
  '42501',
  NULL,
  'Owner B NO puede INSERT member en gym A'
);

-- Test 4: Member ve su propio record
SET LOCAL "request.jwt.claims" = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

INSERT INTO test_results SELECT 4, results_eq(
  $t$ SELECT id FROM public.members WHERE auth_user_id = auth.uid() $t$,
  $t$ VALUES ('cccc3333-3333-3333-3333-333333333333'::uuid) $t$,
  'Member ve su propio record via member_read_own_record policy'
);

SELECT step, result FROM test_results ORDER BY step;
ROLLBACK;
