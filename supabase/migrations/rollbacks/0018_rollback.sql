-- Rollback 0018_member_auth.sql
DROP POLICY IF EXISTS "member_read_own_current_tariff" ON public.tariffs;
DROP POLICY IF EXISTS "member_read_own_payments" ON public.payments;
DROP POLICY IF EXISTS "member_update_own_contact" ON public.members;
DROP POLICY IF EXISTS "member_read_own_record" ON public.members;
DROP FUNCTION IF EXISTS public.link_member_auth_user(uuid);
