-- Rollback 0055_pe_training_groups
DROP TABLE IF EXISTS public.training_group_members CASCADE;
DROP TABLE IF EXISTS public.training_groups CASCADE;
DROP FUNCTION IF EXISTS public.tg_training_groups_updated_at() CASCADE;
