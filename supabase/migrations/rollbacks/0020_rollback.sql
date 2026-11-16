-- Rollback migration 0020 — remove aal2-required policies on app_admins.

DROP POLICY IF EXISTS "app_admins self delete aal2 only" ON public.app_admins;
DROP POLICY IF EXISTS "app_admins self update aal2 only" ON public.app_admins;
