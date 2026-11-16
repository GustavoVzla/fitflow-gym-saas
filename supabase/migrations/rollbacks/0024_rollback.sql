-- 0024 Rollback — Remove onboarding persistence

DROP FUNCTION IF EXISTS public.dismiss_onboarding(uuid);
DROP FUNCTION IF EXISTS public.get_onboarding_state(uuid);
DROP TABLE IF EXISTS public.gym_onboarding_progress CASCADE;
