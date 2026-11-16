-- Rollback 0015_stripe_subscriptions_schema.sql
-- ATENCION: esto borra columnas y tablas. Si hay data, se pierde.

DROP TABLE IF EXISTS public.checkout_sessions CASCADE;
DROP TABLE IF EXISTS public.stripe_webhook_events CASCADE;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_source_check;
ALTER TABLE public.payments DROP COLUMN IF EXISTS payment_source;
ALTER TABLE public.payments DROP COLUMN IF EXISTS stripe_checkout_session_id;
ALTER TABLE public.payments DROP COLUMN IF EXISTS stripe_invoice_id;

DROP INDEX IF EXISTS public.members_auth_user_id_idx;
DROP INDEX IF EXISTS public.members_stripe_subscription_id_idx;

ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_subscription_status_check;
ALTER TABLE public.members DROP COLUMN IF EXISTS auth_user_id;
ALTER TABLE public.members DROP COLUMN IF EXISTS subscription_current_period_end;
ALTER TABLE public.members DROP COLUMN IF EXISTS subscription_status;
ALTER TABLE public.members DROP COLUMN IF EXISTS stripe_subscription_id;
-- NO borramos stripe_customer_id porque estaba en schema inicial pre-1C.

ALTER TABLE public.tariffs DROP CONSTRAINT IF EXISTS tariffs_stripe_sync_status_check;
ALTER TABLE public.tariffs DROP COLUMN IF EXISTS stripe_last_synced_at;
ALTER TABLE public.tariffs DROP COLUMN IF EXISTS stripe_sync_error;
ALTER TABLE public.tariffs DROP COLUMN IF EXISTS stripe_sync_status;
ALTER TABLE public.tariffs DROP COLUMN IF EXISTS stripe_price_id;
ALTER TABLE public.tariffs DROP COLUMN IF EXISTS stripe_product_id;
