-- =============================================================================
-- 0053 — PD Sprint nocturno 24-abr: múltiples agendas de citas
--
-- Contexto: actual appointment_type enum (5 valores fijos) no encaja con
-- Demo Studio que en LegacyGym ya tiene 2 agendas configuradas (Personal 1h,
-- Personal 30min). Crear tabla agendas configurable por gym.
--
-- Decisiones:
--   - Tabla `agendas` por gym. Cada agenda: nombre, duración default,
--     default_instructor_id (opcional), color, active, capacity (default 1),
--     requires_payment_upfront (bool).
--   - `appointments.agenda_id` NULLABLE FK (convivencia con enum legacy
--     appointment_type). Migración NO convierte enum → agenda_id automática;
--     las citas existentes mantienen appointment_type.
--   - Seed automático por gym en trigger tras primera creación: no. Se hace
--     bajo demanda vía RPC `seed_default_agendas_for_gym`.
--   - Admin CRUD desde /clases-tarifas tab Agendas.
--   - Precarga Demo Studio: insert dirigido para gym slug 'demo-studio' si
--     existe (safe guard).
-- =============================================================================

-- ============================================================================
-- 1. Tabla agendas
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,

  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  description text CHECK (description IS NULL OR length(description) <= 500),

  duration_minutes integer NOT NULL DEFAULT 60
    CHECK (duration_minutes BETWEEN 15 AND 240),

  default_instructor_id uuid REFERENCES public.instructors(id) ON DELETE SET NULL,

  color text NOT NULL DEFAULT '#3b8bea'
    CHECK (color ~ '^#[0-9a-fA-F]{6}$'),

  active boolean NOT NULL DEFAULT true,

  -- Capacidad: 1 (cita 1:1) por defecto. Futuro: agendas grupales reducidas.
  capacity integer NOT NULL DEFAULT 1
    CHECK (capacity BETWEEN 1 AND 20),

  -- Pago requerido por anticipado (UX comercial, no enforced hoy)
  requires_payment_upfront boolean NOT NULL DEFAULT false,

  sort_order integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (gym_id, name)
);

CREATE INDEX IF NOT EXISTS idx_agendas_gym_active ON public.agendas(gym_id)
  WHERE active = true;

COMMENT ON TABLE public.agendas IS
  'Agendas de citas configurables por gym. Reemplaza conceptualmente al enum hardcoded appointment_type. Cada agenda define duración default, instructor default y color.';
COMMENT ON COLUMN public.agendas.capacity IS
  'Default 1 = cita 1:1. Reservado para futuras agendas grupales reducidas (ej: clase 4 personas).';

-- ============================================================================
-- 2. appointments.agenda_id (nullable, convivencia con enum legacy)
-- ============================================================================

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS agenda_id uuid REFERENCES public.agendas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_agenda
  ON public.appointments(agenda_id, starts_at)
  WHERE agenda_id IS NOT NULL AND status = 'scheduled';

COMMENT ON COLUMN public.appointments.agenda_id IS
  'FK a agendas. NULL = cita legacy sin agenda (pre-0053). UI nueva obliga a seleccionar agenda al crear cita.';

-- ============================================================================
-- 3. RLS agendas
-- ============================================================================

ALTER TABLE public.agendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agendas_select_gym"
  ON public.agendas FOR SELECT TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.gym_users WHERE user_id = auth.uid()));

CREATE POLICY "agendas_insert_admin"
  ON public.agendas FOR INSERT TO authenticated
  WITH CHECK (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "agendas_update_admin"
  ON public.agendas FOR UPDATE TO authenticated
  USING (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ))
  WITH CHECK (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "agendas_delete_admin"
  ON public.agendas FOR DELETE TO authenticated
  USING (gym_id IN (
    SELECT gym_id FROM public.gym_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendas TO authenticated;

-- ============================================================================
-- 4. RPC list_agendas
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_agendas(p_gym_id uuid, p_only_active boolean DEFAULT false)
RETURNS setof public.agendas
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
  SELECT a.*
  FROM public.agendas a
  WHERE a.gym_id = p_gym_id
    AND (NOT p_only_active OR a.active = true)
  ORDER BY a.sort_order ASC, a.name ASC;
$fn$;

REVOKE ALL ON FUNCTION public.list_agendas(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_agendas(uuid, boolean) TO authenticated;

-- ============================================================================
-- 5. RPC upsert_agenda
-- ============================================================================

CREATE OR REPLACE FUNCTION public.upsert_agenda(
  p_id uuid,
  p_gym_id uuid,
  p_name text,
  p_duration_minutes integer,
  p_default_instructor_id uuid DEFAULT NULL,
  p_color text DEFAULT '#3b8bea',
  p_active boolean DEFAULT true,
  p_capacity integer DEFAULT 1,
  p_requires_payment_upfront boolean DEFAULT false,
  p_description text DEFAULT NULL,
  p_sort_order integer DEFAULT 0
)
RETURNS public.agendas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_agenda public.agendas;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE user_id = auth.uid() AND gym_id = p_gym_id AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso' USING ERRCODE = '42501';
  END IF;

  IF p_default_instructor_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.instructors WHERE id = p_default_instructor_id AND gym_id = p_gym_id) THEN
      RAISE EXCEPTION 'instructor no pertenece al gym' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.agendas (
      gym_id, name, description, duration_minutes, default_instructor_id,
      color, active, capacity, requires_payment_upfront, sort_order
    )
    VALUES (
      p_gym_id, p_name, p_description, p_duration_minutes, p_default_instructor_id,
      p_color, p_active, p_capacity, p_requires_payment_upfront, p_sort_order
    )
    RETURNING * INTO v_agenda;
  ELSE
    UPDATE public.agendas SET
      name = p_name,
      description = p_description,
      duration_minutes = p_duration_minutes,
      default_instructor_id = p_default_instructor_id,
      color = p_color,
      active = p_active,
      capacity = p_capacity,
      requires_payment_upfront = p_requires_payment_upfront,
      sort_order = p_sort_order,
      updated_at = now()
    WHERE id = p_id AND gym_id = p_gym_id
    RETURNING * INTO v_agenda;

    IF v_agenda.id IS NULL THEN
      RAISE EXCEPTION 'agenda no existe en este gym' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN v_agenda;
END;
$fn$;

REVOKE ALL ON FUNCTION public.upsert_agenda(uuid, uuid, text, integer, uuid, text, boolean, integer, boolean, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_agenda(uuid, uuid, text, integer, uuid, text, boolean, integer, boolean, text, integer) TO authenticated;

-- ============================================================================
-- 6. RPC delete_agenda
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_agenda(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_gym_id uuid;
  v_in_use boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE = '28000';
  END IF;

  SELECT gym_id INTO v_gym_id FROM public.agendas WHERE id = p_id;
  IF v_gym_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE user_id = auth.uid() AND gym_id = v_gym_id AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso' USING ERRCODE = '42501';
  END IF;

  -- Si hay citas futuras usando esta agenda, soft-delete (active=false)
  SELECT EXISTS (
    SELECT 1 FROM public.appointments
    WHERE agenda_id = p_id
      AND status = 'scheduled'
      AND starts_at >= now()
  ) INTO v_in_use;

  IF v_in_use THEN
    UPDATE public.agendas SET active = false, updated_at = now() WHERE id = p_id;
  ELSE
    DELETE FROM public.agendas WHERE id = p_id;
  END IF;

  RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.delete_agenda(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_agenda(uuid) TO authenticated;

-- ============================================================================
-- 7. Seed Demo Studio (si gym con slug 'demo-studio' existe)
-- ============================================================================

DO $$
DECLARE
  v_gym_id uuid;
BEGIN
  SELECT id INTO v_gym_id FROM public.gyms WHERE slug = 'demo-studio' LIMIT 1;

  IF v_gym_id IS NOT NULL THEN
    INSERT INTO public.agendas (gym_id, name, duration_minutes, color, sort_order)
    VALUES
      (v_gym_id, 'Entrenamiento personal 1h', 60, '#3b8bea', 1),
      (v_gym_id, 'Entrenamiento personal 30 min', 30, '#10b981', 2)
    ON CONFLICT (gym_id, name) DO NOTHING;
  END IF;
END $$;
