-- =============================================================================
-- 0051 — PD Sprint nocturno 24-abr: disponibilidad instructor + índice overlap
--
-- Contexto: Panel-D split modal Nueva cita. Al elegir instructor + fecha,
-- el panel derecho muestra timeline del día con huecos ocupados (citas
-- previas + clases grupales donde el instructor imparte + bloques de
-- vacaciones). Rendimiento crítico: query se dispara en cada cambio de
-- fecha/instructor, debe ser <50ms.
--
-- Decisiones:
--   - Índice GIST sobre tstzrange(starts_at, ends_at) para appointments:
--     acelera `&&` overlap operator usado en create_appointment y
--     reschedule_appointment (migración 0030).
--   - RPC `get_instructor_availability(instructor_id, gym_id, from, to)`:
--     retorna rangos ocupados del instructor en la ventana dada.
--     Merge de 3 fuentes: appointments scheduled + class_instances donde
--     el instructor imparte + (post-0052) instructor_blocks.
--     Esta 0051 cubre appointments + classes. 0052 añade blocks.
--   - Helper `appointments_occupied_range` generated column (IMMUTABLE)
--     no es viable por restricciones tstzrange en STORED columns;
--     usamos índice funcional en su lugar.
-- =============================================================================

-- ============================================================================
-- 1. Extensión btree_gist (necesaria para índices GIST combinando uuid + range)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================================
-- 2. Índice GIST para overlap queries rápidas
-- ============================================================================

-- appointments: overlap por instructor (más frecuente)
CREATE INDEX IF NOT EXISTS idx_appointments_instructor_range_gist
  ON public.appointments USING GIST (
    instructor_id,
    tstzrange(starts_at, ends_at, '[)')
  )
  WHERE status = 'scheduled';

-- appointments: overlap por sala (menos frecuente pero también en create/reschedule)
CREATE INDEX IF NOT EXISTS idx_appointments_room_range_gist
  ON public.appointments USING GIST (
    room_id,
    tstzrange(starts_at, ends_at, '[)')
  )
  WHERE status = 'scheduled' AND room_id IS NOT NULL;

COMMENT ON INDEX public.idx_appointments_instructor_range_gist IS
  'Índice GIST para anti-solape instructor (operador && tstzrange). Acelera create_appointment y reschedule_appointment.';

-- ============================================================================
-- 3. RPC get_instructor_availability
-- ============================================================================
-- Retorna todos los rangos ocupados de un instructor en una ventana [from, to).
-- La UI renderiza estos bloques sobre un timeline y los huecos libres son
-- visualmente el complemento.
-- Fuentes agregadas:
--   * appointments scheduled (1:1)
--   * class_instances donde el instructor imparte (clases grupales)
--   * (instructor_blocks se añadirá en 0052 via REPLACE de esta función)

CREATE OR REPLACE FUNCTION public.get_instructor_availability(
  p_instructor_id uuid,
  p_gym_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE(
  source text,            -- 'appointment' | 'class' | 'block'
  ref_id uuid,            -- appointment.id / class_instance.id / block.id
  starts_at timestamptz,
  ends_at timestamptz,
  label text              -- member name / class name / motivo
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
BEGIN
  -- Guard auth + gym membership
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

    -- Group class instances donde el instructor imparte
    -- (class_instances usa columnas start_at/end_at — ver migración 0001)
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

    ORDER BY starts_at;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_instructor_availability(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_instructor_availability(uuid, uuid, timestamptz, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.get_instructor_availability IS
  'Devuelve rangos ocupados del instructor en [from, to). Fuentes: appointments 1:1 + class_instances (+ instructor_blocks tras migración 0052). Usado por el panel derecho del modal Nueva cita SPLIT.';
