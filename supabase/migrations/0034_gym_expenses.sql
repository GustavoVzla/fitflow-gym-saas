-- =============================================================================
-- 0034 — Módulo Gastos (gym_expenses) — internal ticket
--
-- Contexto: LegacyGym tiene /payments tab Gastos. Paridad funcional crítica
-- walkthrough owner D4. Expense tracker operativo del gym (facturas proveedor,
-- material, luz, limpieza, marketing, etc.) con foto adjunta opcional.
--
-- Scope MVP:
--   - Tabla gym_expenses multi-tenant con soft-delete
--   - 9 categorías predefinidas (enum)
--   - Foto/PDF factura en Supabase Storage bucket `gym-expenses`
--   - 4 RPCs CRUD (SECURITY INVOKER + guards)
--   - RLS: staff owner/admin del gym
--   - KPI helper: total gastos mes + comparativa ingresos
--
-- Decisión #111: policy UPDATE/DELETE explícita desde día 1
-- Decisión #102: schema compatible con integración futura Stripe (si algún día
-- se cobran gastos via tarjeta, columna stripe_payment_intent_id prevista)
--
-- pgTAP: supabase/tests/rls_gym_expenses.sql
-- =============================================================================

-- ============================================================================
-- 1. ENUMs
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.expense_category AS ENUM (
    'material',          -- material deportivo, equipamiento, recambios
    'utilities',         -- luz, agua, gas, internet, teléfono
    'rent',              -- alquiler local
    'staff',             -- nóminas, SS, seguros sociales staff externo
    'cleaning',          -- limpieza, higiene, lavandería
    'marketing',         -- publicidad, redes sociales, merchandising
    'software',          -- SaaS, licencias, herramientas digitales
    'maintenance',       -- mantenimiento edificio/equipos
    'other'              -- varios no categorizados
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2. Tabla gym_expenses
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.gym_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,

  -- Datos del gasto
  category public.expense_category NOT NULL DEFAULT 'other',
  supplier text CHECK (supplier IS NULL OR length(supplier) <= 200),
  description text NOT NULL CHECK (length(description) BETWEEN 1 AND 500),
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'EUR' CHECK (length(currency) = 3),
  tax_amount numeric(10,2) DEFAULT 0 CHECK (tax_amount >= 0),

  -- Fecha del gasto (no necesariamente cuando se registra)
  expense_date date NOT NULL DEFAULT current_date,

  -- Factura adjunta (opcional)
  invoice_url text,          -- path en bucket gym-expenses: /{gym_id}/{id}.{ext}
  invoice_number text,       -- nº factura del proveedor si lo tiene

  -- Notas libres
  notes text,

  -- Stripe-ready (Decision #102) por si en futuro se cobran gastos via tarjeta
  stripe_payment_intent_id text,

  -- Soft delete (recuperable 30 días)
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices multi-tenant + queries comunes
CREATE INDEX IF NOT EXISTS idx_gym_expenses_gym_date
  ON public.gym_expenses(gym_id, expense_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gym_expenses_category
  ON public.gym_expenses(gym_id, category, expense_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gym_expenses_supplier
  ON public.gym_expenses(gym_id, lower(supplier))
  WHERE deleted_at IS NULL AND supplier IS NOT NULL;

COMMENT ON TABLE public.gym_expenses IS
  'Gastos operativos del gym (material, luz, alquiler, etc.). Soft-delete 30d recuperable. Paridad LegacyGym /payments tab Gastos.';

COMMENT ON COLUMN public.gym_expenses.invoice_url IS
  'Path en Supabase Storage bucket gym-expenses: /{gym_id}/{id}.{ext}';

COMMENT ON COLUMN public.gym_expenses.stripe_payment_intent_id IS
  'Decision #102: Stripe-ready. NULL hoy. Si en futuro se cobran gastos via tarjeta, se popula aquí.';

-- ============================================================================
-- 3. RLS policies (Decision #111: UPDATE/DELETE explícitas desde día 1)
-- ============================================================================

ALTER TABLE public.gym_expenses ENABLE ROW LEVEL SECURITY;

-- SELECT: staff del gym (owner/admin/trainer, NO staff del gym ajeno)
CREATE POLICY "gym_expenses_select_staff"
  ON public.gym_expenses FOR SELECT TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
    )
  );

-- INSERT: solo owner/admin (trainer NO puede crear gastos)
CREATE POLICY "gym_expenses_insert_admin"
  ON public.gym_expenses FOR INSERT TO authenticated
  WITH CHECK (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- UPDATE: owner/admin del gym (Decision #111 explícita)
CREATE POLICY "gym_expenses_update_admin"
  ON public.gym_expenses FOR UPDATE TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- DELETE: owner/admin (soft-delete preferido via RPC, pero hard delete si se requiere purga)
CREATE POLICY "gym_expenses_delete_admin"
  ON public.gym_expenses FOR DELETE TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gym_expenses TO authenticated;

-- ============================================================================
-- 4. RPC create_expense
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_expense(
  p_gym_id uuid,
  p_category public.expense_category,
  p_description text,
  p_amount numeric,
  p_expense_date date DEFAULT CURRENT_DATE,
  p_supplier text DEFAULT NULL,
  p_tax_amount numeric DEFAULT 0,
  p_invoice_number text DEFAULT NULL,
  p_invoice_url text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.gym_expenses
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_expense public.gym_expenses;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE user_id = auth.uid() AND gym_id = p_gym_id AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para crear gastos en este gym' USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'amount debe ser >= 0' USING ERRCODE = '22023';
  END IF;

  IF p_description IS NULL OR length(trim(p_description)) = 0 THEN
    RAISE EXCEPTION 'description es obligatoria' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.gym_expenses (
    gym_id, category, supplier, description, amount, tax_amount,
    expense_date, invoice_number, invoice_url, notes, created_by
  )
  VALUES (
    p_gym_id, p_category, p_supplier, p_description, p_amount, COALESCE(p_tax_amount, 0),
    p_expense_date, p_invoice_number, p_invoice_url, p_notes, auth.uid()
  )
  RETURNING * INTO v_expense;

  RETURN v_expense;
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_expense(uuid, public.expense_category, text, numeric, date, text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_expense(uuid, public.expense_category, text, numeric, date, text, numeric, text, text, text) TO authenticated;

-- ============================================================================
-- 5. RPC update_expense
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_expense(
  p_id uuid,
  p_category public.expense_category DEFAULT NULL,
  p_supplier text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_tax_amount numeric DEFAULT NULL,
  p_expense_date date DEFAULT NULL,
  p_invoice_number text DEFAULT NULL,
  p_invoice_url text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.gym_expenses
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_expense public.gym_expenses;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_expense FROM public.gym_expenses WHERE id = p_id AND deleted_at IS NULL;
  IF v_expense IS NULL THEN
    RAISE EXCEPTION 'gasto no existe o está eliminado' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE user_id = auth.uid() AND gym_id = v_expense.gym_id AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso' USING ERRCODE = '42501';
  END IF;

  UPDATE public.gym_expenses
    SET
      category = COALESCE(p_category, category),
      supplier = COALESCE(p_supplier, supplier),
      description = COALESCE(p_description, description),
      amount = COALESCE(p_amount, amount),
      tax_amount = COALESCE(p_tax_amount, tax_amount),
      expense_date = COALESCE(p_expense_date, expense_date),
      invoice_number = COALESCE(p_invoice_number, invoice_number),
      invoice_url = COALESCE(p_invoice_url, invoice_url),
      notes = COALESCE(p_notes, notes),
      updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_expense;

  RETURN v_expense;
END;
$fn$;

REVOKE ALL ON FUNCTION public.update_expense(uuid, public.expense_category, text, text, numeric, numeric, date, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_expense(uuid, public.expense_category, text, text, numeric, numeric, date, text, text, text) TO authenticated;

-- ============================================================================
-- 6. RPC delete_expense (soft delete)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_expense(p_id uuid)
RETURNS public.gym_expenses
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_expense public.gym_expenses;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_expense FROM public.gym_expenses WHERE id = p_id;
  IF v_expense IS NULL THEN
    RAISE EXCEPTION 'gasto no existe' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE user_id = auth.uid() AND gym_id = v_expense.gym_id AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso' USING ERRCODE = '42501';
  END IF;

  -- Idempotente: si ya está deleted, devolver tal cual
  IF v_expense.deleted_at IS NOT NULL THEN
    RETURN v_expense;
  END IF;

  UPDATE public.gym_expenses
    SET deleted_at = now(),
        deleted_by = auth.uid(),
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_expense;

  RETURN v_expense;
END;
$fn$;

REVOKE ALL ON FUNCTION public.delete_expense(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_expense(uuid) TO authenticated;

-- ============================================================================
-- 7. RPC list_expenses_range (listado + filtros)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_expenses_range(
  p_gym_id uuid,
  p_from date DEFAULT (CURRENT_DATE - interval '90 days')::date,
  p_to date DEFAULT CURRENT_DATE,
  p_category public.expense_category DEFAULT NULL,
  p_supplier text DEFAULT NULL
)
RETURNS setof public.gym_expenses
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
  SELECT *
  FROM public.gym_expenses
  WHERE gym_id = p_gym_id
    AND deleted_at IS NULL
    AND expense_date >= p_from
    AND expense_date <= p_to
    AND (p_category IS NULL OR category = p_category)
    AND (p_supplier IS NULL OR lower(supplier) LIKE '%' || lower(p_supplier) || '%')
  ORDER BY expense_date DESC, created_at DESC;
$fn$;

REVOKE ALL ON FUNCTION public.list_expenses_range(uuid, date, date, public.expense_category, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_expenses_range(uuid, date, date, public.expense_category, text) TO authenticated;

-- ============================================================================
-- 8. RPC helper: KPIs gastos mes + comparativa ingresos
-- ============================================================================

CREATE OR REPLACE FUNCTION public.gym_expenses_kpis(
  p_gym_id uuid,
  p_month date DEFAULT date_trunc('month', CURRENT_DATE)::date
)
RETURNS TABLE(
  gym_id uuid,
  month_start date,
  total_expenses numeric,
  total_expenses_by_category jsonb,
  total_income numeric,
  gross_margin numeric,
  gross_margin_pct numeric
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_month_start date := date_trunc('month', p_month)::date;
  v_month_end date := (v_month_start + interval '1 month')::date;
  v_total_expenses numeric := 0;
  v_total_income numeric := 0;
  v_by_category jsonb := '{}'::jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.gym_users
    WHERE user_id = auth.uid() AND gym_users.gym_id = p_gym_id
  ) THEN
    RAISE EXCEPTION 'Sin permiso' USING ERRCODE = '42501';
  END IF;

  -- Total gastos del mes
  SELECT COALESCE(sum(e.amount), 0)
    INTO v_total_expenses
    FROM public.gym_expenses e
    WHERE e.gym_id = p_gym_id
      AND e.deleted_at IS NULL
      AND e.expense_date >= v_month_start
      AND e.expense_date < v_month_end;

  -- Gastos por categoría
  SELECT COALESCE(jsonb_object_agg(category::text, total), '{}'::jsonb)
    INTO v_by_category
    FROM (
      SELECT category, sum(amount) AS total
      FROM public.gym_expenses
      WHERE gym_expenses.gym_id = p_gym_id
        AND deleted_at IS NULL
        AND expense_date >= v_month_start
        AND expense_date < v_month_end
      GROUP BY category
    ) sub;

  -- Total ingresos del mes (payments.paid_at en el mes, status completed)
  SELECT COALESCE(sum(p.amount), 0)
    INTO v_total_income
    FROM public.payments p
    WHERE p.gym_id = p_gym_id
      AND p.status = 'completed'
      AND p.paid_at >= v_month_start
      AND p.paid_at < v_month_end;

  RETURN QUERY SELECT
    p_gym_id AS gym_id,
    v_month_start AS month_start,
    v_total_expenses AS total_expenses,
    v_by_category AS total_expenses_by_category,
    v_total_income AS total_income,
    (v_total_income - v_total_expenses) AS gross_margin,
    CASE
      WHEN v_total_income > 0 THEN ROUND(((v_total_income - v_total_expenses) / v_total_income) * 100, 2)
      ELSE 0
    END AS gross_margin_pct;
END;
$fn$;

REVOKE ALL ON FUNCTION public.gym_expenses_kpis(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gym_expenses_kpis(uuid, date) TO authenticated;

-- ============================================================================
-- 9. Bucket Supabase Storage gym-expenses + RLS policies
--
-- Nota: CREATE BUCKET via SQL funciona con insert en storage.buckets.
-- RLS en storage.objects debe usar policies custom por bucket.
-- Path convention: {gym_id}/{expense_id}.{ext}
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gym-expenses',
  'gym-expenses',
  false,                                   -- bucket privado (requiere signed URL)
  10485760,                                -- 10 MB max por archivo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS storage.objects: solo owner/admin del gym puede leer/escribir
-- Path: {gym_id}/{expense_id}.{ext} → extraer gym_id del path

CREATE POLICY "gym_expenses_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'gym-expenses'
    AND (
      SELECT gym_id::text FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'trainer')
    ) = (storage.foldername(name))[1]
  );

CREATE POLICY "gym_expenses_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gym-expenses'
    AND (
      SELECT gym_id::text FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ) = (storage.foldername(name))[1]
  );

CREATE POLICY "gym_expenses_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'gym-expenses'
    AND (
      SELECT gym_id::text FROM public.gym_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ) = (storage.foldername(name))[1]
  );
