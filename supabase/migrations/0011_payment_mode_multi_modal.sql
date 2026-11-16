-- =============================================================================
-- 0011 — Multi-modo de pagos por gym (Decision #102)
-- 5 modos configurables. Fase 1 implementa direct_keys + manual.
-- Schema soporta los 5 desde día 1 para evitar refactor futuro.
-- =============================================================================

create type payment_mode as enum (
  'manual',           -- Cash / sin Stripe. Registro manual en /pagos
  'direct_keys',      -- Gym pega sus sk_live (caso Demo Studio)
  'connect_express',  -- Onboarding hosted FitFlow (Fase 2)
  'connect_standard', -- OAuth elegante (Fase 3)
  'managed'           -- FitFlow cobra y paga al gym (Fase 4)
);

-- Columnas nuevas en gyms (stripe_account_id + stripe_customer_id ya existen desde 0001)
alter table public.gyms add column payment_mode payment_mode not null default 'manual';
alter table public.gyms add column stripe_publishable_key text;
alter table public.gyms add column stripe_key_vault_id uuid;
alter table public.gyms add column stripe_webhook_vault_id uuid;
alter table public.gyms add column stripe_onboarded_at timestamptz;
alter table public.gyms add column fee_percent_sepa numeric(5,2) not null default 0.00;
alter table public.gyms add column fee_percent_card numeric(5,2) not null default 0.00;

comment on column public.gyms.payment_mode is 'Modo Stripe elegido por el gym (Decision #102). manual=sin Stripe, direct_keys=gym pega sus claves, connect_*/managed=Fase 2-4.';
comment on column public.gyms.stripe_publishable_key is 'pk_live/pk_test del gym (no sensible). Solo modo direct_keys.';
comment on column public.gyms.stripe_key_vault_id is 'UUID en vault.secrets donde está cifrada la sk del gym. Solo modo direct_keys.';
comment on column public.gyms.stripe_webhook_vault_id is 'UUID en vault.secrets del webhook signing secret (futuro).';
comment on column public.gyms.stripe_onboarded_at is 'Timestamp cuando el gym completó la configuración Stripe.';
comment on column public.gyms.fee_percent_sepa is 'Comisión FitFlow SEPA %. 0 para modos manual/direct_keys, configurable para connect/managed.';
comment on column public.gyms.fee_percent_card is 'Comisión FitFlow tarjeta %. Mismo patrón que SEPA.';

-- Índice para consultas del panel super-admin (contar gyms por modo)
create index gyms_payment_mode_idx on public.gyms (payment_mode);
