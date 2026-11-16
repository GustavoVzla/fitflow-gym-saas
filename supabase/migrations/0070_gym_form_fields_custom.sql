-- 0070_gym_form_fields_custom.sql
-- Sprint paridad100 A2 Formularios custom
-- Permite al gym definir campos custom para Alta socio / Alta potencial
-- LegacyGym parity tab Formularios.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'form_field_type') THEN
    CREATE TYPE public.form_field_type AS ENUM (
      'text', 'number', 'select', 'checkbox', 'textarea', 'date'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'form_scope') THEN
    CREATE TYPE public.form_scope AS ENUM ('member_signup', 'prospect_signup');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.gym_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  form_scope public.form_scope NOT NULL,
  field_name text NOT NULL,
  field_label text NOT NULL,
  field_type public.form_field_type NOT NULL DEFAULT 'text',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  placeholder text,
  help_text text,
  is_required boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gym_id, form_scope, field_name)
);

CREATE INDEX IF NOT EXISTS idx_gym_form_fields_gym_scope
  ON public.gym_form_fields (gym_id, form_scope, is_active, sort_order);

CREATE TRIGGER trg_gym_form_fields_updated_at
  BEFORE UPDATE ON public.gym_form_fields
  FOR EACH ROW EXECUTE FUNCTION private.tg_set_updated_at();

ALTER TABLE public.gym_form_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gym_form_fields_select ON public.gym_form_fields;
CREATE POLICY gym_form_fields_select ON public.gym_form_fields
  FOR SELECT TO authenticated
  USING (gym_id = ANY (private.current_user_gym_ids()));

DROP POLICY IF EXISTS gym_form_fields_insert ON public.gym_form_fields;
CREATE POLICY gym_form_fields_insert ON public.gym_form_fields
  FOR INSERT TO authenticated
  WITH CHECK (
    gym_id = ANY (private.current_user_gym_ids())
    AND private.user_role_in_gym(gym_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS gym_form_fields_update ON public.gym_form_fields;
CREATE POLICY gym_form_fields_update ON public.gym_form_fields
  FOR UPDATE TO authenticated
  USING (gym_id = ANY (private.current_user_gym_ids()))
  WITH CHECK (
    gym_id = ANY (private.current_user_gym_ids())
    AND private.user_role_in_gym(gym_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS gym_form_fields_delete ON public.gym_form_fields;
CREATE POLICY gym_form_fields_delete ON public.gym_form_fields
  FOR DELETE TO authenticated
  USING (
    gym_id = ANY (private.current_user_gym_ids())
    AND private.user_role_in_gym(gym_id) IN ('owner', 'admin')
  );

COMMENT ON TABLE public.gym_form_fields IS
  'Campos custom por gym para Alta socio / Alta potencial (LegacyGym parity tab Formularios).';
