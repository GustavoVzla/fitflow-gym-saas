-- =============================================================================
-- 0029 — Import jobs + admin_import_members_from_csv RPC
--
-- Scope:
--   1. ENUM import_job_type ('members', 'tariffs', 'payments') — extensible
--   2. ENUM import_job_status ('pending', 'dry_run_ok', 'completed', 'failed')
--   3. Tabla import_jobs con RLS super-admin only (via is_app_admin())
--   4. RPC admin_import_members_from_csv (atomica + rollback per row fail)
--
-- Decision #111 aplicada: policies SELECT + INSERT + UPDATE desde dia 1
-- (el job pasa de 'pending' -> 'dry_run_ok' -> 'completed/failed', requiere UPDATE)
-- =============================================================================

-- ENUMs
DO $$ BEGIN
  CREATE TYPE public.import_job_type AS ENUM ('members', 'tariffs', 'payments');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.import_job_status AS ENUM ('pending', 'dry_run_ok', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Tabla
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  job_type public.import_job_type NOT NULL DEFAULT 'members',
  status public.import_job_status NOT NULL DEFAULT 'pending',
  filename text,
  rows_total integer NOT NULL DEFAULT 0,
  rows_ok integer NOT NULL DEFAULT 0,
  rows_err integer NOT NULL DEFAULT 0,
  errors_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_gym ON public.import_jobs(gym_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON public.import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_by ON public.import_jobs(created_by);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

-- RLS: SOLO super-admin (FitFlow). No es data del tenant, es operacion backoffice.
CREATE POLICY "import_jobs_select_admin"
  ON public.import_jobs FOR SELECT TO authenticated
  USING (public.is_app_admin());

CREATE POLICY "import_jobs_insert_admin"
  ON public.import_jobs FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());

-- Decision #111: UPDATE policy explicita desde dia 1 (el job cambia status)
CREATE POLICY "import_jobs_update_admin"
  ON public.import_jobs FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

COMMENT ON TABLE public.import_jobs IS 'Jobs de importacion masiva de datos (socios, tarifas, pagos). Solo super-admin.';
COMMENT ON COLUMN public.import_jobs.column_mapping IS 'Mapping JSON { "csv_col_name": "members_col_name" } elegido por el super-admin durante preview.';
COMMENT ON COLUMN public.import_jobs.errors_json IS 'Array [{ row: N, reason: "...", value: "..." }] de filas rechazadas.';

-- =============================================================================
-- RPC admin_import_members_from_csv
--
-- Ejecuta insert masivo atomico. Si cualquier row lanza excepcion, rollback total.
-- El caller (Server Action) ya hizo dry-run y filtro errores. Aqui solo insertamos.
--
-- Input: p_gym_id uuid, p_rows jsonb (array de member objects ya validados y mapeados)
-- Output: import_job record final (id, rows_ok, rows_err, status)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_import_members_from_csv(
  p_gym_id uuid,
  p_filename text,
  p_column_mapping jsonb,
  p_rows jsonb
)
RETURNS public.import_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_job public.import_jobs;
  v_row jsonb;
  v_idx integer := 0;
  v_ok integer := 0;
  v_err integer := 0;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  -- Guard: solo super-admin
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Solo super-admin puede importar datos' USING ERRCODE = '42501';
  END IF;

  -- Guard: gym existe
  IF NOT EXISTS (SELECT 1 FROM public.gyms WHERE id = p_gym_id) THEN
    RAISE EXCEPTION 'gym_id % no existe', p_gym_id USING ERRCODE = '22023';
  END IF;

  -- Crear job pending
  INSERT INTO public.import_jobs (gym_id, job_type, status, filename, rows_total, column_mapping, created_by)
  VALUES (p_gym_id, 'members', 'pending', p_filename, jsonb_array_length(p_rows), p_column_mapping, auth.uid())
  RETURNING * INTO v_job;

  -- Insertar filas una a una; capturar errores por fila (NO rollback completo)
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_idx := v_idx + 1;
    BEGIN
      INSERT INTO public.members (
        gym_id,
        first_name,
        last_name,
        email,
        phone,
        birth_date,
        tax_id,
        address,
        city,
        postal_code,
        member_number,
        status,
        join_date,
        notes,
        rgpd_consent,
        marketing_consent,
        image_consent
      ) VALUES (
        p_gym_id,
        COALESCE(v_row->>'first_name', ''),
        COALESCE(v_row->>'last_name', ''),
        NULLIF(v_row->>'email', ''),
        NULLIF(v_row->>'phone', ''),
        NULLIF(v_row->>'birth_date', '')::date,
        NULLIF(v_row->>'tax_id', ''),
        NULLIF(v_row->>'address', ''),
        NULLIF(v_row->>'city', ''),
        NULLIF(v_row->>'postal_code', ''),
        NULLIF(v_row->>'member_number', ''),
        COALESCE((v_row->>'status')::public.member_status, 'active'),
        COALESCE(NULLIF(v_row->>'join_date', '')::date, current_date),
        NULLIF(v_row->>'notes', ''),
        COALESCE((v_row->>'rgpd_consent')::boolean, false),
        COALESCE((v_row->>'marketing_consent')::boolean, false),
        COALESCE((v_row->>'image_consent')::boolean, false)
      );
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_err := v_err + 1;
      v_errors := v_errors || jsonb_build_object(
        'row', v_idx,
        'reason', SQLERRM,
        'sqlstate', SQLSTATE,
        'data', v_row
      );
    END;
  END LOOP;

  -- Update job con resultado final
  UPDATE public.import_jobs
    SET rows_ok = v_ok,
        rows_err = v_err,
        errors_json = v_errors,
        status = CASE WHEN v_err = 0 THEN 'completed'::public.import_job_status ELSE 'failed'::public.import_job_status END,
        updated_at = now()
    WHERE id = v_job.id
    RETURNING * INTO v_job;

  RETURN v_job;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_import_members_from_csv(uuid, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_import_members_from_csv(uuid, text, jsonb, jsonb) TO authenticated;

COMMENT ON FUNCTION public.admin_import_members_from_csv IS
  'Importa filas de socios en lote. Best-effort por fila (fila fallida -> registrada en errors_json, resto continua). Solo super-admin.';

-- =============================================================================
-- RPC admin_list_import_jobs (helper UI listado)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_list_import_jobs(p_gym_id uuid)
RETURNS setof public.import_jobs
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT *
  FROM public.import_jobs
  WHERE gym_id = p_gym_id
    AND public.is_app_admin()
  ORDER BY created_at DESC
  LIMIT 50;
$fn$;

REVOKE ALL ON FUNCTION public.admin_list_import_jobs(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_import_jobs(uuid) TO authenticated;
