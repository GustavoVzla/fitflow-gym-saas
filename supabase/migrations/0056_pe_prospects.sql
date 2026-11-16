-- ═══════════════════════════════════════════════════════════════════
-- Migración 0056 (pe): prospects (CRM leads)
-- ═══════════════════════════════════════════════════════════════════
DO $$ BEGIN
  CREATE TYPE public.prospect_status AS ENUM (
    'new', 'contacted', 'scheduled_visit', 'converted', 'lost'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  email text,
  phone text,
  source text,
  interest text,
  status public.prospect_status NOT NULL DEFAULT 'new',
  assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  last_contact_at timestamptz,
  conversion_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  lost_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospects_gym_status ON public.prospects(gym_id, status);
CREATE INDEX IF NOT EXISTS idx_prospects_assigned ON public.prospects(assigned_to_user_id);

CREATE OR REPLACE FUNCTION public.tg_prospects_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prospects_updated_at ON public.prospects;
CREATE TRIGGER prospects_updated_at
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.tg_prospects_updated_at();

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY prospects_staff_select ON public.prospects
  FOR SELECT TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY prospects_staff_insert ON public.prospects
  FOR INSERT TO authenticated
  WITH CHECK (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY prospects_staff_update ON public.prospects
  FOR UPDATE TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()))
  WITH CHECK (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY prospects_staff_delete ON public.prospects
  FOR DELETE TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE OR REPLACE FUNCTION public.convert_prospect_to_member(
  p_prospect_id uuid,
  p_tariff_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_prospect record;
  v_member_id uuid;
  v_first_name text;
  v_last_name text;
  v_space_pos int;
BEGIN
  SELECT * INTO v_prospect FROM public.prospects WHERE id = p_prospect_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prospect no encontrado';
  END IF;
  IF v_prospect.status = 'converted' THEN
    RAISE EXCEPTION 'Prospect ya fue convertido';
  END IF;

  v_space_pos := position(' ' in v_prospect.name);
  IF v_space_pos > 0 THEN
    v_first_name := substring(v_prospect.name from 1 for v_space_pos - 1);
    v_last_name := substring(v_prospect.name from v_space_pos + 1);
  ELSE
    v_first_name := v_prospect.name;
    v_last_name := '-';
  END IF;

  INSERT INTO public.members (
    gym_id, first_name, last_name, email, phone,
    current_tariff_id, status, rgpd_consent, rgpd_consent_at
  ) VALUES (
    v_prospect.gym_id, v_first_name, v_last_name, v_prospect.email, v_prospect.phone,
    p_tariff_id, 'active', true, now()
  ) RETURNING id INTO v_member_id;

  UPDATE public.prospects
     SET status = 'converted',
         conversion_member_id = v_member_id,
         updated_at = now()
   WHERE id = p_prospect_id;

  RETURN v_member_id;
END;
$$;

COMMENT ON TABLE public.prospects IS 'Paridad LegacyGym Potenciales. CRM leads pre-socio con funnel de 5 estados.';
COMMENT ON FUNCTION public.convert_prospect_to_member IS 'Convierte prospect en member creando row en members + marca converted.';
