-- =============================================================================
-- 0067 — PD paridad 100%: expand competitions schema (audit delta 25-abr)
--
-- Contexto: audit LIVE confirma que UI /competiciones usa form simple 4 campos
-- mientras LegacyGym tiene form 4 secciones con inscripción online + contacto +
-- ubicación + URL pública. Schema actual `competitions` (0001) carece de todos
-- esos campos. Esta migración los añade NULLABLE para no romper datos.
--
-- Decisiones:
--   - Columnas NULLABLE con DEFAULT seguros. UI decide cuáles exponer.
--   - `slug` UNIQUE (gym_id, slug) para URL pública `/c/{slug}`.
--   - `cover_image_url` referencia bucket gym-assets (no FK, string libre).
--   - `contact_email`/`contact_phone` validación básica con CHECK.
--   - `latitude`/`longitude` NUMERIC(9,6) suficiente precision (~11cm).
--   - `categories TEXT[]` multi-categoría (RX/Scaled/Masters/etc.).
--   - `online_registration_enabled` toggle master para mostrar form público.
--   - `price_cents INTEGER` precio inscripción (NULL = gratis).
--   - `waitlist_enabled` + `max_registrations` control capacity.
--   - Sin CREATE OR REPLACE de RLS (ya existen, aplica a todas las columnas).
-- =============================================================================

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS conditions text,
  ADD COLUMN IF NOT EXISTS online_registration_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  ADD COLUMN IF NOT EXISTS tax_percent numeric(5,2) CHECK (tax_percent IS NULL OR (tax_percent >= 0 AND tax_percent <= 100)),
  ADD COLUMN IF NOT EXISTS max_registrations integer CHECK (max_registrations IS NULL OR max_registrations > 0),
  ADD COLUMN IF NOT EXISTS waitlist_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS contact_email text CHECK (contact_email IS NULL OR contact_email ~* '^[^@]+@[^@]+\.[^@]+$'),
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS location_address text,
  ADD COLUMN IF NOT EXISTS latitude numeric(9,6) CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  ADD COLUMN IF NOT EXISTS longitude numeric(9,6) CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

-- Slug per-gym único (permite usar mismo slug en gyms distintos)
-- Solo se aplica cuando slug no es NULL
CREATE UNIQUE INDEX IF NOT EXISTS uniq_competitions_gym_slug
  ON public.competitions(gym_id, slug)
  WHERE slug IS NOT NULL;

-- Lookup rápido para ruta pública /c/{slug}
CREATE INDEX IF NOT EXISTS idx_competitions_slug_public
  ON public.competitions(slug)
  WHERE slug IS NOT NULL AND is_active = true;

COMMENT ON COLUMN public.competitions.slug IS
  'Slug URL pública /c/{slug}. Único por gym. NULL = sin ruta pública.';
COMMENT ON COLUMN public.competitions.online_registration_enabled IS
  'Toggle master: si true, form público en /c/{slug} acepta inscripciones. Si false, solo staff puede añadir participantes desde panel.';
COMMENT ON COLUMN public.competitions.categories IS
  'Categorías configurables: RX, Scaled, Masters, Mujeres, etc. Un participante se inscribe en UNA categoría.';
COMMENT ON COLUMN public.competitions.cover_image_url IS
  'URL a imagen bucket gym-assets. No FK (string libre).';
