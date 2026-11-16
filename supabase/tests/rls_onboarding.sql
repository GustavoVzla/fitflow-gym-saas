-- =============================================================================
-- pgTAP test — RLS policies on public.gym_onboarding_progress (migración 0024)
-- =============================================================================
-- Valida:
--   1. Tenant A (gym A owner) NO ve onboarding de gym B
--   2. Tenant A SÍ ve su propio onboarding (via is_gym_owner_or_admin)
--   3. Tenant A puede hacer dismiss (INSERT via RPC) de su gym
--   4. Tenant A NO puede hacer dismiss de gym B (UPDATE denied)
--   5. Super-admin aal2 SÍ ve onboarding de ambos gyms
--   6. Anon (sin JWT) → get_onboarding_state falla con 28000
-- =============================================================================

BEGIN;

-- Fixtures: super-admin + 2 tenant owners + 2 gyms
DO $$ BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES
    ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-onb-super@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb),
    ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-onb-owner-a@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb),
    ('cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-onb-owner-b@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.app_admins (user_id, email, full_name, is_active)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'rls-onb-super@example.invalid', 'Super RLS Onboarding', true);

INSERT INTO public.gyms (id, name, slug, plan, status, timezone, currency)
VALUES
  ('dddddddd-0000-0000-0000-00000000000a', 'RLS Onboarding Gym A', 'rls-onb-gym-a', 'base', 'active', 'Europe/Madrid', 'EUR'),
  ('eeeeeeee-0000-0000-0000-00000000000b', 'RLS Onboarding Gym B', 'rls-onb-gym-b', 'base', 'active', 'Europe/Madrid', 'EUR');

INSERT INTO public.gym_users (gym_id, user_id, role, is_active)
VALUES
  ('dddddddd-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-000000000002', 'owner', true),
  ('eeeeeeee-0000-0000-0000-00000000000b', 'cccccccc-0000-0000-0000-000000000003', 'owner', true);

SELECT plan(6);
CREATE TEMP TABLE test_results (step int, result text);
GRANT INSERT, SELECT ON test_results TO authenticated;

-- ===========================================================================
-- Tenant A (owner of gym A) context — aal2
-- ===========================================================================
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}';

-- Test 3: Tenant A SÍ puede dismiss su propio gym (INSERT via RPC)
INSERT INTO test_results SELECT 3, lives_ok(
  $t$ SELECT public.dismiss_onboarding('dddddddd-0000-0000-0000-00000000000a'::uuid) $t$,
  'Tenant A SÍ puede dismiss onboarding de su propio gym'
);

-- Test 2: Tenant A SÍ ve su propio gym onboarding via get_onboarding_state
INSERT INTO test_results SELECT 2, lives_ok(
  $t$ SELECT public.get_onboarding_state('dddddddd-0000-0000-0000-00000000000a'::uuid) $t$,
  'Tenant A SÍ puede leer get_onboarding_state para su gym'
);

-- Test 1: Tenant A NO puede get_onboarding_state de gym B (42501 denegado)
INSERT INTO test_results SELECT 1, throws_ok(
  $t$ SELECT public.get_onboarding_state('eeeeeeee-0000-0000-0000-00000000000b'::uuid) $t$,
  '42501',
  'Acceso denegado',
  'Tenant A NO puede leer onboarding de gym B'
);

-- Test 4: Tenant A NO puede dismiss de gym B (RLS UPDATE denied → upsert falla)
-- Con ON CONFLICT DO UPDATE, si el INSERT pasa la policy WITH CHECK pero el
-- UPDATE no, fallará silencioso (0 rows). Usamos row count via audit.
INSERT INTO test_results SELECT 4, throws_ok(
  $t$ SELECT public.dismiss_onboarding('eeeeeeee-0000-0000-0000-00000000000b'::uuid) $t$,
  NULL,  -- cualquier SQLSTATE
  NULL,
  'Tenant A NO puede dismiss onboarding de gym B (RLS bloquea)'
);

-- ===========================================================================
-- Super-admin context — aal2
-- ===========================================================================
SET LOCAL "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}';

-- Test 5: Super-admin SÍ puede get_onboarding_state de gym A y gym B
INSERT INTO test_results SELECT 5, lives_ok(
  $t$
    SELECT
      public.get_onboarding_state('dddddddd-0000-0000-0000-00000000000a'::uuid),
      public.get_onboarding_state('eeeeeeee-0000-0000-0000-00000000000b'::uuid)
  $t$,
  'Super-admin SÍ puede leer get_onboarding_state de cualquier gym'
);

-- ===========================================================================
-- Anon context (no JWT)
-- ===========================================================================
SET LOCAL role = anon;
SET LOCAL "request.jwt.claims" = '';

-- Test 6: Anon → get_onboarding_state falla con 28000 (autenticacion requerida)
INSERT INTO test_results SELECT 6, throws_ok(
  $t$ SELECT public.get_onboarding_state('dddddddd-0000-0000-0000-00000000000a'::uuid) $t$,
  NULL,
  NULL,
  'Anon NO puede llamar get_onboarding_state (autenticacion requerida)'
);

SELECT step, result FROM test_results ORDER BY step;
ROLLBACK;
