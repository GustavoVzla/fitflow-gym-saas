-- ═══════════════════════════════════════════════════════════════════
-- Migración 0055 (pe): training_groups + training_group_members
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.training_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text,
  default_class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  color text DEFAULT '#0B4B8C',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_groups_gym ON public.training_groups(gym_id, is_active);

CREATE TABLE IF NOT EXISTS public.training_group_members (
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.training_groups(id) ON DELETE CASCADE,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_training_group_members_group ON public.training_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_training_group_members_gym ON public.training_group_members(gym_id);

CREATE OR REPLACE FUNCTION public.tg_training_groups_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS training_groups_updated_at ON public.training_groups;
CREATE TRIGGER training_groups_updated_at
  BEFORE UPDATE ON public.training_groups
  FOR EACH ROW EXECUTE FUNCTION public.tg_training_groups_updated_at();

ALTER TABLE public.training_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_groups_staff_select ON public.training_groups
  FOR SELECT TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY training_groups_staff_insert ON public.training_groups
  FOR INSERT TO authenticated
  WITH CHECK (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY training_groups_staff_update ON public.training_groups
  FOR UPDATE TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()))
  WITH CHECK (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY training_groups_staff_delete ON public.training_groups
  FOR DELETE TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY training_group_members_staff_select ON public.training_group_members
  FOR SELECT TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY training_group_members_staff_insert ON public.training_group_members
  FOR INSERT TO authenticated
  WITH CHECK (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY training_group_members_staff_delete ON public.training_group_members
  FOR DELETE TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

COMMENT ON TABLE public.training_groups IS 'Paridad LegacyGym Grupos de entreno. Squad/team de atletas con clase por defecto opcional.';
