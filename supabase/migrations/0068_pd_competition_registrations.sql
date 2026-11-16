-- =============================================================================
-- 0068 — PD paridad 100%: competition_registrations (inscripciones)
--
-- Contexto: LegacyGym permite inscripción online público (usuario no-socio
-- puede inscribirse vía form público) + gestión desde panel staff.
--
-- Decisiones:
--   - `member_id` NULLABLE: soporta inscripción externa (no-socio).
--   - Si member_id NULL → datos persona en external_* columns obligatorias.
--   - `category` TEXT libre (validar contra competitions.categories array en RPC).
--   - `paid` bool tracking pago + payment_id NULL FK a payments si aplica.
--   - `waitlisted` bool si sobrepasó max_registrations y waitlist_enabled.
--   - RLS: staff ve todas del gym, socio ve solo las propias, PUBLIC insert
--     solo via RPC SECURITY DEFINER (inscripción form público).
--   - NO RLS policy para anon insert directo (solo via RPC controlada).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.competition_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,

  -- Socio interno O persona externa
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  external_first_name text,
  external_last_name text,
  external_email text,
  external_phone text,

  category text,

  paid boolean NOT NULL DEFAULT false,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  amount_cents integer CHECK (amount_cents IS NULL OR amount_cents >= 0),

  waitlisted boolean NOT NULL DEFAULT false,
  registered_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  cancellation_reason text,

  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Integridad: si no hay member_id, external_* obligatorios
  CONSTRAINT comp_reg_identity_check CHECK (
    member_id IS NOT NULL OR (
      external_first_name IS NOT NULL AND
      external_last_name IS NOT NULL AND
      external_email IS NOT NULL
    )
  ),

  -- Email válido si se proporciona
  CONSTRAINT comp_reg_email_valid CHECK (
    external_email IS NULL OR external_email ~* '^[^@]+@[^@]+\.[^@]+$'
  ),

  -- Cancelled consistency
  CONSTRAINT comp_reg_cancelled_consistency CHECK (
    (cancelled_at IS NULL AND cancellation_reason IS NULL) OR
    (cancelled_at IS NOT NULL)
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_comp_reg_competition
  ON public.competition_registrations(competition_id, registered_at DESC);
CREATE INDEX IF NOT EXISTS idx_comp_reg_gym
  ON public.competition_registrations(gym_id, registered_at DESC);
CREATE INDEX IF NOT EXISTS idx_comp_reg_member
  ON public.competition_registrations(member_id, registered_at DESC)
  WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comp_reg_payment
  ON public.competition_registrations(payment_id)
  WHERE payment_id IS NOT NULL;

-- No permitir duplicados: un socio/email solo puede inscribirse una vez por competición (activa)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_comp_reg_member_per_comp
  ON public.competition_registrations(competition_id, member_id)
  WHERE member_id IS NOT NULL AND cancelled_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_comp_reg_email_per_comp
  ON public.competition_registrations(competition_id, external_email)
  WHERE external_email IS NOT NULL AND member_id IS NULL AND cancelled_at IS NULL;

COMMENT ON TABLE public.competition_registrations IS
  'Inscripciones a competiciones. Soporta socios internos (member_id) y externos (form público /c/{slug} sin auth).';

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.competition_registrations ENABLE ROW LEVEL SECURITY;

-- Staff del gym ve todas
CREATE POLICY "comp_reg_select_staff"
  ON public.competition_registrations FOR SELECT TO authenticated
  USING (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid()
  ));

-- Socio ve solo las propias
CREATE POLICY "comp_reg_select_member_own"
  ON public.competition_registrations FOR SELECT TO authenticated
  USING (
    member_id IN (
      SELECT id FROM public.members WHERE auth_user_id = auth.uid()
    )
  );

-- Staff admin/owner crea registraciones directamente (para walk-ins manuales)
CREATE POLICY "comp_reg_insert_staff"
  ON public.competition_registrations FOR INSERT TO authenticated
  WITH CHECK (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
  ));

-- Update staff (cancelar, marcar paid, etc.)
CREATE POLICY "comp_reg_update_staff"
  ON public.competition_registrations FOR UPDATE TO authenticated
  USING (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
  ))
  WITH CHECK (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
  ));

-- Delete solo admin/owner
CREATE POLICY "comp_reg_delete_admin"
  ON public.competition_registrations FOR DELETE TO authenticated
  USING (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_registrations TO authenticated;

-- ============================================================================
-- RPC register_for_competition_public (inscripción pública sin auth)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.register_for_competition_public(
  p_competition_slug text,
  p_gym_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.competition_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_competition public.competitions;
  v_current_count integer;
  v_waitlist boolean := false;
  v_registration public.competition_registrations;
BEGIN
  -- Validaciones length defensivas (además de client-side) — previene abuso
  IF p_first_name IS NULL OR length(p_first_name) < 1 OR length(p_first_name) > 100 THEN
    RAISE EXCEPTION 'Nombre inválido (1-100 caracteres)' USING ERRCODE = '22023';
  END IF;
  IF p_last_name IS NULL OR length(p_last_name) < 1 OR length(p_last_name) > 100 THEN
    RAISE EXCEPTION 'Apellidos inválidos (1-100 caracteres)' USING ERRCODE = '22023';
  END IF;
  IF p_email IS NULL OR p_email !~* '^[^@]+@[^@]+\.[^@]+$' OR length(p_email) > 200 THEN
    RAISE EXCEPTION 'Email inválido' USING ERRCODE = '22023';
  END IF;
  IF p_phone IS NOT NULL AND length(p_phone) > 30 THEN
    RAISE EXCEPTION 'Teléfono inválido' USING ERRCODE = '22023';
  END IF;
  IF p_notes IS NOT NULL AND length(p_notes) > 2000 THEN
    RAISE EXCEPTION 'Comentarios demasiado largos (máx 2000)' USING ERRCODE = '22023';
  END IF;

  -- Buscar competición por slug + gym
  SELECT * INTO v_competition
    FROM public.competitions
    WHERE slug = p_competition_slug
      AND gym_id = p_gym_id
      AND is_active = true
      AND online_registration_enabled = true;

  IF v_competition IS NULL THEN
    RAISE EXCEPTION 'Competición no encontrada o inscripción no habilitada' USING ERRCODE = '22023';
  END IF;

  -- Validar fechas
  IF v_competition.start_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'La competición ya ha comenzado. Inscripciones cerradas.' USING ERRCODE = '22023';
  END IF;

  -- Validar categoría si la competición tiene categorías configuradas
  IF array_length(v_competition.categories, 1) > 0 THEN
    IF p_category IS NULL OR NOT (p_category = ANY(v_competition.categories)) THEN
      RAISE EXCEPTION 'Categoría inválida. Opciones: %', array_to_string(v_competition.categories, ', ') USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Verificar max_registrations y waitlist
  IF v_competition.max_registrations IS NOT NULL THEN
    SELECT count(*) INTO v_current_count
      FROM public.competition_registrations
      WHERE competition_id = v_competition.id
        AND cancelled_at IS NULL
        AND waitlisted = false;

    IF v_current_count >= v_competition.max_registrations THEN
      IF v_competition.waitlist_enabled THEN
        v_waitlist := true;
      ELSE
        RAISE EXCEPTION 'Competición llena. Inscripciones cerradas.' USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;

  -- Insert registration
  INSERT INTO public.competition_registrations (
    competition_id, gym_id,
    external_first_name, external_last_name, external_email, external_phone,
    category, waitlisted,
    amount_cents, notes
  )
  VALUES (
    v_competition.id, p_gym_id,
    p_first_name, p_last_name, p_email, p_phone,
    p_category, v_waitlist,
    v_competition.price_cents, p_notes
  )
  RETURNING * INTO v_registration;

  RETURN v_registration;
END;
$fn$;

REVOKE ALL ON FUNCTION public.register_for_competition_public(text, uuid, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_for_competition_public(text, uuid, text, text, text, text, text, text) TO anon, authenticated;

COMMENT ON FUNCTION public.register_for_competition_public IS
  'Inscripción pública (form /c/{slug} sin auth). SECURITY DEFINER bypasea RLS controladamente. Valida slug + fechas + capacity + waitlist.';

-- ============================================================================
-- RPC list_competition_registrations (staff lee lista)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_competition_registrations(p_competition_id uuid)
RETURNS setof public.competition_registrations
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $fn$
  SELECT r.*
  FROM public.competition_registrations r
  WHERE r.competition_id = p_competition_id
  ORDER BY r.registered_at DESC;
  -- RLS filtra por gym
$fn$;

REVOKE ALL ON FUNCTION public.list_competition_registrations(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_competition_registrations(uuid) TO authenticated;
