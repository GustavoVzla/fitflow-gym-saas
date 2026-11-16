-- =============================================================================
-- 0028 — Fix gym_tours_seen UPDATE policy (corrige 0025)
--
-- Bug: migración 0025 creó SELECT + INSERT policies pero omitió UPDATE con
-- comentario "seen_at es immutable, solo insert via upsert RPC". El comentario
-- era incorrecto — el RPC mark_tour_seen hace:
--
--   INSERT ... ON CONFLICT (user_id, tour_key) DO UPDATE SET seen_at = now()
--
-- El ON CONFLICT DO UPDATE requiere UPDATE policy explícita en Postgres
-- aunque el valor sea idéntico. Sin la policy, la segunda llamada a
-- mark_tour_seen para el mismo tour falla con 42501 (RLS violation).
--
-- Detectado por pgTAP rls_tours_seen.sql (test 6: idempotencia).
-- Lección: comentarios "campo immutable" en policies INSERT-only son
-- antipattern si hay RPC que hace upsert.
-- =============================================================================

CREATE POLICY "tours_seen_update_own"
  ON public.gym_tours_seen FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
