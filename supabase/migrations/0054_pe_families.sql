-- ═══════════════════════════════════════════════════════════════════
-- Migración 0054 (pe): families + family_members
-- ═══════════════════════════════════════════════════════════════════
-- Paridad LegacyGym "Familias" — agrupador pagador. Un socio paga
-- por varios (ej. padres pagan por hijos, abuelos por nietos).
-- RLS multi-tenant Decision #111.

CREATE TABLE IF NOT EXISTS public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  primary_payer_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  billing_email text,
  billing_phone text,
  billing_address text,
  billing_city text,
  billing_postal_code text,
  billing_tax_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_families_gym ON public.families(gym_id);

CREATE TABLE IF NOT EXISTS public.family_members (
  member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_members_family ON public.family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_gym ON public.family_members(gym_id);

CREATE OR REPLACE FUNCTION public.tg_families_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS families_updated_at ON public.families;
CREATE TRIGGER families_updated_at
  BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.tg_families_updated_at();

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY families_staff_select ON public.families
  FOR SELECT TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY families_staff_insert ON public.families
  FOR INSERT TO authenticated
  WITH CHECK (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY families_staff_update ON public.families
  FOR UPDATE TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()))
  WITH CHECK (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY families_staff_delete ON public.families
  FOR DELETE TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY family_members_staff_select ON public.family_members
  FOR SELECT TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY family_members_staff_insert ON public.family_members
  FOR INSERT TO authenticated
  WITH CHECK (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY family_members_staff_delete ON public.family_members
  FOR DELETE TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

COMMENT ON TABLE public.families IS 'Paridad LegacyGym Familias. Un payer primario por varios atletas del gym.';
COMMENT ON TABLE public.family_members IS 'Junction. member_id PK (cada socio pertenece a max 1 familia).';
