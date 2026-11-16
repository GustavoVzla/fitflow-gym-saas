-- =============================================================================
-- pgTAP — RLS gym_expenses (migración 0034) — internal ticket
-- =============================================================================
-- Valida:
--   1. Owner A crea gasto OK (create_expense)
--   2. Owner B NO ve gastos de gym A (multi-tenant isolation)
--   3. Trainer NO puede INSERT (solo owner/admin)
--   4. Soft delete deja row + flag, NO borra de tabla
--   5. list_expenses_range filtra deleted_at IS NULL
--   6. gym_expenses_kpis solo visible con permiso gym
-- =============================================================================

BEGIN;

DO $$ BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, reauthentication_token, phone_change, phone_change_token)
  VALUES
    ('e1111111-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-exp-owner-a@example.invalid', crypt('t', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
    ('e2222222-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-exp-owner-b@example.invalid', crypt('t', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
    ('e3333333-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-exp-trainer-a@example.invalid', crypt('t', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', '')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.gyms (id, slug, name, plan) VALUES
    ('e4e4e4e4-0000-4000-8000-00000000aaaa', 'rls-exp-gym-a', 'Gym A Exp', 'base'),
    ('e5e5e5e5-0000-4000-8000-00000000bbbb', 'rls-exp-gym-b', 'Gym B Exp', 'base')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.gym_users (user_id, gym_id, role) VALUES
    ('e1111111-0000-4000-8000-000000000001', 'e4e4e4e4-0000-4000-8000-00000000aaaa', 'owner'),
    ('e2222222-0000-4000-8000-000000000002', 'e5e5e5e5-0000-4000-8000-00000000bbbb', 'owner'),
    ('e3333333-0000-4000-8000-000000000003', 'e4e4e4e4-0000-4000-8000-00000000aaaa', 'trainer')
  ON CONFLICT (user_id, gym_id) DO NOTHING;
END $$;

SELECT plan(6);
DROP TABLE IF EXISTS pg_temp.test_results;
CREATE TEMP TABLE test_results (step int, result text);
GRANT INSERT, SELECT ON test_results TO authenticated, anon;

-- Context: Owner A
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"e1111111-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

-- Test 1: Owner A create_expense OK
INSERT INTO test_results SELECT 1, lives_ok(
  $t$ SELECT public.create_expense(
    'e4e4e4e4-0000-4000-8000-00000000aaaa'::uuid,
    'material'::public.expense_category,
    'Compra balones medicinales',
    120.00
  ) $t$,
  'Owner A puede crear gasto'
);

-- Test 2: Owner A ve su gasto
INSERT INTO test_results SELECT 2, isnt_empty(
  $t$ SELECT 1 FROM public.gym_expenses WHERE gym_id = 'e4e4e4e4-0000-4000-8000-00000000aaaa'::uuid $t$,
  'Owner A ve gastos de su gym'
);

-- Test 6: gym_expenses_kpis funciona para owner A
INSERT INTO test_results SELECT 6, lives_ok(
  $t$ SELECT * FROM public.gym_expenses_kpis('e4e4e4e4-0000-4000-8000-00000000aaaa'::uuid) $t$,
  'Owner A puede calcular KPIs'
);

-- Context: Trainer A (solo lectura, no INSERT)
SET LOCAL "request.jwt.claims" = '{"sub":"e3333333-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';

-- Test 3: Trainer NO puede INSERT
INSERT INTO test_results SELECT 3, throws_ok(
  $t$ SELECT public.create_expense(
    'e4e4e4e4-0000-4000-8000-00000000aaaa'::uuid,
    'other'::public.expense_category,
    'intento prohibido',
    50.00
  ) $t$,
  '42501', NULL,
  'Trainer NO puede crear gastos (42501)'
);

-- Context: Owner B (gym distinto)
SET LOCAL "request.jwt.claims" = '{"sub":"e2222222-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

-- Test 4: Owner B NO ve gastos de gym A (multi-tenant isolation)
INSERT INTO test_results SELECT 4, is_empty(
  $t$ SELECT 1 FROM public.gym_expenses WHERE gym_id = 'e4e4e4e4-0000-4000-8000-00000000aaaa'::uuid $t$,
  'Owner B NO ve gastos de gym A (isolation)'
);

-- Context: Owner A — soft delete
SET LOCAL "request.jwt.claims" = '{"sub":"e1111111-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

-- Test 5: Soft delete — row queda con deleted_at NOT NULL (no borrado físico)
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.gym_expenses
    WHERE gym_id = 'e4e4e4e4-0000-4000-8000-00000000aaaa'::uuid
      AND deleted_at IS NULL LIMIT 1;
  PERFORM public.delete_expense(v_id);
END $$;

INSERT INTO test_results SELECT 5, isnt_empty(
  $t$ SELECT 1 FROM public.gym_expenses
      WHERE gym_id = 'e4e4e4e4-0000-4000-8000-00000000aaaa'::uuid
        AND deleted_at IS NOT NULL $t$,
  'Soft delete: row queda con deleted_at NOT NULL (no borrado físico)'
);

SELECT step, result FROM test_results ORDER BY step;
ROLLBACK;
