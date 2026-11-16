-- 0028 Rollback — remove UPDATE policy on gym_tours_seen

DROP POLICY IF EXISTS "tours_seen_update_own" ON public.gym_tours_seen;
