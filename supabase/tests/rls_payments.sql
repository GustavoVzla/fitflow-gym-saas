-- =============================================================================
-- pgTAP test — RLS policies en public.payments
-- =============================================================================
-- Valida:
--   1. Staff gym A ve SUS payments
--   2. Staff gym A NO ve payments de gym B
--   3. Staff gym B NO puede INSERT payment en gym A (42501)
--   4. Member linkeado ve SUS payments (via member_read_own_payments)
--   5. Member NO ve payments de otro member
-- =============================================================================

BEGIN;

DO $$ BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES
    ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-owner-a@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb),
    ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-owner-b@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb),
    ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-memberA@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.gyms (id, slug, name, country, timezone, currency, status, plan) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', 'rls-test-gym-a', 'RLS Test Gym A', 'ES', 'Europe/Madrid', 'EUR', 'active', 'base'),
  ('bbbb2222-2222-2222-2222-222222222222', 'rls-test-gym-b', 'RLS Test Gym B', 'ES', 'Europe/Madrid', 'EUR', 'active', 'base');

INSERT INTO public.gym_users (gym_id, user_id, role, is_active, accepted_at) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'owner', true, now()),
  ('bbbb2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'owner', true, now());

-- Member linkeado al user 3333 en gym A
INSERT INTO public.members (id, gym_id, first_name, last_name, email, auth_user_id, status, join_date) VALUES
  ('eeee1111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 'AnaA', 'X', 'rls-ma@example.invalid', '33333333-3333-3333-3333-333333333333', 'active', current_date);

-- Members sin auth
INSERT INTO public.members (id, gym_id, first_name, last_name, email, status, join_date) VALUES
  ('eeee2222-2222-2222-2222-222222222222', 'bbbb2222-2222-2222-2222-222222222222', 'AnaB', 'X', 'rls-mb@example.invalid', 'active', current_date),
  ('eeee3333-3333-3333-3333-333333333333', 'aaaa1111-1111-1111-1111-111111111111', 'OtroA', 'X', 'rls-ma2@example.invalid', 'active', current_date);

-- 1 payment de AnaA (linkeada), 1 de otra member en gym A, 1 en gym B
INSERT INTO public.payments (id, gym_id, member_id, amount, currency, description, method, status, member_snapshot, payment_source) VALUES
  ('ccc1aaaa-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 'eeee1111-1111-1111-1111-111111111111', 50, 'EUR', 'Cuota AnaA', 'card', 'completed', '{}'::jsonb, 'manual'),
  ('ccc2aaaa-2222-2222-2222-222222222222', 'aaaa1111-1111-1111-1111-111111111111', 'eeee3333-3333-3333-3333-333333333333', 60, 'EUR', 'Cuota OtroA', 'card', 'completed', '{}'::jsonb, 'manual'),
  ('ccc3bbbb-3333-3333-3333-333333333333', 'bbbb2222-2222-2222-2222-222222222222', 'eeee2222-2222-2222-2222-222222222222', 70, 'EUR', 'Cuota AnaB', 'card', 'completed', '{}'::jsonb, 'manual');

SELECT plan(5);
CREATE TEMP TABLE test_results (step int, result text);
GRANT INSERT, SELECT ON test_results TO authenticated;

-- Test 1 + 2: Owner A
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

INSERT INTO test_results SELECT 1, results_eq(
  $t$ SELECT count(*)::int FROM public.payments WHERE gym_id = 'aaaa1111-1111-1111-1111-111111111111' $t$,
  $t$ VALUES (2::int) $t$,
  'Owner A ve SUS payments (2)'
);

INSERT INTO test_results SELECT 2, is_empty(
  $t$ SELECT id FROM public.payments WHERE gym_id = 'bbbb2222-2222-2222-2222-222222222222' $t$,
  'Owner A NO ve payments de gym B'
);

-- Test 3: Owner B intenta INSERT payment en gym A
SET LOCAL "request.jwt.claims" = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

INSERT INTO test_results SELECT 3, throws_ok(
  $t$ INSERT INTO public.payments (gym_id, member_id, amount, currency, description, method, status, member_snapshot, payment_source)
     VALUES ('aaaa1111-1111-1111-1111-111111111111', 'eeee1111-1111-1111-1111-111111111111', 99, 'EUR', 'Intruso', 'card', 'completed', '{}'::jsonb, 'manual') $t$,
  '42501',
  NULL,
  'Owner B NO puede INSERT payment en gym A'
);

-- Test 4 + 5: Member AnaA ve solo su payment (50), NO el de OtroA (60)
SET LOCAL "request.jwt.claims" = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

INSERT INTO test_results SELECT 4, results_eq(
  $t$ SELECT count(*)::int FROM public.payments $t$,
  $t$ VALUES (1::int) $t$,
  'Member AnaA ve solo SU payment (1 de 2 en gym A)'
);

INSERT INTO test_results SELECT 5, results_eq(
  $t$ SELECT amount::numeric FROM public.payments $t$,
  $t$ VALUES (50::numeric) $t$,
  'Member AnaA ve su payment de 50 EUR (no el de OtroA)'
);

SELECT step, result FROM test_results ORDER BY step;
ROLLBACK;
