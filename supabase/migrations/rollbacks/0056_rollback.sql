-- Rollback 0056_pe_prospects
DROP FUNCTION IF EXISTS public.convert_prospect_to_member(uuid, uuid) CASCADE;
DROP TABLE IF EXISTS public.prospects CASCADE;
DROP TYPE IF EXISTS public.prospect_status CASCADE;
DROP FUNCTION IF EXISTS public.tg_prospects_updated_at() CASCADE;
