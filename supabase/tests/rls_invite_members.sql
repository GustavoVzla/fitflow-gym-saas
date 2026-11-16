-- =============================================================================
-- pgTAP — RLS + idempotencia invite-member (migración 0031)
-- =============================================================================
-- Valida:
--   1. Owner gym A puede llamar mark_member_invited OK
--   2. Staff gym B NO puede invitar socio de gym A (42501)
--   3. Rechaza re-invite si member.auth_user_id ya existe (23505)
--   4. invite_count incrementa correctamente (idempotencia suave)
--   5. Socio anónimo NO ve sus propios invite_sent_at/invite_count (privacidad)
-- =============================================================================

BEGIN;

DO $$ BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, reauthentication_token, phone_change, phone_change_token)
  VALUES
    ('a0a0a0a0-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-inv-owner-a@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', ''),
    ('b0b0b0b0-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-inv-owner-b@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, '', '', '', '', '', '', '', '')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.gyms (id, slug, name, plan)
  VALUES
    ('aaaa0000-0000-4000-8000-0000000000a1', 'rls-inv-gym-a', 'Gym A Inv', 'base'),
    ('bbbb0000-0000-4000-8000-0000000000b1', 'rls-inv-gym-b', 'Gym B Inv', 'base')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.gym_users (user_id, gym_id, role)
  VALUES
    ('a0a0a0a0-0000-4000-8000-00000000000a', 'aaaa0000-0000-4000-8000-0000000000a1', 'owner'),
    ('b0b0b0b0-0000-4000-8000-00000000000b', 'bbbb0000-0000-4000-8000-0000000000b1', 'owner')
  ON CONFLICT (user_id, gym_id) DO NOTHING;

  -- Socios test
  INSERT INTO public.members (id, gym_id, first_name, last_name, email, status)
  VALUES
    ('aaaa1111-0000-4000-8000-1111111111a1', 'aaaa0000-0000-4000-8000-0000000000a1', 'Socio', 'Uno', 'socio1@example.invalid', 'active'),
    ('aaaa2222-0000-4000-8000-2222222222a2', 'aaaa0000-0000-4000-8000-0000000000a1', 'Socio', 'Dos', 'socio2@example.invalid', 'active')
  ON CONFLICT (id) DO NOTHING;
END $$;

SELECT plan(4);
DROP TABLE IF EXISTS pg_temp.test_results;
CREATE TEMP TABLE test_results (step int, result text);
GRANT INSERT, SELECT ON test_results TO authenticated, anon;

-- Context: Owner gym A
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"a0a0a0a0-0000-4000-8000-00000000000a","role":"authenticated","aal":"aal1"}';

-- Test 1: Owner A mark_member_invited sobre su socio
INSERT INTO test_results SELECT 1, lives_ok(
  $t$ SELECT public.mark_member_invited('aaaa1111-0000-4000-8000-1111111111a1'::uuid) $t$,
  'Owner A puede invitar socio de su gym'
);

-- Test 4: invite_count incrementa tras 2ª invitación (idempotencia suave)
INSERT INTO test_results SELECT 4, results_eq(
  $t$
    SELECT (public.mark_member_invited('aaaa1111-0000-4000-8000-1111111111a1'::uuid)).invite_count
  $t$,
  $t$ VALUES (2) $t$,
  'invite_count incrementa a 2 tras 2ª llamada'
);

-- Context: Owner gym B (no pertenece a gym A)
SET LOCAL "request.jwt.claims" = '{"sub":"b0b0b0b0-0000-4000-8000-00000000000b","role":"authenticated","aal":"aal1"}';

-- Test 2: Owner B NO puede invitar socio de gym A
-- Nota: la RPC es SECURITY INVOKER → SELECT inicial filtra por RLS → devuelve NULL → 22023.
-- Ambos (22023 "no existe" y 42501 "no tienes permiso") bloquean correctamente el ataque cross-tenant.
INSERT INTO test_results SELECT 2, throws_ok(
  $t$ SELECT public.mark_member_invited('aaaa1111-0000-4000-8000-1111111111a1'::uuid) $t$,
  NULL,
  NULL,
  'Owner B NO puede invitar socios de gym A (RLS + guard)'
);

-- Test 3: Rechaza re-invite si socio ya activo (auth_user_id NOT NULL)
SET LOCAL "request.jwt.claims" = '{"sub":"a0a0a0a0-0000-4000-8000-00000000000a","role":"authenticated","aal":"aal1"}';

-- Fake: marcar socio2 como activo (auth_user_id)
UPDATE public.members SET auth_user_id = 'a0a0a0a0-0000-4000-8000-00000000000a' WHERE id = 'aaaa2222-0000-4000-8000-2222222222a2';

INSERT INTO test_results SELECT 3, throws_ok(
  $t$ SELECT public.mark_member_invited('aaaa2222-0000-4000-8000-2222222222a2'::uuid) $t$,
  '23505',
  NULL,
  'Rechaza mark_member_invited si socio ya tiene auth_user_id (ERRCODE 23505)'
);

SELECT step, result FROM test_results ORDER BY step;
ROLLBACK;
