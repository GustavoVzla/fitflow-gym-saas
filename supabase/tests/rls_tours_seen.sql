-- =============================================================================
-- pgTAP test — RLS on public.gym_tours_seen (migración 0025)
-- =============================================================================
-- Valida:
--   1. User A mark_tour_seen OK para si mismo
--   2. User A get_tours_seen devuelve solo sus propios tours
--   3. User A NO ve rows de User B (via SELECT directo — RLS tabla)
--   4. User A NO puede insertar con user_id de User B (WITH CHECK denied)
--   5. Anon (sin JWT) → mark_tour_seen falla con 28000
--   6. Idempotencia: marcar mismo tour 2 veces OK (ON CONFLICT)
-- =============================================================================

BEGIN;

-- Fixtures: 2 users autenticables
DO $$ BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES
    ('aaaaaaaa-1111-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-tours-a@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb),
    ('bbbbbbbb-2222-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-tours-b@example.invalid', crypt('test', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;
END $$;

SELECT plan(6);
CREATE TEMP TABLE test_results (step int, result text);
GRANT INSERT, SELECT ON test_results TO authenticated;

-- ===========================================================================
-- User A context
-- ===========================================================================
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"aaaaaaaa-1111-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}';

-- Test 1: mark_tour_seen lives_ok
INSERT INTO test_results SELECT 1, lives_ok(
  $t$ SELECT public.mark_tour_seen('rls-test-a-tour') $t$,
  'User A mark_tour_seen OK para si mismo'
);

-- Test 6: Idempotencia
INSERT INTO test_results SELECT 6, lives_ok(
  $t$ SELECT public.mark_tour_seen('rls-test-a-tour') $t$,
  'User A mark_tour_seen idempotente (ON CONFLICT)'
);

-- Test 2: get_tours_seen devuelve solo sus tours
INSERT INTO test_results SELECT 2, results_eq(
  $t$ SELECT array_agg(k) FROM public.get_tours_seen() k WHERE k = 'rls-test-a-tour' $t$,
  $t$ VALUES (ARRAY['rls-test-a-tour']::text[]) $t$,
  'User A ve su propio tour en get_tours_seen'
);

-- Test 4: User A NO puede insertar con user_id de B (WITH CHECK)
INSERT INTO test_results SELECT 4, throws_ok(
  $t$
    INSERT INTO public.gym_tours_seen (user_id, tour_key)
    VALUES ('bbbbbbbb-2222-0000-0000-00000000000b', 'evil-tour')
  $t$,
  NULL,  -- cualquier SQLSTATE (RLS violation o similar)
  NULL,
  'User A NO puede insertar row con user_id de User B (RLS WITH CHECK)'
);

-- ===========================================================================
-- User B context
-- ===========================================================================
SET LOCAL "request.jwt.claims" = '{"sub":"bbbbbbbb-2222-0000-0000-00000000000b","role":"authenticated","aal":"aal2"}';

-- User B marca su propio tour
SELECT public.mark_tour_seen('rls-test-b-tour');

-- Test 3: User B NO ve el tour de User A
INSERT INTO test_results SELECT 3, is_empty(
  $t$ SELECT tour_key FROM public.gym_tours_seen WHERE tour_key = 'rls-test-a-tour' $t$,
  'User B NO ve tours de User A via SELECT directo (RLS)'
);

-- ===========================================================================
-- Anon context
-- ===========================================================================
SET LOCAL role = anon;
SET LOCAL "request.jwt.claims" = '';

-- Test 5: Anon → mark_tour_seen falla 28000
INSERT INTO test_results SELECT 5, throws_ok(
  $t$ SELECT public.mark_tour_seen('anon-tour') $t$,
  NULL,
  NULL,
  'Anon NO puede mark_tour_seen (autenticacion requerida)'
);

SELECT step, result FROM test_results ORDER BY step;
ROLLBACK;
