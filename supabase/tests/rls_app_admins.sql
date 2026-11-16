-- =============================================================================
-- pgTAP test — RLS policies en public.app_admins
-- =============================================================================
-- Valida:
--   1. Super-admin activo ve su propio row en app_admins (self read)
--   2. User normal (no super-admin) NO ve rows en app_admins
--   3. is_app_admin() helper devuelve true para super-admin
--   4. is_app_admin() helper devuelve false para user normal
--   5. Super-admin con aal1 NO puede UPDATE su row (aal2 required)
--   6. Super-admin con aal2 SÍ puede UPDATE su row
--   7. Super-admin con aal1 NO puede DELETE su row (aal2 required)
--   8. Super-admin con aal2 SÍ puede DELETE su row
-- =============================================================================

BEGIN;

DO $$ BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES
    ('99999999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-super-admin@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb),
    ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-normal-user@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.app_admins (user_id, email, full_name, is_active) VALUES
  ('99999999-9999-9999-9999-999999999999', 'rls-test-super-admin@example.invalid', 'Test Super Admin', true);

SELECT plan(8);
CREATE TEMP TABLE test_results (step int, result text);
GRANT INSERT, SELECT ON test_results TO authenticated;

-- Test 1: Super-admin ve su propio row
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';

INSERT INTO test_results SELECT 1, results_eq(
  $t$ SELECT count(*)::int FROM public.app_admins $t$,
  $t$ VALUES (1::int) $t$,
  'Super-admin ve su propio row en app_admins (self read policy)'
);

-- Test 3: is_app_admin() returns true
INSERT INTO test_results SELECT 3, ok(
  public.is_app_admin(),
  'is_app_admin() devuelve true para super-admin activo'
);

-- Test 2: User normal NO ve nada en app_admins
SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

INSERT INTO test_results SELECT 2, is_empty(
  $t$ SELECT user_id FROM public.app_admins $t$,
  'User normal NO ve rows en app_admins (RLS bloquea)'
);

-- Test 4: is_app_admin() returns false
INSERT INTO test_results SELECT 4, ok(
  NOT public.is_app_admin(),
  'is_app_admin() devuelve false para user normal'
);

-- Vuelve al super-admin para tests AAL
SET LOCAL "request.jwt.claims" = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated","aal":"aal1"}';

-- Test 5: Super-admin aal1 NO puede UPDATE (policy aal2 only)
-- UPDATE con RLS denied devuelve 0 rows afectados (no throw, silent fail)
INSERT INTO test_results SELECT 5, results_eq(
  $t$
    WITH updated AS (
      UPDATE public.app_admins SET is_active = false WHERE user_id = '99999999-9999-9999-9999-999999999999' RETURNING 1
    )
    SELECT count(*)::int FROM updated
  $t$,
  $t$ VALUES (0::int) $t$,
  'aal1 NO puede UPDATE app_admins (RLS aal2 required → 0 rows affected)'
);

-- Test 7: Super-admin aal1 NO puede DELETE (policy aal2 only)
INSERT INTO test_results SELECT 7, results_eq(
  $t$
    WITH deleted AS (
      DELETE FROM public.app_admins WHERE user_id = '99999999-9999-9999-9999-999999999999' RETURNING 1
    )
    SELECT count(*)::int FROM deleted
  $t$,
  $t$ VALUES (0::int) $t$,
  'aal1 NO puede DELETE app_admins (RLS aal2 required → 0 rows affected)'
);

-- Cambia a aal2 para tests 6 y 8
SET LOCAL "request.jwt.claims" = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated","aal":"aal2"}';

-- Test 6: Super-admin aal2 SÍ puede UPDATE
INSERT INTO test_results SELECT 6, results_eq(
  $t$
    WITH updated AS (
      UPDATE public.app_admins SET is_active = true WHERE user_id = '99999999-9999-9999-9999-999999999999' RETURNING 1
    )
    SELECT count(*)::int FROM updated
  $t$,
  $t$ VALUES (1::int) $t$,
  'aal2 SÍ puede UPDATE app_admins (1 row affected)'
);

-- Test 8: Super-admin aal2 SÍ puede DELETE
INSERT INTO test_results SELECT 8, results_eq(
  $t$
    WITH deleted AS (
      DELETE FROM public.app_admins WHERE user_id = '99999999-9999-9999-9999-999999999999' RETURNING 1
    )
    SELECT count(*)::int FROM deleted
  $t$,
  $t$ VALUES (1::int) $t$,
  'aal2 SÍ puede DELETE app_admins (1 row affected)'
);

SELECT step, result FROM test_results ORDER BY step;
ROLLBACK;
