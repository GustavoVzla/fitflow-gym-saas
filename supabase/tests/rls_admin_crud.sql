-- =============================================================================
-- pgTAP test — admin_* CRUD RPCs (migración 0022)
-- =============================================================================
-- Valida:
--   1. Tenant (no super-admin) NO puede llamar admin_update_gym
--   2. Tenant NO puede llamar admin_suspend_gym
--   3. Tenant NO puede llamar admin_soft_delete_gym
--   4. Tenant NO puede llamar admin_list_gym_users
--   5. Super-admin SÍ puede llamar admin_update_gym
--   6. admin_soft_delete_gym marca deleted_at (no hard-delete)
--   7. admin_list_gyms() default excluye soft-deleted
--   8. admin_list_gyms(true) incluye soft-deleted
--   9. Auditoría: admin_audit_log registra la acción tras una mutación
--  10. Tenant NO puede leer admin_audit_log
-- =============================================================================

BEGIN;

-- Fixtures: super-admin + gym owner (tenant) + un gym
DO $$ BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-crud-super@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-crud-tenant@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.app_admins (user_id, email, full_name, is_active)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rls-crud-super@example.invalid', 'Test Super CRUD', true);

-- Create a gym and make tenant its owner
INSERT INTO public.gyms (id, name, slug, plan, status, timezone, currency)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'RLS Test Gym', 'rls-test-gym-crud', 'base', 'active', 'Europe/Madrid', 'EUR');

INSERT INTO public.gym_users (gym_id, user_id, role, is_active)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner', true);

SELECT plan(10);
CREATE TEMP TABLE test_results (step int, result text);
GRANT INSERT, SELECT ON test_results TO authenticated;

-- ===========================================================================
-- Tenant context
-- ===========================================================================
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","aal":"aal1"}';

-- Test 1: Tenant NO puede admin_update_gym
INSERT INTO test_results SELECT 1, throws_ok(
  $t$ SELECT public.admin_update_gym('cccccccc-cccc-cccc-cccc-cccccccccccc', p_name := 'Evil Rename') $t$,
  '42501',
  'Acceso denegado',
  'Tenant NO puede llamar admin_update_gym (42501 acceso denegado)'
);

-- Test 2: Tenant NO puede admin_suspend_gym
INSERT INTO test_results SELECT 2, throws_ok(
  $t$ SELECT public.admin_suspend_gym('cccccccc-cccc-cccc-cccc-cccccccccccc', 'test reason') $t$,
  '42501',
  'Acceso denegado',
  'Tenant NO puede llamar admin_suspend_gym'
);

-- Test 3: Tenant NO puede admin_soft_delete_gym
INSERT INTO test_results SELECT 3, throws_ok(
  $t$ SELECT public.admin_soft_delete_gym('cccccccc-cccc-cccc-cccc-cccccccccccc', 'evil') $t$,
  '42501',
  'Acceso denegado',
  'Tenant NO puede llamar admin_soft_delete_gym'
);

-- Test 4: Tenant NO puede admin_list_gym_users
INSERT INTO test_results SELECT 4, throws_ok(
  $t$ SELECT public.admin_list_gym_users('cccccccc-cccc-cccc-cccc-cccccccccccc') $t$,
  '42501',
  'Acceso denegado',
  'Tenant NO puede llamar admin_list_gym_users'
);

-- Test 10: Tenant NO puede leer admin_audit_log
INSERT INTO test_results SELECT 10, is_empty(
  $t$ SELECT id FROM public.admin_audit_log $t$,
  'Tenant NO ve rows en admin_audit_log (RLS super_admin_read only)'
);

-- ===========================================================================
-- Super-admin context (aal2 to also satisfy potential aal checks)
-- ===========================================================================
SET LOCAL "request.jwt.claims" = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","aal":"aal2"}';

-- Test 5: Super-admin SÍ puede admin_update_gym
INSERT INTO test_results SELECT 5, lives_ok(
  $t$ SELECT public.admin_update_gym('cccccccc-cccc-cccc-cccc-cccccccccccc', p_name := 'RLS Test Gym Renamed') $t$,
  'Super-admin SÍ puede admin_update_gym'
);

-- Test 6: admin_soft_delete_gym marca deleted_at (NO hard-delete)
INSERT INTO test_results SELECT 6, results_eq(
  $t$
    WITH soft AS (
      SELECT public.admin_soft_delete_gym('cccccccc-cccc-cccc-cccc-cccccccccccc', 'test soft delete')
    )
    SELECT (deleted_at IS NOT NULL)::text
    FROM public.gyms, soft
    WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  $t$,
  $t$ VALUES ('true'::text) $t$,
  'admin_soft_delete_gym marca deleted_at (la fila sigue existiendo)'
);

-- Test 7: admin_list_gyms() default NO incluye soft-deleted
INSERT INTO test_results SELECT 7, is_empty(
  $t$
    SELECT id FROM public.admin_list_gyms(false)
    WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  $t$,
  'admin_list_gyms(false) excluye gyms soft-deleted'
);

-- Test 8: admin_list_gyms(true) SÍ incluye soft-deleted
INSERT INTO test_results SELECT 8, results_eq(
  $t$
    SELECT count(*)::int FROM public.admin_list_gyms(true)
    WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  $t$,
  $t$ VALUES (1::int) $t$,
  'admin_list_gyms(true) incluye gyms soft-deleted'
);

-- Test 9: admin_audit_log registra la acción (gym.update + gym.soft_delete)
INSERT INTO test_results SELECT 9, results_eq(
  $t$
    SELECT count(*)::int FROM public.admin_audit_log
    WHERE gym_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      AND action IN ('gym.update', 'gym.soft_delete')
  $t$,
  $t$ VALUES (2::int) $t$,
  'admin_audit_log registra las 2 acciones realizadas (gym.update + gym.soft_delete)'
);

SELECT step, result FROM test_results ORDER BY step;
ROLLBACK;
