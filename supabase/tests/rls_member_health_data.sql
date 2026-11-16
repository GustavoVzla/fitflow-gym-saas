-- pgTAP: RLS scope member_health_data (Art. 9 RGPD)
-- Verifica que trainers NO leen/escriben datos médicos; owner/admin sí.

BEGIN;

-- Fixtures
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, aud, role)
VALUES
  ('aaaa1111-1111-1111-1111-111111111111', 'owner@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email"}'::jsonb, 'authenticated', 'authenticated'),
  ('bbbb2222-2222-2222-2222-222222222222', 'trainer@test.local', crypt('x', gen_salt('bf')), now(), '{"provider":"email"}'::jsonb, 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.gyms (id, name, slug, plan, status, timezone, currency)
VALUES ('cccc3333-3333-3333-3333-333333333333', 'Test Gym', 'test-gym-hd', 'base', 'active', 'Europe/Madrid', 'EUR')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.gym_users (gym_id, user_id, role, is_active)
VALUES
  ('cccc3333-3333-3333-3333-333333333333', 'aaaa1111-1111-1111-1111-111111111111', 'owner', true),
  ('cccc3333-3333-3333-3333-333333333333', 'bbbb2222-2222-2222-2222-222222222222', 'trainer', true)
ON CONFLICT (gym_id, user_id) DO NOTHING;

INSERT INTO public.members (id, gym_id, first_name, last_name, email, status, join_date, rgpd_consent, rgpd_consent_at)
VALUES ('dddd4444-4444-4444-4444-444444444444', 'cccc3333-3333-3333-3333-333333333333', 'Test', 'Member', 'test-hd@test.local', 'active', CURRENT_DATE, true, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.member_health_data (member_id, gym_id, medical_notes, image_consent, marketing_consent)
VALUES ('dddd4444-4444-4444-4444-444444444444', 'cccc3333-3333-3333-3333-333333333333', 'Asma leve', true, false)
ON CONFLICT (member_id) DO NOTHING;

SELECT plan(4);

-- Test 1: OWNER ve datos médicos
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"aaaa1111-1111-1111-1111-111111111111","role":"authenticated"}';

SELECT results_eq(
  $$ SELECT count(*)::int FROM public.member_health_data WHERE member_id = 'dddd4444-4444-4444-4444-444444444444' $$,
  $$ VALUES (1::int) $$,
  'Owner lee datos médicos de su gym'
);

-- Test 2: TRAINER NO ve datos médicos
SET LOCAL "request.jwt.claims" = '{"sub":"bbbb2222-2222-2222-2222-222222222222","role":"authenticated"}';

SELECT is_empty(
  $$ SELECT member_id FROM public.member_health_data WHERE member_id = 'dddd4444-4444-4444-4444-444444444444' $$,
  'Trainer NO ve datos médicos (Art. 9 RGPD scope restringido)'
);

-- Test 3: TRAINER NO puede insertar datos médicos
SELECT throws_ok(
  $$ INSERT INTO public.member_health_data (member_id, gym_id, medical_notes)
     VALUES ('dddd4444-4444-4444-4444-444444444444', 'cccc3333-3333-3333-3333-333333333333', 'hack') $$,
  '42501',
  NULL,
  'Trainer NO puede escribir datos médicos'
);

-- Test 4: anon rechazado
SET LOCAL role = anon;
RESET "request.jwt.claims";
SELECT is_empty(
  $$ SELECT member_id FROM public.member_health_data $$,
  'Anon no ve nada (policies bloquean TO authenticated only)'
);

SELECT * FROM finish();

ROLLBACK;
