-- =============================================================================
-- 0071 — PD paridad 100%: /ofertas target audience
--
-- Contexto: audit LIVE /ofertas (tick 3) confirma que schema `offers` tiene
-- `applicable_tariff_ids TEXT[]` pero form UI no lo expone. Además falta
-- `target_audience` (all/active/new/churned) del spec handoff.
--
-- Decisiones:
--   - ENUM nuevo `offer_target_audience` — tipado estricto, rollbackable.
--   - Columna NULLABLE DEFAULT 'all' (retrocompat, ofertas existentes quedan
--     como all = cualquier socio puede canjear).
--   - NO se crea tabla `offer_redemptions` (tracking individual de cada uso):
--     queda fuera de scope en este delta, basta con el contador `current_redemptions`
--     + uniqueness de `code` que ya tiene.
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.offer_target_audience AS ENUM (
    'all',       -- cualquier socio
    'active',    -- socios con tarifa activa (no churn)
    'new',       -- socios registrados <30 días
    'churned'    -- reactivación: socios inactive o cancelled
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS target_audience public.offer_target_audience
    NOT NULL DEFAULT 'all';

COMMENT ON COLUMN public.offers.target_audience IS
  'Audiencia objetivo de la oferta. UI filtra socios cuando aplica código. all=todos, active=con tarifa, new=<30d registro, churned=reactivación.';

-- Índice parcial para listado filtrado por audience (raro pero útil)
CREATE INDEX IF NOT EXISTS idx_offers_gym_audience_active
  ON public.offers(gym_id, target_audience)
  WHERE is_active = true;
