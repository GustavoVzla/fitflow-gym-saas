-- =============================================================================
-- pgTAP test — RLS on public.import_jobs (migración 0029)
-- =============================================================================
-- Valida:
--   1. Super-admin puede INSERT import_job
--   2. Super-admin puede SELECT sus import_jobs
--   3. Super-admin puede UPDATE status (Decision #111 — policy UPDATE obligatoria)
--   4. Tenant owner NO puede SELECT import_jobs (RLS is_app_admin denied)
--   5. Anon NO puede SELECT import_jobs
--   6. RPC admin_import_members_from_csv falla si no super-admin
-- =============================================================================

BEGIN;

-- Fixtures: 1 super-admin + 1 tenant owner
DO $$ BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES
    ('aaaaaaaa-9999-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-import-admin@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb),
    ('bbbbbbbb-9999-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-import-tenant@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  -- User A como super-admin
  INSERT INTO public.app_admins (user_id, email, is_active)
  VALUES ('aaaaaaaa-9999-0000-0000-00000000000a', 'rls-import-admin@example.invalid', true)
  ON CONFLICT (user_id) DO UPDATE SET is_active = true;

  -- Gym test
  INSERT INTO public.gyms (id, slug, name, plan)
  VALUES ('cccccccc-9999-0000-0000-00000000000c', 'test-gym-import-rls', 'Test Gym Import', 'base')
  ON CONFLICT (id) DO NOTHING;
END $$;

SELECT plan(6);
DROP TABLE IF EXISTS pg_temp.test_results;
CREATE TEMP TABLE test_results (step int, result text);
GRANT INSERT, SELECT ON test_results TO authenticated, anon;

-- ===========================================================================
-- Super-admin context
-- ===========================================================================
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"aaaaaaaa-9999-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}';

-- Test 1: super-admin INSERT OK
INSERT INTO test_results SELECT 1, lives_ok(
  $t$
    INSERT INTO public.import_jobs (gym_id, job_type, filename, rows_total)
    VALUES ('cccccccc-9999-0000-0000-00000000000c', 'members', 'test.csv', 5)
  $t$,
  'Super-admin puede INSERT import_job'
);

-- Test 2: super-admin SELECT OK (ve al menos la row que acaba de insertar)
INSERT INTO test_results SELECT 2, isnt_empty(
  $t$ SELECT 1 FROM public.import_jobs WHERE gym_id = 'cccccccc-9999-0000-0000-00000000000c' $t$,
  'Super-admin ve sus import_jobs'
);

-- Test 3: super-admin UPDATE status OK (Decision #111)
INSERT INTO test_results SELECT 3, lives_ok(
  $t$
    UPDATE public.import_jobs
      SET status = 'completed', rows_ok = 5
      WHERE gym_id = 'cccccccc-9999-0000-0000-00000000000c'
  $t$,
  'Super-admin puede UPDATE status (policy UPDATE obligatoria Decision #111)'
);

-- ===========================================================================
-- Tenant (NO super-admin) context
-- ===========================================================================
SET LOCAL "request.jwt.claims" = '{"sub":"bbbbbbbb-9999-0000-0000-00000000000b","role":"authenticated","aal":"aal1"}';

-- Test 4: tenant NO ve import_jobs
INSERT INTO test_results SELECT 4, is_empty(
  $t$ SELECT 1 FROM public.import_jobs WHERE gym_id = 'cccccccc-9999-0000-0000-00000000000c' $t$,
  'Tenant (non-admin) NO ve import_jobs (RLS is_app_admin)'
);

-- Test 6: tenant NO puede ejecutar admin_import_members_from_csv
INSERT INTO test_results SELECT 6, throws_ok(
  $t$
    SELECT public.admin_import_members_from_csv(
      'cccccccc-9999-0000-0000-00000000000c'::uuid,
      'test.csv',
      '{}'::jsonb,
      '[]'::jsonb
    )
  $t$,
  '42501',
  NULL,
  'Tenant NO puede ejecutar admin_import_members_from_csv (guard is_app_admin)'
);

-- ===========================================================================
-- Anon context
-- ===========================================================================
SET LOCAL role = anon;
SET LOCAL "request.jwt.claims" = '';

-- Test 5: anon NO ve import_jobs
INSERT INTO test_results SELECT 5, is_empty(
  $t$ SELECT 1 FROM public.import_jobs $t$,
  'Anon NO ve import_jobs'
);

SELECT step, result FROM test_results ORDER BY step;
ROLLBACK;
