-- =============================================================================
-- 0015 — Stripe Subscriptions + Checkout schema extensions (Fase 1C)
--
-- Extiende tariffs/members/payments con columnas Stripe + crea 2 tablas nuevas:
--   · stripe_webhook_events (idempotencia de webhooks)
--   · checkout_sessions (sesiones Checkout one-off con link compartible)
--
-- Patron: schema soporta subscriptions recurring + one-off payments desde dia 1.
-- Todo gym con payment_mode='direct_keys' puede usarlo. Modos Connect fases 2-4
-- heredan el schema sin refactor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extend tariffs: stripe Product/Price IDs + sync state
-- -----------------------------------------------------------------------------
ALTER TABLE public.tariffs ADD COLUMN stripe_product_id text;
ALTER TABLE public.tariffs ADD COLUMN stripe_price_id text;
ALTER TABLE public.tariffs ADD COLUMN stripe_sync_status text DEFAULT 'pending' NOT NULL;
ALTER TABLE public.tariffs ADD COLUMN stripe_sync_error text;
ALTER TABLE public.tariffs ADD COLUMN stripe_last_synced_at timestamptz;

ALTER TABLE public.tariffs ADD CONSTRAINT tariffs_stripe_sync_status_check
  CHECK (stripe_sync_status IN ('pending', 'synced', 'manual', 'error', 'disabled'));

COMMENT ON COLUMN public.tariffs.stripe_product_id IS 'Stripe Product ID en la cuenta del gym (Decision #102 direct_keys).';
COMMENT ON COLUMN public.tariffs.stripe_price_id IS 'Stripe Price ID activo (recurring o one_time). Cambia al editar precio (Prices inmutables).';
COMMENT ON COLUMN public.tariffs.stripe_sync_status IS 'pending=aun no sincronizado, synced=auto-sync OK, manual=super-admin introdujo ID, error=intento fallido, disabled=gym modo manual sin Stripe.';

-- -----------------------------------------------------------------------------
-- Extend members: stripe Customer + Subscription state + auth link
-- -----------------------------------------------------------------------------
ALTER TABLE public.members ADD COLUMN stripe_subscription_id text;
ALTER TABLE public.members ADD COLUMN subscription_status text;
ALTER TABLE public.members ADD COLUMN subscription_current_period_end timestamptz;
ALTER TABLE public.members ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- NOTA: stripe_customer_id YA existe en members (schema inicial). No re-crear.

ALTER TABLE public.members ADD CONSTRAINT members_subscription_status_check
  CHECK (subscription_status IS NULL OR subscription_status IN (
    'active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'
  ));

CREATE INDEX IF NOT EXISTS members_stripe_customer_id_idx ON public.members (stripe_customer_id);
CREATE INDEX IF NOT EXISTS members_stripe_subscription_id_idx ON public.members (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS members_auth_user_id_idx ON public.members (auth_user_id);

COMMENT ON COLUMN public.members.stripe_subscription_id IS 'Subscription Stripe activa para este socio en la cuenta del gym. NULL si no ha activado domiciliacion.';
COMMENT ON COLUMN public.members.subscription_status IS 'Estado Stripe Subscription replicado via webhook customer.subscription.*.';
COMMENT ON COLUMN public.members.auth_user_id IS 'Link a auth.users cuando el socio tiene login propio (area /mi-cuenta). NULL = solo existe como registro del gym.';

-- -----------------------------------------------------------------------------
-- Extend payments: stripe Invoice/Checkout + payment_source
-- -----------------------------------------------------------------------------
ALTER TABLE public.payments ADD COLUMN stripe_invoice_id text;
ALTER TABLE public.payments ADD COLUMN stripe_checkout_session_id text;
ALTER TABLE public.payments ADD COLUMN payment_source text DEFAULT 'manual' NOT NULL;

ALTER TABLE public.payments ADD CONSTRAINT payments_payment_source_check
  CHECK (payment_source IN ('manual', 'payment_intent', 'checkout_one_off', 'subscription', 'refund'));

CREATE INDEX IF NOT EXISTS payments_stripe_invoice_id_idx ON public.payments (stripe_invoice_id);
CREATE INDEX IF NOT EXISTS payments_stripe_checkout_session_id_idx ON public.payments (stripe_checkout_session_id);

COMMENT ON COLUMN public.payments.stripe_invoice_id IS 'Invoice Stripe generada por renewal de subscription. Webhook invoice.paid crea el row.';
COMMENT ON COLUMN public.payments.stripe_checkout_session_id IS 'Checkout session one-off (pago unico con link). Webhook checkout.session.completed marca completed.';
COMMENT ON COLUMN public.payments.payment_source IS 'Origen: manual (cash), payment_intent (Fase 1 server-side), checkout_one_off (link), subscription (renewal), refund.';

-- -----------------------------------------------------------------------------
-- stripe_webhook_events: idempotencia
-- -----------------------------------------------------------------------------
CREATE TABLE public.stripe_webhook_events (
  id text PRIMARY KEY,                                          -- event_id Stripe (evt_...)
  gym_id uuid REFERENCES public.gyms(id) ON DELETE CASCADE,     -- gym que recibe el webhook
  event_type text NOT NULL,                                      -- e.g. 'invoice.paid'
  api_version text,                                              -- Stripe API version del event
  payload jsonb NOT NULL,                                        -- event completo para auditoria
  processed_at timestamptz DEFAULT now() NOT NULL,
  processing_error text                                          -- NULL = procesado OK
);

CREATE INDEX stripe_webhook_events_gym_id_processed_at_idx
  ON public.stripe_webhook_events (gym_id, processed_at DESC);
CREATE INDEX stripe_webhook_events_event_type_idx
  ON public.stripe_webhook_events (event_type);

-- RLS: solo service_role (webhook handler). No hay policies para usuarios normales.
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.stripe_webhook_events IS 'Idempotencia webhooks Stripe. PK=event_id garantiza no doble-procesado. Auditoria via payload JSONB.';

-- -----------------------------------------------------------------------------
-- checkout_sessions: one-off payments con link compartible
-- -----------------------------------------------------------------------------
CREATE TABLE public.checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  stripe_session_id text NOT NULL UNIQUE,                        -- cs_test_... o cs_live_...
  stripe_url text NOT NULL,                                       -- URL hosted Stripe Checkout
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'eur',
  status text NOT NULL DEFAULT 'open',
  expires_at timestamptz NOT NULL,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz,
  canceled_at timestamptz
);

ALTER TABLE public.checkout_sessions ADD CONSTRAINT checkout_sessions_status_check
  CHECK (status IN ('open', 'complete', 'expired', 'canceled'));

CREATE INDEX checkout_sessions_gym_id_created_at_idx
  ON public.checkout_sessions (gym_id, created_at DESC);
CREATE INDEX checkout_sessions_payment_id_idx
  ON public.checkout_sessions (payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX checkout_sessions_status_idx
  ON public.checkout_sessions (status) WHERE status = 'open';

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

-- Gym staff (owner/admin/manager) pueden leer sus sesiones
CREATE POLICY "gym_staff_read_own_checkout_sessions"
  ON public.checkout_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.gym_users gu
      WHERE gu.gym_id = checkout_sessions.gym_id
        AND gu.user_id = auth.uid()
        AND gu.is_active = true
        AND gu.role IN ('owner', 'admin', 'staff')
    )
    OR public.is_app_admin()
  );

-- Inserts/updates solo via Server Actions (service_role bypass RLS) y webhooks
-- (no CREATE POLICY FOR INSERT/UPDATE a proposito)

COMMENT ON TABLE public.checkout_sessions IS 'Stripe Checkout Sessions one-off (mode=payment). Link compartible por WhatsApp/email. Webhook checkout.session.completed marca completed.';

-- -----------------------------------------------------------------------------
-- updated_at trigger en checkout_sessions (opcional — uso created_at + completed_at)
-- Ya no hay trigger; los estados se marcan explicitamente via webhook handlers.
-- -----------------------------------------------------------------------------
