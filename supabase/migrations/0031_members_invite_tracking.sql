-- =============================================================================
-- 0031 — Tracking invitaciones de socios a la app (internal ticket)
--
-- Contexto: 196 socios Demo Studio importados (PR #38) sin auth_user_id.
-- owner necesita invitarlos a la app. inviteMemberAction existe (PR #6
-- Fase 1C) pero no persiste estado → imposible saber "qué socios ya invité",
-- "cuántos activaron", "re-invitar a los pendientes".
--
-- Schema delta:
--   - members.invite_sent_at TIMESTAMPTZ (último envío de invitación)
--   - members.invite_count INT (idempotencia suave + rate limiting)
--   - Index parcial para filtros UI rápidos ("pendientes de invitar")
--
-- NO cambia semántica existente: auth_user_id sigue siendo la fuente de
-- verdad sobre "socio vinculado". invite_sent_at es solo tracking.
--
-- pgTAP asociado: supabase/tests/rls_invite_members.sql
-- =============================================================================

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS invite_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS invite_count integer NOT NULL DEFAULT 0 CHECK (invite_count >= 0);

COMMENT ON COLUMN public.members.invite_sent_at IS
  'Timestamp del último envío de invitación vía magic link. NULL = nunca invitado.';
COMMENT ON COLUMN public.members.invite_count IS
  'Contador de re-invitaciones (rate limiting suave — UI puede bloquear re-invite si >3).';

-- Index parcial para queries UI: "socios sin invitar" + "pendientes activación"
CREATE INDEX IF NOT EXISTS idx_members_invite_pending
  ON public.members (gym_id, invite_sent_at NULLS FIRST)
  WHERE auth_user_id IS NULL;

-- =============================================================================
-- RPC mark_member_invited — helper atómico para bulk + idempotencia
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mark_member_invited(p_member_id uuid)
RETURNS public.members
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_member public.members;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE = '28000';
  END IF;

  -- Guard staff del gym del socio
  SELECT * INTO v_member FROM public.members WHERE id = p_member_id;
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'socio no existe' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE user_id = auth.uid() AND gym_id = v_member.gym_id AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para invitar socios' USING ERRCODE = '42501';
  END IF;

  IF v_member.auth_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'El socio ya tiene cuenta activa' USING ERRCODE = '23505';
  END IF;

  UPDATE public.members
    SET invite_sent_at = now(),
        invite_count = invite_count + 1,
        updated_at = now()
    WHERE id = p_member_id
    RETURNING * INTO v_member;

  RETURN v_member;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mark_member_invited(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_member_invited(uuid) TO authenticated;
