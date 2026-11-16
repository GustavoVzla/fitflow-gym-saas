-- ════════════════════════════════════════════════════════════════════════
-- 0049 — Panel-C Avisos cron · Cola de envío (avisos_dispatch_queue)
-- ════════════════════════════════════════════════════════════════════════
-- Tabla intermedia entre el evento disparador (server actions) y el envío
-- efectivo (dispatch RPC + cron).
--
-- Flujo:
--   1. Evento (member created, booking confirmed, payment overdue) encola fila.
--   2. scheduled_for = now() + alert.send_offset_minutes.
--   3. pg_cron dispara dispatch_pending_avisos() cada 5 min.
--   4. RPC lee WHERE scheduled_for <= now() AND status='pending'
--      → renderiza plantilla con merge tags → llama canal → marca sent/failed.
--   5. history_id enlaza la fila a engagement_history (trazabilidad).
--
-- RLS: staff del gym puede leer su cola (debugging). INSERT/UPDATE solo
-- service_role (via RPCs SECURITY DEFINER).

CREATE TABLE IF NOT EXISTS public.avisos_dispatch_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.engagement_alerts(id) ON DELETE SET NULL,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  -- Contexto del evento (booking_id, payment_id, etc) para render merge tags
  event_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Scheduling
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  -- Estado
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed','skipped','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  error_message text,
  -- Enlaces
  history_id uuid REFERENCES public.engagement_history(id) ON DELETE SET NULL,
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.avisos_dispatch_queue IS
  'Cola de avisos pendientes. pg_cron drena cada 5 min via dispatch_pending_avisos().';
COMMENT ON COLUMN public.avisos_dispatch_queue.event_context IS
  'JSONB con datos del evento: {booking_id, payment_id, amount, class_name, ...}. Usado para renderizar merge tags.';
COMMENT ON COLUMN public.avisos_dispatch_queue.scheduled_for IS
  'Hora programada para el envío (now() + template.send_offset_minutes). pg_cron compara contra este campo.';

-- Índice clave: dispatch RPC lee por (status=pending, scheduled_for <= now()).
CREATE INDEX IF NOT EXISTS idx_avisos_queue_pending
  ON public.avisos_dispatch_queue (scheduled_for)
  WHERE status = 'pending';

-- Índice por gym+status para UI de historial 24h
CREATE INDEX IF NOT EXISTS idx_avisos_queue_gym_status
  ON public.avisos_dispatch_queue (gym_id, status, scheduled_for DESC);

CREATE INDEX IF NOT EXISTS idx_avisos_queue_member
  ON public.avisos_dispatch_queue (member_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS avisos_queue_updated_at ON public.avisos_dispatch_queue;
CREATE TRIGGER avisos_queue_updated_at
  BEFORE UPDATE ON public.avisos_dispatch_queue
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ───────────────────────────────────────────────────────────────────────
-- RLS: staff lee su cola; escritura solo via RPCs
-- ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.avisos_dispatch_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY avisos_queue_staff_select ON public.avisos_dispatch_queue
  FOR SELECT TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

-- No se permite INSERT/UPDATE/DELETE directo desde cliente (ni siquiera owner/admin).
-- Solo RPCs SECURITY DEFINER (enqueue_aviso, dispatch_pending_avisos) pueden escribir.

COMMENT ON POLICY avisos_queue_staff_select ON public.avisos_dispatch_queue IS
  'Staff del gym ve su cola para debugging/historial. Escritura solo via RPCs.';
