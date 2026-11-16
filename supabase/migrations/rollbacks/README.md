# Rollback scripts

Cada migración en `../NNNN_*.sql` debe tener su rollback en `./NNNN_rollback.sql`.

## Regla

Antes de aplicar una migración nueva:
1. Escribir el `.sql` forward
2. Escribir el `_rollback.sql` que revierte exactamente los cambios
3. Aplicar forward vía `mcp__supabase__apply_migration`
4. Si algo falla: aplicar el rollback

## Principios

- Los rollbacks NO se aplican automáticamente. Solo cuando decidimos explícitamente revertir
- Los rollbacks deben ser idempotentes (`DROP IF EXISTS`, etc)
- Si una migración modifica data, el rollback debería intentar preservarla (comentar en el script si no es posible)
- Si el rollback implica perdida de data irrecuperable, documentarlo arriba del script

## Ejemplo

```sql
-- 0015_rollback.sql
-- Revierte 0015_stripe_subscriptions_schema.sql
-- ATENCION: esto borra columnas. Si hay data, se pierde.

DROP TABLE IF EXISTS public.checkout_sessions CASCADE;
DROP TABLE IF EXISTS public.stripe_webhook_events CASCADE;

ALTER TABLE public.payments DROP COLUMN IF EXISTS payment_source;
ALTER TABLE public.payments DROP COLUMN IF EXISTS stripe_checkout_session_id;
ALTER TABLE public.payments DROP COLUMN IF EXISTS stripe_invoice_id;

ALTER TABLE public.members DROP COLUMN IF EXISTS auth_user_id;
ALTER TABLE public.members DROP COLUMN IF EXISTS subscription_current_period_end;
ALTER TABLE public.members DROP COLUMN IF EXISTS subscription_status;
ALTER TABLE public.members DROP COLUMN IF EXISTS stripe_subscription_id;
ALTER TABLE public.members DROP COLUMN IF EXISTS stripe_customer_id;

ALTER TABLE public.tariffs DROP COLUMN IF EXISTS stripe_last_synced_at;
ALTER TABLE public.tariffs DROP COLUMN IF EXISTS stripe_sync_error;
ALTER TABLE public.tariffs DROP COLUMN IF EXISTS stripe_sync_status;
ALTER TABLE public.tariffs DROP COLUMN IF EXISTS stripe_price_id;
ALTER TABLE public.tariffs DROP COLUMN IF EXISTS stripe_product_id;
```
