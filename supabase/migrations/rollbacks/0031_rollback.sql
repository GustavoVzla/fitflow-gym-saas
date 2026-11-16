-- Rollback 0031_members_invite_tracking.sql
DROP FUNCTION IF EXISTS public.mark_member_invited(uuid);
DROP INDEX IF EXISTS public.idx_members_invite_pending;
ALTER TABLE public.members DROP COLUMN IF EXISTS invite_count;
ALTER TABLE public.members DROP COLUMN IF EXISTS invite_sent_at;
