-- Rollback 0029_import_jobs.sql
DROP FUNCTION IF EXISTS public.admin_list_import_jobs(uuid);
DROP FUNCTION IF EXISTS public.admin_import_members_from_csv(uuid, text, jsonb, jsonb);
DROP POLICY IF EXISTS "import_jobs_update_admin" ON public.import_jobs;
DROP POLICY IF EXISTS "import_jobs_insert_admin" ON public.import_jobs;
DROP POLICY IF EXISTS "import_jobs_select_admin" ON public.import_jobs;
DROP TABLE IF EXISTS public.import_jobs;
DROP TYPE IF EXISTS public.import_job_status;
DROP TYPE IF EXISTS public.import_job_type;
