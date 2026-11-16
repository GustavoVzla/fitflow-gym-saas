-- =============================================================================
-- 0019 — pgTAP extension (testing framework para RLS policies)
--
-- Permite ejecutar tests SQL dentro de la DB. Instalado en schema `extensions`
-- como es convencion Supabase. Tests viven en `supabase/tests/rls_*.sql` y se
-- ejecutan via MCP supabase execute_sql o pg_prove contra DATABASE_URL.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
