-- =============================================================================
-- 0046 — Recurring bookings (reservas/citas automáticas semanales) — PB
--
-- Contexto: F1 audit LegacyGym ficha cliente bloque "Reservas automáticas"
-- (capturas 12-13). Para Demo Studio personal training es CRÍTICO: cliente con
-- horario fijo (ej. todos los lunes 10:00 con Jordan en sala 1) se pre-reserva
-- automáticamente en lugar de crear cada reserva manual.
--
-- Schema:
--   - member_id: socio dueño de la recurrencia
--   - class_id NULL: si recurre sobre clase grupal de la plantilla `classes`
--   - appointment_template (type+instructor+room+duration): si recurre sobre
--     cita 1:1 (no apunta a una appointment concreta — el cron crea instancias)
--   - day_of_week 0-6 (0=domingo, ISO=domingo)
--   - start_time, duration_minutes
--   - starts_on, ends_on (rango validez)
--   - active flag
--
-- Decisión: NO acoplar con appointments hoy. La aplicación de la recurrencia
-- a appointments concretas será un cron job futuro (fuera de scope PB).
-- Esta migración crea el storage + UI; la materialización viene en sprint
-- siguiente.
--
-- Decision #111: UPDATE/DELETE policies explícitas desde día 1.
-- =============================================================================

-- ============================================================================
-- 1. ENUM tipo de recurrencia
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.recurring_booking_type AS ENUM (
    'class',        -- reserva clase grupal recurrente (apunta a classes.id)
    'appointment'   -- cita 1:1 recurrente (sin classes; usa instructor + room + duración)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2. Tabla recurring_bookings
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.recurring_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,

  type public.recurring_booking_type NOT NULL,

  -- Si type='class' → class_id NOT NULL (clase grupal recurrente)
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,

  -- Si type='appointment' → instructor opcional + sala opcional + duración
  instructor_id uuid REFERENCES public.instructors(id) ON DELETE SET NULL,
  room text,
  duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 15 AND 240),

  -- Slot semanal
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,

  -- Rango validez
  starts_on date NOT NULL DEFAULT current_date,
  ends_on date,

  -- Estado
  active boolean NOT NULL DEFAULT true,
  notes text,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Si type=class debe tener class_id; si type=appointment NO
  CONSTRAINT recurring_type_consistency CHECK (
    (type = 'class' AND class_id IS NOT NULL) OR
    (type = 'appointment' AND class_id IS NULL)
  ),
  -- ends_on >= starts_on si está definido
  CONSTRAINT recurring_dates_order CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS idx_recurring_bookings_member
  ON public.recurring_bookings(member_id, active, day_of_week);

CREATE INDEX IF NOT EXISTS idx_recurring_bookings_gym_active
  ON public.recurring_bookings(gym_id, active)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_recurring_bookings_class
  ON public.recurring_bookings(class_id)
  WHERE class_id IS NOT NULL;

COMMENT ON TABLE public.recurring_bookings IS
  'Reservas/citas automáticas semanales. Cron job futuro materializará en bookings/appointments.';

-- ============================================================================
-- 3. RLS policies (Decision #111)
-- ============================================================================

ALTER TABLE public.recurring_bookings ENABLE ROW LEVEL SECURITY;

-- SELECT: staff del gym + socio dueño puede ver las propias
CREATE POLICY "recurring_bookings_select_staff"
  ON public.recurring_bookings FOR SELECT TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
    )
    OR member_id IN (
      SELECT id FROM public.members WHERE auth_user_id = auth.uid()
    )
  );

-- INSERT: solo owner/admin/trainer del gym
CREATE POLICY "recurring_bookings_insert_staff"
  ON public.recurring_bookings FOR INSERT TO authenticated
  WITH CHECK (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
    )
  );

-- UPDATE: owner/admin/trainer del gym
CREATE POLICY "recurring_bookings_update_staff"
  ON public.recurring_bookings FOR UPDATE TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
    )
  )
  WITH CHECK (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
    )
  );

-- DELETE: owner/admin del gym (trainer no borra)
CREATE POLICY "recurring_bookings_delete_admin"
  ON public.recurring_bookings FOR DELETE TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_bookings TO authenticated;

-- ============================================================================
-- 4. Trigger updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.touch_recurring_bookings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_recurring_bookings_updated_at ON public.recurring_bookings;
CREATE TRIGGER trg_recurring_bookings_updated_at
  BEFORE UPDATE ON public.recurring_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_recurring_bookings_updated_at();
