-- =============================================================================
-- 0030 — Módulo /citas 1:1 (Entrenamiento personal + Consultas + Evaluaciones)
--
-- Contexto: gap #2 bloqueante cobro Demo Studio (internal ticket, deadline 1-mayo).
-- Demo Studio es boutique EP con 3 instructores (Alex, Sam, Jordan).
-- LegacyGym tiene módulo equivalente `/meetings` — auditoría V3 §9.
--
-- Decisiones arquitectónicas (spec SPEC_CITAS_1_1.md):
--   - Tabla nueva `appointments` (NO extender `bookings` que obliga a
--     class_instance_id NOT NULL)
--   - Tabla auxiliar `gym_rooms` para asignar cita → sala
--   - RLS staff puede CRUD sus citas + socio SELECT solo las propias
--   - Decision #111: UPDATE policy explícita desde día 1
--   - Decision #102: columna payment_id NULLABLE desde día 1 para evitar
--     refactor cuando se integre Stripe (no implementado en PR #39)
--   - Anti-solape: instructor siempre. Sala solo si hay rows en gym_rooms.
--   - Duración default 60 min (hardcoded en UI; TODO config per-gym)
--   - no_show NO consume sesión por defecto (TODO config per-gym)
--   - Cancelación socio: ≥ gym_settings.appointment_cancel_hours antes (default 24h)
--
-- pgTAP asociado: supabase/tests/rls_appointments.sql (6 assertions)
-- =============================================================================

-- ============================================================================
-- 1. ENUMs
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.appointment_type AS ENUM (
    'personal_training', -- entrenamiento personal 1h/30min (core Demo Studio)
    'consultation',      -- consulta inicial, evaluación goals
    'assessment',        -- medición corporal, test físico, fotos evolución
    'nutrition',         -- sesión nutricional
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.appointment_status AS ENUM (
    'scheduled',
    'completed',
    'cancelled',
    'no_show'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2. gym_settings: añadir appointment_cancel_hours
-- ============================================================================

ALTER TABLE public.gym_settings
  ADD COLUMN IF NOT EXISTS appointment_cancel_hours integer NOT NULL DEFAULT 24
    CHECK (appointment_cancel_hours BETWEEN 0 AND 168);

COMMENT ON COLUMN public.gym_settings.appointment_cancel_hours IS
  'Horas mínimas de antelación para que un socio pueda cancelar su propia cita. Staff puede cancelar siempre. Default 24h (configurable per-gym).';

-- ============================================================================
-- 3. Tabla gym_rooms (salas de entreno — auxiliar)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.gym_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  color text, -- para renderizado UI calendar
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gym_id, name)
);

CREATE INDEX IF NOT EXISTS idx_gym_rooms_gym_active ON public.gym_rooms(gym_id)
  WHERE is_active = true;

COMMENT ON TABLE public.gym_rooms IS
  'Salas de entreno del gym. Opcional — gym sin salas (Demo Studio boutique sin salas diferenciadas) funciona con appointments.room_id = NULL.';

-- ============================================================================
-- 4. Tabla appointments (citas 1:1)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES public.instructors(id) ON DELETE RESTRICT,
  room_id uuid REFERENCES public.gym_rooms(id) ON DELETE SET NULL,

  appointment_type public.appointment_type NOT NULL DEFAULT 'personal_training',
  title text CHECK (title IS NULL OR length(title) <= 120),

  -- Timestamps siempre TIMESTAMPTZ (UTC) — nunca local time
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  duration_minutes integer GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (ends_at - starts_at))::integer / 60
  ) STORED,

  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  cancellation_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  notes text,
  price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),

  -- Consume 1 sesión del bono del socio al completarse (si aplica).
  -- Config TODO per-gym: no_show NO consume por ahora (hardcoded default false).
  consumed_session boolean NOT NULL DEFAULT false,

  -- Decision #102: schema Stripe-ready desde día 1 para evitar refactor.
  -- payment_id NULL en PR #39. Integración Stripe en PR futuro (Fase 1D).
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Validaciones
  CONSTRAINT appointments_timerange CHECK (ends_at > starts_at),
  CONSTRAINT appointments_duration_valid CHECK (
    EXTRACT(EPOCH FROM (ends_at - starts_at)) BETWEEN 15*60 AND 240*60  -- 15 min a 4 horas
  ),
  CONSTRAINT appointments_cancelled_consistency CHECK (
    (status = 'cancelled' AND cancelled_at IS NOT NULL) OR
    (status <> 'cancelled' AND cancelled_at IS NULL)
  )
);

-- Índices multi-tenant + queries comunes
CREATE INDEX IF NOT EXISTS idx_appointments_gym_starts
  ON public.appointments(gym_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_member
  ON public.appointments(member_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_instructor_date
  ON public.appointments(instructor_id, starts_at)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_appointments_room
  ON public.appointments(room_id, starts_at)
  WHERE status = 'scheduled' AND room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_payment
  ON public.appointments(payment_id)
  WHERE payment_id IS NOT NULL;

COMMENT ON TABLE public.appointments IS
  'Citas individuales 1:1 (EP, consulta, evaluación, nutrición). Separada de bookings (clases grupales).';
COMMENT ON COLUMN public.appointments.consumed_session IS
  'Si socio tiene bono de sesiones activo, marcar true al completar consume 1 sesión de member_tariffs.sessions_remaining.';
COMMENT ON COLUMN public.appointments.payment_id IS
  'Decision #102: NULL hoy. Integración Stripe en PR futuro sin refactor.';
COMMENT ON COLUMN public.appointments.duration_minutes IS
  'Generado a partir de ends_at - starts_at. Default UI = 60 min (hardcoded, TODO config per-gym).';

-- ============================================================================
-- 5. RLS policies (Decision #111: UPDATE explícita desde día 1)
-- ============================================================================

ALTER TABLE public.gym_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- gym_rooms: staff del gym ve; solo owner/admin muta
CREATE POLICY "rooms_select_own_gym"
  ON public.gym_rooms FOR SELECT TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.gym_users WHERE user_id = auth.uid()));

CREATE POLICY "rooms_insert_admin"
  ON public.gym_rooms FOR INSERT TO authenticated
  WITH CHECK (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "rooms_update_admin"
  ON public.gym_rooms FOR UPDATE TO authenticated
  USING (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ))
  WITH CHECK (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "rooms_delete_admin"
  ON public.gym_rooms FOR DELETE TO authenticated
  USING (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- appointments: staff ve todas del gym; socio ve solo las suyas
CREATE POLICY "appointments_select_staff"
  ON public.appointments FOR SELECT TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.gym_users WHERE user_id = auth.uid()));

CREATE POLICY "appointments_select_member_own"
  ON public.appointments FOR SELECT TO authenticated
  USING (
    member_id IN (
      SELECT id FROM public.members WHERE auth_user_id = auth.uid()
    )
  );

-- INSERT: staff (owner/admin/trainer) del gym
CREATE POLICY "appointments_insert_staff"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
  ));

-- UPDATE: staff puede modificar (status change, reschedule, cancel)
-- Decision #111 obligatoria: policy UPDATE explícita desde día 1
CREATE POLICY "appointments_update_staff"
  ON public.appointments FOR UPDATE TO authenticated
  USING (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
  ))
  WITH CHECK (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
  ));

-- UPDATE socio: solo puede cancelar su propia cita ≥appointment_cancel_hours antes
-- Esto se enforced en RPC cancel_appointment_by_member (no policy directa, evita
-- complejidad en policy con time calculations).
-- Socio NO tiene UPDATE directo — todo via RPCs.

-- DELETE: solo admin/owner (staff no; soft-delete via status='cancelled' preferido)
CREATE POLICY "appointments_delete_admin"
  ON public.appointments FOR DELETE TO authenticated
  USING (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- ============================================================================
-- 6. RPC create_appointment (staff)
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

  -- Derivar gym_id del socio
  SELECT gym_id INTO v_gym_id FROM public.members WHERE id = p_member_id;
  IF v_gym_id IS NULL THEN
    RAISE EXCEPTION 'member % no existe', p_member_id USING ERRCODE = '22023';
  END IF;

  -- Validar: user es staff de este gym con permisos
  IF NOT EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE user_id = auth.uid() AND gym_id = v_gym_id AND role IN ('owner', 'admin', 'trainer')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para crear citas en este gym' USING ERRCODE = '42501';
  END IF;

  -- Validar consistencia instructor/sala con gym
  IF NOT EXISTS (SELECT 1 FROM public.instructors WHERE id = p_instructor_id AND gym_id = v_gym_id) THEN
    RAISE EXCEPTION 'instructor no pertenece al gym del socio' USING ERRCODE = '22023';
  END IF;

  IF p_room_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.gym_rooms WHERE id = p_room_id AND gym_id = v_gym_id) THEN
      RAISE EXCEPTION 'sala no pertenece al gym' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Validar rango horario básico
  IF p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'ends_at debe ser posterior a starts_at' USING ERRCODE = '22023';
  END IF;

  -- Anti-solape INSTRUCTOR (siempre aplica)
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

  -- Anti-solape SALA (solo si gym tiene salas activas — matiz PO)
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

  -- INSERT
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

REVOKE ALL ON FUNCTION public.create_appointment(uuid, uuid, uuid, timestamptz, timestamptz, public.appointment_type, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_appointment(uuid, uuid, uuid, timestamptz, timestamptz, public.appointment_type, text, text, integer) TO authenticated;

-- ============================================================================
-- 7. RPC list_appointments_in_range
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_appointments_in_range(
  p_gym_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_instructor_id uuid DEFAULT NULL
)
RETURNS setof public.appointments
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
  SELECT a.*
  FROM public.appointments a
  WHERE a.gym_id = p_gym_id
    AND a.starts_at >= p_from
    AND a.starts_at < p_to
    AND (p_instructor_id IS NULL OR a.instructor_id = p_instructor_id)
  ORDER BY a.starts_at ASC;
  -- RLS SELECT filtra si el caller no es staff del gym
$fn$;

REVOKE ALL ON FUNCTION public.list_appointments_in_range(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_appointments_in_range(uuid, timestamptz, timestamptz, uuid) TO authenticated;

-- ============================================================================
-- 8. RPC cancel_appointment (staff)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_appointment(
  p_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_appointment public.appointments;
  v_gym_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_appointment FROM public.appointments WHERE id = p_id;
  IF v_appointment IS NULL THEN
    RAISE EXCEPTION 'cita no existe o no tienes permiso' USING ERRCODE = '22023';
  END IF;

  v_gym_id := v_appointment.gym_id;

  -- Guard staff
  IF NOT EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE user_id = auth.uid() AND gym_id = v_gym_id AND role IN ('owner', 'admin', 'trainer')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para cancelar' USING ERRCODE = '42501';
  END IF;

  -- Idempotente: si ya está cancelled, devolver tal cual
  IF v_appointment.status = 'cancelled' THEN
    RETURN v_appointment;
  END IF;

  UPDATE public.appointments
    SET status = 'cancelled',
        cancellation_reason = p_reason,
        cancelled_at = now(),
        cancelled_by = auth.uid(),
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_appointment;

  RETURN v_appointment;
END;
$fn$;

REVOKE ALL ON FUNCTION public.cancel_appointment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_appointment(uuid, text) TO authenticated;

-- ============================================================================
-- 9. RPC cancel_appointment_by_member (socio cancela su propia cita ≥ N horas antes)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_appointment_by_member(
  p_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_appointment public.appointments;
  v_member_id uuid;
  v_cancel_hours integer;
  v_hours_until_cita numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE = '28000';
  END IF;

  -- Member del usuario
  SELECT id INTO v_member_id FROM public.members WHERE auth_user_id = auth.uid();
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'No eres un socio de ningún gym' USING ERRCODE = '42501';
  END IF;

  -- Validar que la cita es suya
  SELECT * INTO v_appointment
    FROM public.appointments
    WHERE id = p_id AND member_id = v_member_id;
  IF v_appointment IS NULL THEN
    RAISE EXCEPTION 'cita no encontrada o no es tuya' USING ERRCODE = '22023';
  END IF;

  -- Ventana de cancelación (default 24h, leer de gym_settings)
  SELECT appointment_cancel_hours INTO v_cancel_hours
    FROM public.gym_settings
    WHERE gym_id = v_appointment.gym_id;
  v_cancel_hours := COALESCE(v_cancel_hours, 24);

  v_hours_until_cita := EXTRACT(EPOCH FROM (v_appointment.starts_at - now())) / 3600;

  IF v_hours_until_cita < v_cancel_hours THEN
    RAISE EXCEPTION 'Cancelación bloqueada: menos de % horas antes de la cita. Contacta con el gym.',
      v_cancel_hours USING ERRCODE = '42501';
  END IF;

  IF v_appointment.status = 'cancelled' THEN
    RETURN v_appointment;
  END IF;

  UPDATE public.appointments
    SET status = 'cancelled',
        cancellation_reason = COALESCE(p_reason, 'Cancelada por el socio'),
        cancelled_at = now(),
        cancelled_by = auth.uid(),
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_appointment;

  RETURN v_appointment;
END;
$fn$;

REVOKE ALL ON FUNCTION public.cancel_appointment_by_member(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_by_member(uuid, text) TO authenticated;

-- ============================================================================
-- 10. RPC reschedule_appointment (staff)
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

  -- Guard staff
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

  -- Anti-solape instructor (excluyendo la cita misma)
  IF EXISTS (
    SELECT 1 FROM public.appointments
    WHERE id <> p_id
      AND instructor_id = v_appointment.instructor_id
      AND status = 'scheduled'
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(p_new_starts_at, p_new_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'instructor tiene solape con otra cita' USING ERRCODE = '23505';
  END IF;

  -- Anti-solape sala (si aplica)
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

REVOKE ALL ON FUNCTION public.reschedule_appointment(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment(uuid, timestamptz, timestamptz) TO authenticated;

-- ============================================================================
-- 11. RPC complete_appointment (staff marca asistencia + opcionalmente consume sesión)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_appointment(
  p_id uuid,
  p_consume_session boolean DEFAULT false
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_appointment public.appointments;
  v_active_tariff uuid;
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
    RAISE EXCEPTION 'Solo se pueden completar citas scheduled (actual: %)', v_appointment.status USING ERRCODE = '42P01';
  END IF;

  -- Consumo sesión opcional
  IF p_consume_session THEN
    SELECT id INTO v_active_tariff
      FROM public.member_tariffs
      WHERE member_id = v_appointment.member_id
        AND is_active = true
        AND (sessions_remaining IS NULL OR sessions_remaining > 0)
      ORDER BY start_date DESC
      LIMIT 1;

    IF v_active_tariff IS NOT NULL THEN
      UPDATE public.member_tariffs
        SET sessions_used = sessions_used + 1,
            sessions_remaining = CASE
              WHEN sessions_remaining IS NULL THEN NULL
              ELSE sessions_remaining - 1
            END
        WHERE id = v_active_tariff;
    END IF;
  END IF;

  UPDATE public.appointments
    SET status = 'completed',
        consumed_session = p_consume_session,
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_appointment;

  RETURN v_appointment;
END;
$fn$;

REVOKE ALL ON FUNCTION public.complete_appointment(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_appointment(uuid, boolean) TO authenticated;

-- ============================================================================
-- 12. RPC mark_no_show_appointment (staff)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_no_show_appointment(
  p_id uuid
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
    RAISE EXCEPTION 'Solo se pueden marcar no-show citas scheduled (actual: %)', v_appointment.status USING ERRCODE = '42P01';
  END IF;

  -- no_show NO consume sesión por defecto (matiz PO, TODO config per-gym)
  UPDATE public.appointments
    SET status = 'no_show',
        consumed_session = false,
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_appointment;

  RETURN v_appointment;
END;
$fn$;

REVOKE ALL ON FUNCTION public.mark_no_show_appointment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_no_show_appointment(uuid) TO authenticated;

-- ============================================================================
-- 13. Grants tabla
-- ============================================================================

GRANT SELECT ON public.gym_rooms TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gym_rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
