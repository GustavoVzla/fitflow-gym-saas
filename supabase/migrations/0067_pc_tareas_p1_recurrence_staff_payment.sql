-- ════════════════════════════════════════════════════════════════════════
-- 0066 — Panel-C · /tareas 4 P1 (audit V5): recurrencia + payment FK + notificación
-- ════════════════════════════════════════════════════════════════════════
-- Cubre los 4 gaps P1 reportados por audit V5 LIVE:
--   P1.1 Asignación a staff: `assigned_to` FK auth.users YA existe (0001), solo UI.
--   P1.2 Vinculación a socio: `member_id` YA existe (0050). Falta `related_payment_id`.
--   P1.3 Recurrencia: NUEVO (recurrence_type, interval, end_date).
--   P1.4 Notificación al asignado: trigger al cambiar assigned_to o al crear con assigned_to.

-- ───────────────────────────────────────────────────────────────────────
-- 1. FK opcional related_payment_id
-- ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS related_payment_id uuid
    REFERENCES public.payments(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tasks.related_payment_id IS
  'Tarea vinculada a un pago concreto (ej: "Llamar al socio por fallo SEPA pago X"). FK payments.';

CREATE INDEX IF NOT EXISTS idx_tasks_related_payment
  ON public.tasks (related_payment_id)
  WHERE related_payment_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────
-- 2. Recurrencia: type + interval + end_date
-- ───────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_recurrence_type') THEN
    CREATE TYPE public.task_recurrence_type AS ENUM ('none', 'daily', 'weekly', 'monthly');
  END IF;
END $$;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_type public.task_recurrence_type NOT NULL DEFAULT 'none';

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_interval integer
    CHECK (recurrence_interval IS NULL OR recurrence_interval BETWEEN 1 AND 365);

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_end_date date;

-- Plantilla / instancia: si esta tarea se generó desde otra recurrente, apunta a la original
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid
    REFERENCES public.tasks(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tasks.recurrence_type IS
  'Tipo de recurrencia: none / daily / weekly / monthly. Default none.';
COMMENT ON COLUMN public.tasks.recurrence_interval IS
  'Cada cuántas unidades repetir (1=cada día/semana/mes, 2=cada 2...). NULL si recurrence_type=none.';
COMMENT ON COLUMN public.tasks.recurrence_end_date IS
  'Fecha hasta la que se generan ocurrencias (NULL = sin fin, generar 52 semanas por defecto).';
COMMENT ON COLUMN public.tasks.recurrence_parent_id IS
  'Apunta a la tarea plantilla si esta fila es una instancia generada.';

CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_parent
  ON public.tasks (recurrence_parent_id)
  WHERE recurrence_parent_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────
-- 3. Trigger: notificación in-app al usuario assigned_to
-- ───────────────────────────────────────────────────────────────────────
-- Dispara en INSERT (si se crea con assigned_to) y en UPDATE (si cambia assigned_to).
-- Inserta una fila en public.notifications para el user target.
-- NO dispara si assigned_to = NEW.created_by (no notificarme a mí mismo).

CREATE OR REPLACE FUNCTION public.tg_tasks_notify_assignee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_should_notify boolean := false;
  v_member_name text;
  v_message text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_should_notify := NEW.assigned_to IS NOT NULL
                       AND NEW.assigned_to IS DISTINCT FROM NEW.created_by;
  ELSIF TG_OP = 'UPDATE' THEN
    v_should_notify := NEW.assigned_to IS NOT NULL
                       AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
                       AND NEW.assigned_to IS DISTINCT FROM NEW.created_by;
  END IF;

  IF NOT v_should_notify THEN
    RETURN NEW;
  END IF;

  -- Enriquecer mensaje con nombre de socio si existe member_id
  IF NEW.member_id IS NOT NULL THEN
    SELECT coalesce(first_name || ' ' || last_name, '')
      INTO v_member_name
    FROM public.members
    WHERE id = NEW.member_id;
  END IF;

  v_message := NEW.title;
  IF v_member_name IS NOT NULL AND length(v_member_name) > 0 THEN
    v_message := v_message || ' — socio: ' || v_member_name;
  END IF;
  IF NEW.due_date IS NOT NULL THEN
    v_message := v_message || ' (vence ' || to_char(NEW.due_date, 'DD/MM') || ')';
  END IF;

  INSERT INTO public.notifications (gym_id, user_id, title, message, type, link)
  VALUES (
    NEW.gym_id,
    NEW.assigned_to,
    'Nueva tarea asignada',
    v_message,
    'info',
    '/tareas'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_notify_assignee_insert ON public.tasks;
CREATE TRIGGER tasks_notify_assignee_insert
  AFTER INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_tasks_notify_assignee();

DROP TRIGGER IF EXISTS tasks_notify_assignee_update ON public.tasks;
CREATE TRIGGER tasks_notify_assignee_update
  AFTER UPDATE OF assigned_to ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_tasks_notify_assignee();

COMMENT ON FUNCTION public.tg_tasks_notify_assignee IS
  'Notifica al user assigned_to al crear tarea o al reasignarla. Skip si assigned_to = created_by.';
