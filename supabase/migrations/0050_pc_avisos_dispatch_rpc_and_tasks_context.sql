-- ════════════════════════════════════════════════════════════════════════
-- 0050 — Panel-C · dispatch RPC + pg_cron job + tasks context (member/phone)
-- ════════════════════════════════════════════════════════════════════════
-- Parte 1: enqueue_aviso() — RPC que server actions llaman tras el evento.
-- Parte 2: dispatch_pending_avisos() — RPC que pg_cron ejecuta cada 5 min.
-- Parte 3: pg_cron job avisos-dispatcher cada 5 min.
-- Parte 4: tasks.member_id + tasks.phone (assigned_to ya existe FK auth.users).

-- ───────────────────────────────────────────────────────────────────────
-- PARTE 1: enqueue_aviso
-- ───────────────────────────────────────────────────────────────────────
-- Llamada desde server actions cuando ocurre un evento trigger.
-- Busca plantillas activas que matcheen el trigger_type y encola una fila
-- por plantilla. Retorna cantidad de filas encoladas.
--
-- SECURITY DEFINER: bypasses RLS para poder insertar en queue sin exponer
-- INSERT policy a clients. Validado internamente contra current_user_gyms().

CREATE OR REPLACE FUNCTION public.enqueue_aviso(
  p_gym_id uuid,
  p_member_id uuid,
  p_trigger_type text,
  p_event_context jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_enqueued integer := 0;
  v_template record;
  v_scheduled_for timestamptz;
BEGIN
  -- Validar que el caller pertenece al gym (o es service_role sin auth.uid()).
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.current_user_gyms() g WHERE g.gym_id = p_gym_id
    ) AND NOT public.is_app_admin() THEN
      RAISE EXCEPTION 'Not authorized for gym %', p_gym_id USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Para cada plantilla activa del gym con ese trigger, encola una fila.
  FOR v_template IN
    SELECT id, send_offset_minutes
    FROM public.engagement_alerts
    WHERE gym_id = p_gym_id
      AND trigger_type = p_trigger_type
      AND is_active = true
  LOOP
    v_scheduled_for := now() + make_interval(mins => v_template.send_offset_minutes);

    INSERT INTO public.avisos_dispatch_queue (
      gym_id, template_id, member_id, event_context, scheduled_for, status
    ) VALUES (
      p_gym_id, v_template.id, p_member_id, p_event_context, v_scheduled_for, 'pending'
    );
    v_enqueued := v_enqueued + 1;
  END LOOP;

  RETURN v_enqueued;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_aviso(uuid, uuid, text, jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.enqueue_aviso IS
  'Encola avisos pendientes según plantillas activas. Server actions llaman tras evento trigger.';

-- ───────────────────────────────────────────────────────────────────────
-- PARTE 2: render_merge_tags (helper) + dispatch_pending_avisos
-- ───────────────────────────────────────────────────────────────────────
-- Merge tags soportados: {nombre}, {fecha_vencimiento}, {nombre_tarifa}
-- Escapa valores NULL como cadena vacía.

CREATE OR REPLACE FUNCTION public.render_aviso_body(
  p_body text,
  p_member_id uuid,
  p_event_context jsonb DEFAULT '{}'::jsonb
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_nombre text;
  v_vence text;
  v_tarifa text;
  v_body text := p_body;
BEGIN
  SELECT coalesce(m.first_name, ''),
         coalesce(to_char(mt.end_date, 'DD/MM/YYYY'), ''),
         coalesce(t.name, '')
    INTO v_nombre, v_vence, v_tarifa
  FROM public.members m
  LEFT JOIN public.tariffs t ON t.id = m.current_tariff_id
  LEFT JOIN LATERAL (
    SELECT end_date FROM public.member_tariffs
    WHERE member_id = m.id AND (end_date IS NULL OR end_date >= current_date)
    ORDER BY start_date DESC LIMIT 1
  ) mt ON true
  WHERE m.id = p_member_id;

  -- Override desde event_context si está presente (ej. booking_reminder pasa class_name)
  v_nombre := coalesce(p_event_context->>'nombre', v_nombre, '');
  v_vence := coalesce(p_event_context->>'fecha_vencimiento', v_vence, '');
  v_tarifa := coalesce(p_event_context->>'nombre_tarifa', v_tarifa, '');

  v_body := replace(v_body, '{nombre}', v_nombre);
  v_body := replace(v_body, '{fecha_vencimiento}', v_vence);
  v_body := replace(v_body, '{nombre_tarifa}', v_tarifa);

  RETURN v_body;
END;
$$;

GRANT EXECUTE ON FUNCTION public.render_aviso_body TO authenticated, service_role;

COMMENT ON FUNCTION public.render_aviso_body IS
  'Render de merge tags {nombre} {fecha_vencimiento} {nombre_tarifa}. STABLE para reuso en same txn.';

-- ───────────────────────────────────────────────────────────────────────
-- dispatch_pending_avisos
-- ───────────────────────────────────────────────────────────────────────
-- Procesa hasta p_batch_size filas pending con scheduled_for <= now().
-- NOTA: no envía emails/SMS reales en esta fase — solo marca sent y graba
-- en engagement_history. El canal real (edge function + Resend/Twilio) se
-- añade en sprint posterior. Para channel=in_app crea una notification.
--
-- Cada fila procesada: render body → INSERT notifications (si in_app) →
-- INSERT engagement_history → UPDATE queue.status='sent'.
-- En error: UPDATE queue.status='failed' + error_message + attempts++.
--
-- Retorna total procesado.

CREATE OR REPLACE FUNCTION public.dispatch_pending_avisos(
  p_batch_size integer DEFAULT 200
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row record;
  v_processed integer := 0;
  v_rendered_body text;
  v_rendered_subject text;
  v_history_id uuid;
  v_channel text;
  v_gym_id uuid;
  v_member_auth_uid uuid;
BEGIN
  FOR v_row IN
    SELECT q.*, t.channel, t.subject, t.message_template, t.name AS template_name
    FROM public.avisos_dispatch_queue q
    LEFT JOIN public.engagement_alerts t ON t.id = q.template_id
    WHERE q.status = 'pending'
      AND q.scheduled_for <= now()
    ORDER BY q.scheduled_for ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      -- Si la template fue borrada o deshabilitada → skip
      IF v_row.template_id IS NULL OR v_row.message_template IS NULL THEN
        UPDATE public.avisos_dispatch_queue
        SET status = 'skipped',
            error_message = 'Plantilla eliminada o deshabilitada',
            attempts = attempts + 1,
            sent_at = now()
        WHERE id = v_row.id;
        CONTINUE;
      END IF;

      v_gym_id := v_row.gym_id;
      v_channel := v_row.channel;
      v_rendered_body := public.render_aviso_body(
        v_row.message_template, v_row.member_id, v_row.event_context
      );
      v_rendered_subject := public.render_aviso_body(
        coalesce(v_row.subject, v_row.template_name), v_row.member_id, v_row.event_context
      );

      -- Canal in_app: crear notification in-app para el socio si tiene auth_user_id
      IF v_channel = 'in_app' THEN
        SELECT auth_user_id INTO v_member_auth_uid
        FROM public.members WHERE id = v_row.member_id;

        IF v_member_auth_uid IS NOT NULL THEN
          INSERT INTO public.notifications (gym_id, user_id, title, message, type)
          VALUES (v_gym_id, v_member_auth_uid, v_rendered_subject, v_rendered_body, 'info');
        END IF;
      END IF;

      -- Email / SMS / WhatsApp: registrar en history con status='sent'.
      -- El envío real lo hará una edge function futura leyendo engagement_history
      -- WHERE status='sent' AND channel != 'in_app' AND not_sent_yet_flag.
      -- Por ahora MVP: marcar como enviado (el canal real se conecta sprint 1.5).

      INSERT INTO public.engagement_history (
        gym_id, alert_id, member_id, channel, status, sent_at
      ) VALUES (
        v_gym_id, v_row.template_id, v_row.member_id, v_channel, 'sent', now()
      ) RETURNING id INTO v_history_id;

      UPDATE public.avisos_dispatch_queue
      SET status = 'sent',
          sent_at = now(),
          attempts = attempts + 1,
          history_id = v_history_id
      WHERE id = v_row.id;

      v_processed := v_processed + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE public.avisos_dispatch_queue
      SET status = 'failed',
          error_message = left(SQLERRM, 500),
          attempts = attempts + 1
      WHERE id = v_row.id;

      INSERT INTO public.engagement_history (
        gym_id, alert_id, member_id, channel, status, error_message, sent_at
      ) VALUES (
        v_row.gym_id, v_row.template_id, v_row.member_id,
        coalesce(v_row.channel, 'in_app'), 'failed', left(SQLERRM, 500), now()
      );
    END;
  END LOOP;

  RETURN v_processed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dispatch_pending_avisos(integer) TO service_role;

COMMENT ON FUNCTION public.dispatch_pending_avisos IS
  'Procesa cola de avisos pendientes (batch 200). Ejecutado por pg_cron cada 5 min.';

-- ───────────────────────────────────────────────────────────────────────
-- PARTE 3: pg_cron job cada 5 min
-- ───────────────────────────────────────────────────────────────────────
-- pg_cron ya está instalado (migración 0022).

-- Unschedule si existe (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'avisos-dispatcher') THEN
    PERFORM cron.unschedule('avisos-dispatcher');
  END IF;
END $$;

SELECT cron.schedule(
  'avisos-dispatcher',
  '*/5 * * * *',
  $$SELECT public.dispatch_pending_avisos(200);$$
);

-- ───────────────────────────────────────────────────────────────────────
-- PARTE 4: extender tasks con member_id + phone
-- ───────────────────────────────────────────────────────────────────────
-- Gap F7-P0-3: vincular tareas a Cliente + Instructor + Teléfono.
-- assigned_to (FK auth.users) ya existe desde 0001 → se reusa como instructor.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.members(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS instructor_id uuid REFERENCES public.instructors(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.tasks.member_id IS
  'Socio vinculado a la tarea (ej: "Llamar a Juan Pérez para renovar"). FK members.';
COMMENT ON COLUMN public.tasks.instructor_id IS
  'Instructor vinculado a la tarea (responsable funcional, NO user del panel). FK instructors.';
COMMENT ON COLUMN public.tasks.assigned_to IS
  'Staff/admin del panel responsable de ejecutar. FK auth.users (distinto de instructor).';
COMMENT ON COLUMN public.tasks.phone IS
  'Teléfono de contacto (autocompletado desde member.phone, editable manual).';

CREATE INDEX IF NOT EXISTS idx_tasks_member ON public.tasks (member_id)
  WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_instructor ON public.tasks (instructor_id)
  WHERE instructor_id IS NOT NULL;
