-- Rollback 0037_engagement_alerts_history
DROP TABLE IF EXISTS public.engagement_history CASCADE;
DROP TABLE IF EXISTS public.engagement_alerts CASCADE;
DROP FUNCTION IF EXISTS public.tg_engagement_alerts_updated_at() CASCADE;
