-- =============================================================================
-- 0075 — PD paridad 100%: /publicaciones audience targeting
--
-- Contexto: audit delta LIVE /publicaciones (tick 9) confirma form 3 campos
-- (Título, Contenido, Tags) + tabs filtro Todos/Publicados/Borradores.
-- Schema `posts` ya tiene media_urls ARRAY (upload imagenes múltiples).
-- Falta: audience targeting (all/active/by_tariff).
--
-- Decisiones:
--   - `audience JSONB NOT NULL DEFAULT '{"type":"all"}'` — retrocompat.
--   - Schema JSONB flexible: {type: 'all'} | {type: 'active'} | {type: 'by_tariff', tariff_ids: [uuid]}
--   - NO crea enum — JSONB permite evolución futura sin migración DDL adicional.
--   - Índice GIN sobre audience para queries por type (raro pero barato).
-- =============================================================================

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS audience jsonb NOT NULL DEFAULT '{"type":"all"}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_posts_audience
  ON public.posts USING gin (audience);

COMMENT ON COLUMN public.posts.audience IS
  'Audiencia targeting JSONB. Formato: {type:"all"} | {type:"active"} | {type:"by_tariff", tariff_ids:[uuid]}. Default "all" retrocompat.';
