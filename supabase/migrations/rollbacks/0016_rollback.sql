-- Rollback 0016_sync_tariff_stripe_rpc.sql
DROP FUNCTION IF EXISTS public.mark_tariff_stripe_synced(uuid, text, text, text, text);
