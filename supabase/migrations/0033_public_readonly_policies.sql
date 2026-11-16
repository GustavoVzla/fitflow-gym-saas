-- =============================================================================
-- 0033 — Policies públicas read-only para web pública demo-studio.example.com (internal ticket)
--
-- Contexto: sesión Web construye demo-studio.example.com con horarios + tarifas + instructores
-- visibles sin auth. Hoy zero policies 'anon' → imposible leer desde sitio público.
--
-- Scope: lectura anónima de data comercial básica per-gym. NO expone:
--   - members, bookings, payments (data privada)
--   - appointments (citas privadas)
--   - gym_settings, gym_users (configuración interna)
--
-- Filtros por gym: la web consulta solo el gym que aplica (ej. Demo Studio
-- gym_id = <demo-gym-id>). Hoy NO hay selector multi-gym en web pública — un
-- sitio = un gym. Futura app B2C universal añadirá policy `public read all` o
-- filtro por dominio.
--
-- Recomendación sesión Web: usar Supabase anon key + RLS filtra automáticamente.
-- NO exponer service_role key en web pública.
--
-- Tablas con nueva policy anon SELECT:
--   - gyms (básico: id, slug, name, logo_url, brand_color, timezone, currency,
--     address, phone, email, website) — NO stripe_*, NO deleted_at, NO suspended
--   - classes (templates recurring)
--   - class_instances (instancias concretas, sin info privada)
--   - tariffs (precios + descripción)
--   - instructors (solo is_active=true, sin auth_user_id, sin email interno)
--   - gym_rooms (salas activas)
-- =============================================================================

-- ============================================================================
-- 1. GYMS — lectura pública limitada (solo gyms activos, no deleted/suspended)
-- ============================================================================

CREATE POLICY "gyms_public_read_active"
  ON public.gyms FOR SELECT
  TO anon
  USING (
    status = 'active'
    AND deleted_at IS NULL
    AND suspended_at IS NULL
  );

-- ============================================================================
-- 2. CLASSES — templates públicos (filter por gym activo)
-- ============================================================================

CREATE POLICY "classes_public_read_active"
  ON public.classes FOR SELECT
  TO anon
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.gyms g
      WHERE g.id = classes.gym_id
        AND g.status = 'active'
        AND g.deleted_at IS NULL
    )
  );

-- ============================================================================
-- 3. CLASS_INSTANCES — instancias públicas (para calendario horario web)
-- ============================================================================

CREATE POLICY "class_instances_public_read_scheduled"
  ON public.class_instances FOR SELECT
  TO anon
  USING (
    status = 'scheduled'
    AND EXISTS (
      SELECT 1 FROM public.gyms g
      WHERE g.id = class_instances.gym_id
        AND g.status = 'active'
        AND g.deleted_at IS NULL
    )
  );

-- ============================================================================
-- 4. TARIFFS — precios públicos (filter por gym activo)
-- ============================================================================

CREATE POLICY "tariffs_public_read_active"
  ON public.tariffs FOR SELECT
  TO anon
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.gyms g
      WHERE g.id = tariffs.gym_id
        AND g.status = 'active'
        AND g.deleted_at IS NULL
    )
  );

-- ============================================================================
-- 5. INSTRUCTORS — instructores públicos (solo is_active=true)
-- ============================================================================

CREATE POLICY "instructors_public_read_active"
  ON public.instructors FOR SELECT
  TO anon
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.gyms g
      WHERE g.id = instructors.gym_id
        AND g.status = 'active'
        AND g.deleted_at IS NULL
    )
  );

-- ============================================================================
-- 6. GYM_ROOMS — salas públicas (útil para mostrar "Sala 1", "Sala Funcional")
-- ============================================================================

CREATE POLICY "gym_rooms_public_read_active"
  ON public.gym_rooms FOR SELECT
  TO anon
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.gyms g
      WHERE g.id = gym_rooms.gym_id
        AND g.status = 'active'
        AND g.deleted_at IS NULL
    )
  );

-- ============================================================================
-- NOTA DE SEGURIDAD
--
-- NO se añaden policies anon a: members, bookings, payments, appointments,
-- gym_settings, gym_users, import_jobs, admin_*. Data privada intacta.
--
-- Si en futuro se expone algún campo sensible accidentalmente, rollback via
-- 0033_rollback.sql + audit.
-- ============================================================================
