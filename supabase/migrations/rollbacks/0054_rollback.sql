-- Rollback 0054_pe_families
DROP TABLE IF EXISTS public.family_members CASCADE;
DROP TABLE IF EXISTS public.families CASCADE;
DROP FUNCTION IF EXISTS public.tg_families_updated_at() CASCADE;
