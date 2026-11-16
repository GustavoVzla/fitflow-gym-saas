-- =============================================================================
-- 0065 — member_assigned_instructors (asignación masiva instructor↔socio) — PB
--
-- Contexto: handoff paridad100 bloque 4 — personal training pairing.
-- Permite asignar 1+ instructores como "trainers asignados" a un socio
-- (distinto de instructor de clase concreta). Útil para coaching personalizado.
--
-- Schema:
--   M:N member_id × instructor_id, PK compuesta
--   gym_id desnormalizado para RLS sin join
--   assigned_by (auditoría)
--   notes (motivo asignación opcional)
--
-- Decision #111: UPDATE/DELETE explícitas.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.member_assigned_instructors (
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  PRIMARY KEY (member_id, instructor_id)
);

CREATE INDEX IF NOT EXISTS idx_member_assigned_instr_gym
  ON public.member_assigned_instructors(gym_id, instructor_id);
CREATE INDEX IF NOT EXISTS idx_member_assigned_instr_member
  ON public.member_assigned_instructors(member_id);

COMMENT ON TABLE public.member_assigned_instructors IS
  'Asignación instructor↔socio para personal training pairing. Distinto de instructor de clase concreta.';

ALTER TABLE public.member_assigned_instructors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_assigned_instr_select_staff_or_self"
  ON public.member_assigned_instructors FOR SELECT TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
    )
    OR member_id IN (
      SELECT id FROM public.members WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "member_assigned_instr_insert_admin"
  ON public.member_assigned_instructors FOR INSERT TO authenticated
  WITH CHECK (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "member_assigned_instr_update_admin"
  ON public.member_assigned_instructors FOR UPDATE TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "member_assigned_instr_delete_admin"
  ON public.member_assigned_instructors FOR DELETE TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_assigned_instructors TO authenticated;

-- ============================================================================
-- RPC bulk_assign_instructor — asigna 1 instructor a N socios atómicamente
-- ============================================================================

CREATE OR REPLACE FUNCTION public.bulk_assign_instructor(
  p_instructor_id uuid,
  p_member_ids uuid[],
  p_notes text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_gym_id uuid;
  v_count integer := 0;
  v_member_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE = '28000';
  END IF;

  SELECT gym_id INTO v_gym_id FROM public.instructors WHERE id = p_instructor_id;
  IF v_gym_id IS NULL THEN
    RAISE EXCEPTION 'instructor no existe' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE user_id = auth.uid() AND gym_id = v_gym_id AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Sin permiso' USING ERRCODE = '42501';
  END IF;

  FOREACH v_member_id IN ARRAY p_member_ids
  LOOP
    -- Verifica que el socio pertenece al mismo gym
    IF EXISTS (SELECT 1 FROM public.members WHERE id = v_member_id AND gym_id = v_gym_id) THEN
      INSERT INTO public.member_assigned_instructors (
        member_id, instructor_id, gym_id, assigned_by, notes
      )
      VALUES (v_member_id, p_instructor_id, v_gym_id, auth.uid(), p_notes)
      ON CONFLICT (member_id, instructor_id) DO NOTHING;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$fn$;

REVOKE ALL ON FUNCTION public.bulk_assign_instructor(uuid, uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_assign_instructor(uuid, uuid[], text) TO authenticated;
