-- 0025 Rollback — Remove tour seen state tables + RPCs

DROP FUNCTION IF EXISTS public.get_tours_seen();
DROP FUNCTION IF EXISTS public.mark_tour_seen(text);
DROP TABLE IF EXISTS public.gym_tours_seen CASCADE;
