-- =============================================================================
-- 0052 — PD Sprint nocturno 24-abr: bloqueos de huecos del instructor
--
-- Contexto: botón "Bloquear huecos" en /citas permite a staff marcar que un
-- instructor NO está disponible en un rango horario (vacaciones, enfermedad,
-- uso personal, otro). Evita doble-booking vía anti-solape en
-- create_appointment/reschedule_appointment y aparece en el panel derecho del
-- modal Nueva cita SPLIT como fila "block".
--
-- Decisiones:
--   - Motivo tipado enum {vacation, sick, personal, other} con campo opcional
--     description libre.
--   - Recurrencia: campo recurrence_rule TEXT (RRULE iCal) NULL por defecto.
--     Implementación UI hoy: solo bloque único. La recurrencia queda como
--     campo preparado para sprint Q2 (expansión en cliente con rrule.js).
--   - RLS: staff del gym lee/escribe. Socios NO ven los bloqueos.
--   - get_instructor_availability se re-crea (CREATE OR REPLACE) para incluir
--     los bloques como fuente 'block' en el UNION ALL.
--   - create_appointment y reschedule_appointment se re-crean añadiendo check
--     de solape contra instructor_blocks.
-- =============================================================================

-- ============================================================================
-- 1. ENUM motivo
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.instructor_block_reason AS ENUM (
    'vacation',   -- vacaciones
    'sick',       -- enfermedad
    'personal',   -- tiempo personal / hueco privado
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2. Tabla instructor_blocks
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.instructor_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,

  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,

  reason public.instructor_block_reason NOT NULL DEFAULT 'other',
  description text CHECK (description IS NULL OR length(description) <= 500),

  -- Recurrencia opcional (RRULE iCal 5545, expandida client-side con rrule.js)
  -- Hoy NULL en 100% de los casos; preparado para sprint Q2.
  recurrence_rule text,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT instructor_blocks_timerange CHECK (ends_at > starts_at),
  CONSTRAINT instructor_blocks_duration_max CHECK (
    EXTRACT(EPOCH FROM (ends_at - starts_at)) <= 90 * 24 * 3600  -- máx 90 días (vacaciones largas)
  )
);

CREATE INDEX IF NOT EXISTS idx_instructor_blocks_instructor_starts
  ON public.instructor_blocks(instructor_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_instructor_blocks_gym
  ON public.instructor_blocks(gym_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_instructor_blocks_range_gist
  ON public.instructor_blocks USING GIST (
    instructor_id,
    tstzrange(starts_at, ends_at, '[)')
  );

COMMENT ON TABLE public.instructor_blocks IS
  'Bloqueos de huecos de instructores (vacaciones, enfermedad, personal). Se considera en anti-solape de citas y se muestra en panel disponibilidad del modal Nueva cita.';
COMMENT ON COLUMN public.instructor_blocks.recurrence_rule IS
  'RRULE iCal 5545. NULL = bloque único. Expansión client-side con rrule.js (sprint Q2).';

-- ============================================================================
-- 3. RLS
-- ============================================================================

ALTER TABLE public.instructor_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instructor_blocks_select_staff"
  ON public.instructor_blocks FOR SELECT TO authenticated
  USING (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer', 'staff')
  ));

CREATE POLICY "instructor_blocks_insert_staff"
  ON public.instructor_blocks FOR INSERT TO authenticated
  WITH CHECK (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
  ));

CREATE POLICY "instructor_blocks_update_staff"
  ON public.instructor_blocks FOR UPDATE TO authenticated
  USING (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
  ))
  WITH CHECK (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
  ));

CREATE POLICY "instructor_blocks_delete_staff"
  ON public.instructor_blocks FOR DELETE TO authenticated
  USING (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_blocks TO authenticated;

-- ============================================================================
-- 4. RPC create_instructor_block
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_instructor_block(
  p_instructor_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason public.instructor_block_reason DEFAULT 'other',
  p_description text DEFAULT NULL,
  p_recurrence_rule text DEFAULT NULL
)
RETURNS public.instructor_blocks
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_gym_id uuid;
  v_block public.instructor_blocks;
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
    WHERE user_id = auth.uid() AND gym_id = v_gym_id AND role IN ('owner', 'admin', 'trainer')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso' USING ERRCODE = '42501';
  END IF;

  IF p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'ends_at debe ser posterior a starts_at' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.instructor_blocks (
    gym_id, instructor_id, starts_at, ends_at, reason, description, recurrence_rule, created_by
  )
  VALUES (
    v_gym_id, p_instructor_id, p_starts_at, p_ends_at, p_reason, p_description, p_recurrence_rule, auth.uid()
  )
  RETURNING * INTO v_block;

  RETURN v_block;
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_instructor_block(uuid, timestamptz, timestamptz, public.instructor_block_reason, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_instructor_block(uuid, timestamptz, timestamptz, public.instructor_block_reason, text, text) TO authenticated;

-- ============================================================================
-- 5. RPC delete_instructor_block
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_instructor_block(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_gym_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE = '28000';
  END IF;

  SELECT gym_id INTO v_gym_id FROM public.instructor_blocks WHERE id = p_id;
  IF v_gym_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE user_id = auth.uid() AND gym_id = v_gym_id AND role IN ('owner', 'admin', 'trainer')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.instructor_blocks WHERE id = p_id;
  RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.delete_instructor_block(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_instructor_block(uuid) TO authenticated;

-- ============================================================================
-- 6. RPC list_instructor_blocks_in_range
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_instructor_blocks_in_range(
  p_gym_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_instructor_id uuid DEFAULT NULL
)
RETURNS setof public.instructor_blocks
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
  SELECT b.*
  FROM public.instructor_blocks b
  WHERE b.gym_id = p_gym_id
    AND tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_from, p_to, '[)')
    AND (p_instructor_id IS NULL OR b.instructor_id = p_instructor_id)
  ORDER BY b.starts_at ASC;
$fn$;

REVOKE ALL ON FUNCTION public.list_instructor_blocks_in_range(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_instructor_blocks_in_range(uuid, timestamptz, timestamptz, uuid) TO authenticated;

-- ============================================================================
-- 7. REPLACE get_instructor_availability para incluir blocks
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_instructor_availability(
  p_instructor_id uuid,
  p_gym_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE(
  source text,
  ref_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  label text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE user_id = auth.uid() AND gym_id = p_gym_id
  ) THEN
    RAISE EXCEPTION 'No tienes permiso' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.instructors WHERE id = p_instructor_id AND gym_id = p_gym_id
  ) THEN
    RAISE EXCEPTION 'instructor no pertenece al gym' USING ERRCODE = '22023';
  END IF;

  IF p_to <= p_from THEN
    RAISE EXCEPTION 'rango inválido' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
    -- 1:1 appointments
    SELECT
      'appointment'::text AS source,
      a.id AS ref_id,
      a.starts_at,
      a.ends_at,
      COALESCE(
        (SELECT (m.first_name || ' ' || m.last_name) FROM public.members m WHERE m.id = a.member_id),
        '(socio)'
      ) AS label
    FROM public.appointments a
    WHERE a.instructor_id = p_instructor_id
      AND a.gym_id = p_gym_id
      AND a.status = 'scheduled'
      AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_from, p_to, '[)')

    UNION ALL

    SELECT
      'class'::text AS source,
      ci.id AS ref_id,
      ci.start_at AS starts_at,
      ci.end_at AS ends_at,
      COALESCE(c.name, 'Clase grupal') AS label
    FROM public.class_instances ci
    JOIN public.classes c ON c.id = ci.class_id
    WHERE ci.instructor_id = p_instructor_id
      AND ci.gym_id = p_gym_id
      AND ci.status = 'scheduled'
      AND tstzrange(ci.start_at, ci.end_at, '[)') && tstzrange(p_from, p_to, '[)')

    UNION ALL

    SELECT
      'block'::text AS source,
      b.id AS ref_id,
      b.starts_at,
      b.ends_at,
      CASE b.reason
        WHEN 'vacation' THEN 'Vacaciones'
        WHEN 'sick' THEN 'Enfermedad'
        WHEN 'personal' THEN 'Tiempo personal'
        ELSE COALESCE(b.description, 'Bloqueado')
      END AS label
    FROM public.instructor_blocks b
    WHERE b.instructor_id = p_instructor_id
      AND b.gym_id = p_gym_id
      AND tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_from, p_to, '[)')

    ORDER BY starts_at;
END;
$fn$;

-- ============================================================================
-- 8. REPLACE create_appointment para considerar instructor_blocks
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_appointment(
  p_member_id uuid,
  p_instructor_id uuid,
  p_room_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_appointment_type public.appointment_type DEFAULT 'personal_training',
  p_title text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_price_cents integer DEFAULT NULL
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_gym_id uuid;
  v_appointment public.appointments;
  v_has_rooms boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE = '28000';
  END IF;

  SELECT gym_id INTO v_gym_id FROM public.members WHERE id = p_member_id;
  IF v_gym_id IS NULL THEN
    RAISE EXCEPTION 'member % no existe', p_member_id USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE user_id = auth.uid() AND gym_id = v_gym_id AND role IN ('owner', 'admin', 'trainer')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para crear citas en este gym' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.instructors WHERE id = p_instructor_id AND gym_id = v_gym_id) THEN
    RAISE EXCEPTION 'instructor no pertenece al gym del socio' USING ERRCODE = '22023';
  END IF;

  IF p_room_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.gym_rooms WHERE id = p_room_id AND gym_id = v_gym_id) THEN
      RAISE EXCEPTION 'sala no pertenece al gym' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'ends_at debe ser posterior a starts_at' USING ERRCODE = '22023';
  END IF;

  -- Anti-solape INSTRUCTOR con otras citas
  IF EXISTS (
    SELECT 1 FROM public.appointments
    WHERE instructor_id = p_instructor_id
      AND status = 'scheduled'
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'el instructor tiene otra cita solapada en ese horario'
      USING ERRCODE = '23505',
            HINT = 'Elige otro instructor, otra franja horaria, o cancela la cita solapada.';
  END IF;

  -- Anti-solape INSTRUCTOR con bloqueos (vacaciones/enfermedad/personal)
  IF EXISTS (
    SELECT 1 FROM public.instructor_blocks
    WHERE instructor_id = p_instructor_id
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'el instructor tiene un bloqueo en ese horario'
      USING ERRCODE = '23505',
            HINT = 'Revisa los bloqueos del instructor (vacaciones/enfermedad/tiempo personal).';
  END IF;

  -- Anti-solape SALA
  IF p_room_id IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.gym_rooms WHERE gym_id = v_gym_id AND is_active = true)
      INTO v_has_rooms;

    IF v_has_rooms THEN
      IF EXISTS (
        SELECT 1 FROM public.appointments
        WHERE room_id = p_room_id
          AND status = 'scheduled'
          AND tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
      ) THEN
        RAISE EXCEPTION 'la sala tiene otra cita solapada en ese horario'
          USING ERRCODE = '23505';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.appointments (
    gym_id, member_id, instructor_id, room_id,
    appointment_type, title, starts_at, ends_at,
    notes, price_cents, created_by
  )
  VALUES (
    v_gym_id, p_member_id, p_instructor_id, p_room_id,
    p_appointment_type, p_title, p_starts_at, p_ends_at,
    p_notes, p_price_cents, auth.uid()
  )
  RETURNING * INTO v_appointment;

  RETURN v_appointment;
END;
$fn$;

-- ============================================================================
-- 9. REPLACE reschedule_appointment para considerar blocks
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reschedule_appointment(
  p_id uuid,
  p_new_starts_at timestamptz,
  p_new_ends_at timestamptz
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_appointment public.appointments;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_appointment FROM public.appointments WHERE id = p_id;
  IF v_appointment IS NULL THEN
    RAISE EXCEPTION 'cita no existe' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE user_id = auth.uid() AND gym_id = v_appointment.gym_id AND role IN ('owner', 'admin', 'trainer')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso' USING ERRCODE = '42501';
  END IF;

  IF v_appointment.status <> 'scheduled' THEN
    RAISE EXCEPTION 'Solo se pueden reprogramar citas en estado scheduled (actual: %)', v_appointment.status USING ERRCODE = '42P01';
  END IF;

  IF p_new_ends_at <= p_new_starts_at THEN
    RAISE EXCEPTION 'ends_at > starts_at' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.appointments
    WHERE id <> p_id
      AND instructor_id = v_appointment.instructor_id
      AND status = 'scheduled'
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(p_new_starts_at, p_new_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'instructor tiene solape con otra cita' USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.instructor_blocks
    WHERE instructor_id = v_appointment.instructor_id
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(p_new_starts_at, p_new_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'el instructor tiene un bloqueo en ese horario' USING ERRCODE = '23505';
  END IF;

  IF v_appointment.room_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.appointments
    WHERE id <> p_id
      AND room_id = v_appointment.room_id
      AND status = 'scheduled'
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(p_new_starts_at, p_new_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'sala tiene solape con otra cita' USING ERRCODE = '23505';
  END IF;

  UPDATE public.appointments
    SET starts_at = p_new_starts_at,
        ends_at = p_new_ends_at,
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_appointment;

  RETURN v_appointment;
END;
$fn$;
