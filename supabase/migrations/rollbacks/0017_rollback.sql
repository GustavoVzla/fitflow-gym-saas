-- Rollback 0017_stripe_webhook_secret_rpcs.sql
-- Nota: no limpiamos secrets existentes en vault.secrets (si hay data). Solo borramos RPCs.
DROP FUNCTION IF EXISTS public.get_gym_stripe_webhook_secret(uuid);
DROP FUNCTION IF EXISTS public.set_gym_stripe_webhook_secret(uuid, text);
