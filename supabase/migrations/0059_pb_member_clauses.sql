-- =============================================================================
-- 0059 — Cláusulas RGPD ficha socio (firma digital + plantillas) — PB
--
-- Contexto: G1 audit V5 P1 #1 — RGPD consent hardcoded crítico. LegacyGym
-- sección Cláusulas en ficha cliente: tabla con (Cláusula, Fecha, Estado,
-- Fecha de firma) + botones "Asignar cláusula" / "Añadir firma".
--
-- Schema:
--   - `gym_clause_templates`: plantillas configurables del gym (RGPD, RC,
--     consentimiento médico, foto/vídeo, menores, política devoluciones).
--   - `member_clauses`: instancia firmada/pendiente por socio.
--
-- Decision #111: UPDATE/DELETE policies explícitas.
-- Firma simple = nombre tipeado + IP + timestamp + boolean accepted (sin
-- canvas, suficiente legalmente con audit log).
-- =============================================================================

-- ============================================================================
-- 1. Tabla gym_clause_templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.gym_clause_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (length(code) BETWEEN 2 AND 60),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (length(body) >= 1),
  is_required boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gym_id, code)
);

CREATE INDEX IF NOT EXISTS idx_clause_templates_gym
  ON public.gym_clause_templates(gym_id, sort_order)
  WHERE is_active = true;

COMMENT ON TABLE public.gym_clause_templates IS
  'Plantillas de cláusulas configurables por gym (RGPD, responsabilidad civil, consentimiento médico, foto/vídeo, menores, devoluciones).';

-- ============================================================================
-- 2. Tabla member_clauses (instancias por socio)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.member_clauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.gym_clause_templates(id) ON DELETE SET NULL,

  -- Snapshot al firmar (integridad legal — si la plantilla cambia luego, la
  -- versión firmada permanece literal)
  title_snapshot text NOT NULL,
  body_snapshot text NOT NULL,

  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'rejected', 'expired')),

  -- Firma (cuando status='signed')
  signed_at timestamptz,
  signed_by_name text,
  signed_by_ip text,

  -- Asignación
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz,

  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- No duplicar misma plantilla activa para mismo socio
  CONSTRAINT member_clause_signed_consistency CHECK (
    (status = 'signed' AND signed_at IS NOT NULL AND signed_by_name IS NOT NULL)
    OR status <> 'signed'
  )
);

CREATE INDEX IF NOT EXISTS idx_member_clauses_member
  ON public.member_clauses(member_id, status, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_clauses_gym
  ON public.member_clauses(gym_id, status);

COMMENT ON TABLE public.member_clauses IS
  'Cláusulas asignadas a cada socio. Snapshot de title/body al asignar para integridad legal.';

-- ============================================================================
-- 3. RLS
-- ============================================================================

ALTER TABLE public.gym_clause_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_clauses ENABLE ROW LEVEL SECURITY;

-- Templates: staff lectura, owner/admin escritura
CREATE POLICY "clause_templates_select_staff"
  ON public.gym_clause_templates FOR SELECT TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
    )
  );

CREATE POLICY "clause_templates_insert_admin"
  ON public.gym_clause_templates FOR INSERT TO authenticated
  WITH CHECK (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "clause_templates_update_admin"
  ON public.gym_clause_templates FOR UPDATE TO authenticated
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

CREATE POLICY "clause_templates_delete_admin"
  ON public.gym_clause_templates FOR DELETE TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gym_clause_templates TO authenticated;

-- member_clauses: staff full + el propio socio puede ver y firmar las suyas
CREATE POLICY "member_clauses_select_staff_or_self"
  ON public.member_clauses FOR SELECT TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
    )
    OR member_id IN (
      SELECT id FROM public.members WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "member_clauses_insert_staff"
  ON public.member_clauses FOR INSERT TO authenticated
  WITH CHECK (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
    )
  );

-- UPDATE: staff puede TODO. Socio puede actualizar solo su propia (firmar/rechazar).
CREATE POLICY "member_clauses_update_staff"
  ON public.member_clauses FOR UPDATE TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
    )
    OR member_id IN (
      SELECT id FROM public.members WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
    )
    OR member_id IN (
      SELECT id FROM public.members WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "member_clauses_delete_admin"
  ON public.member_clauses FOR DELETE TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_clauses TO authenticated;

-- ============================================================================
-- 4. Triggers updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.touch_gym_clause_templates_updated_at()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $fn$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $fn$;

DROP TRIGGER IF EXISTS trg_gym_clause_templates_updated_at ON public.gym_clause_templates;
CREATE TRIGGER trg_gym_clause_templates_updated_at
  BEFORE UPDATE ON public.gym_clause_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_gym_clause_templates_updated_at();

CREATE OR REPLACE FUNCTION public.touch_member_clauses_updated_at()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $fn$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $fn$;

DROP TRIGGER IF EXISTS trg_member_clauses_updated_at ON public.member_clauses;
CREATE TRIGGER trg_member_clauses_updated_at
  BEFORE UPDATE ON public.member_clauses
  FOR EACH ROW EXECUTE FUNCTION public.touch_member_clauses_updated_at();

-- ============================================================================
-- 5. RPC assign_clause_to_member (snapshot atómico)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_clause_to_member(
  p_member_id uuid,
  p_template_id uuid,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS public.member_clauses
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_member public.members;
  v_template public.gym_clause_templates;
  v_row public.member_clauses;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = p_member_id;
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'socio no existe' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_template FROM public.gym_clause_templates WHERE id = p_template_id;
  IF v_template IS NULL THEN
    RAISE EXCEPTION 'plantilla no existe' USING ERRCODE = '22023';
  END IF;

  IF v_template.gym_id <> v_member.gym_id THEN
    RAISE EXCEPTION 'plantilla y socio en gyms distintos' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE user_id = auth.uid() AND gym_id = v_member.gym_id AND role IN ('owner', 'admin', 'trainer')
  ) THEN
    RAISE EXCEPTION 'Sin permiso para asignar cláusulas' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.member_clauses (
    gym_id, member_id, template_id, title_snapshot, body_snapshot,
    assigned_by, expires_at
  )
  VALUES (
    v_member.gym_id, v_member.id, v_template.id, v_template.title, v_template.body,
    auth.uid(), p_expires_at
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$fn$;

REVOKE ALL ON FUNCTION public.assign_clause_to_member(uuid, uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_clause_to_member(uuid, uuid, timestamptz) TO authenticated;

-- ============================================================================
-- 6. RPC sign_member_clause
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sign_member_clause(
  p_clause_id uuid,
  p_signed_by_name text,
  p_signed_by_ip text DEFAULT NULL
)
RETURNS public.member_clauses
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_row public.member_clauses;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_row FROM public.member_clauses WHERE id = p_clause_id;
  IF v_row IS NULL THEN
    RAISE EXCEPTION 'cláusula no existe' USING ERRCODE = '22023';
  END IF;

  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'cláusula ya está en estado %', v_row.status USING ERRCODE = '22023';
  END IF;

  IF p_signed_by_name IS NULL OR length(trim(p_signed_by_name)) = 0 THEN
    RAISE EXCEPTION 'firma requiere nombre' USING ERRCODE = '22023';
  END IF;

  -- Permiso: staff del gym O el propio socio
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.gym_users
      WHERE user_id = auth.uid() AND gym_id = v_row.gym_id AND role IN ('owner', 'admin', 'trainer')
    )
    OR EXISTS (
      SELECT 1 FROM public.members WHERE id = v_row.member_id AND auth_user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Sin permiso para firmar' USING ERRCODE = '42501';
  END IF;

  UPDATE public.member_clauses
    SET status = 'signed',
        signed_at = now(),
        signed_by_name = p_signed_by_name,
        signed_by_ip = p_signed_by_ip,
        updated_at = now()
    WHERE id = p_clause_id
    RETURNING * INTO v_row;

  RETURN v_row;
END;
$fn$;

REVOKE ALL ON FUNCTION public.sign_member_clause(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sign_member_clause(uuid, text, text) TO authenticated;
