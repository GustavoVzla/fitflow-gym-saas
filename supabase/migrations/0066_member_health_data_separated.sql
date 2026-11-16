-- =============================================================================
-- 0066 — Separación datos de salud Art. 9 RGPD (scope reforzado)
-- =============================================================================
-- Mueve medical_notes + medical_info + image_consent + marketing_consent a
-- tabla separada con RLS más restrictivo: solo owner/admin del gym pueden
-- leer/escribir. Trainers ven el resto del perfil pero NO los datos médicos.
-- Art. 9.2.h RGPD: datos salud solo accesibles a quien tiene obligación
-- profesional de secreto. Trainers sin contrato de confidencialidad formal
-- NO pueden acceder. Owner/admin firman DPA con gym y se asume secreto.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.member_health_data (
  member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  medical_notes text,
  medical_info jsonb,
  image_consent boolean NOT NULL DEFAULT false,
  marketing_consent boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_member_health_data_gym ON public.member_health_data(gym_id);

ALTER TABLE public.member_health_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY health_data_select_restricted ON public.member_health_data
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR (gym_id IN (
      SELECT private.current_user_gym_ids()
    ) AND private.user_role_in_gym(gym_id) = ANY (ARRAY['owner','admin']::public.gym_user_role[]))
  );

CREATE POLICY health_data_insert_restricted ON public.member_health_data
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_app_admin()
    OR (gym_id IN (
      SELECT private.current_user_gym_ids()
    ) AND private.user_role_in_gym(gym_id) = ANY (ARRAY['owner','admin']::public.gym_user_role[]))
  );

CREATE POLICY health_data_update_restricted ON public.member_health_data
  FOR UPDATE TO authenticated
  USING (
    public.is_app_admin()
    OR (gym_id IN (
      SELECT private.current_user_gym_ids()
    ) AND private.user_role_in_gym(gym_id) = ANY (ARRAY['owner','admin']::public.gym_user_role[]))
  )
  WITH CHECK (
    public.is_app_admin()
    OR (gym_id IN (
      SELECT private.current_user_gym_ids()
    ) AND private.user_role_in_gym(gym_id) = ANY (ARRAY['owner','admin']::public.gym_user_role[]))
  );

CREATE POLICY health_data_delete_owner ON public.member_health_data
  FOR DELETE TO authenticated
  USING (
    public.is_app_admin()
    OR (gym_id IN (
      SELECT private.current_user_gym_ids()
    ) AND private.user_role_in_gym(gym_id) = 'owner'::public.gym_user_role)
  );

INSERT INTO public.member_health_data (
  member_id, gym_id, medical_notes, medical_info, image_consent, marketing_consent, updated_at
)
SELECT
  id, gym_id, medical_notes, medical_info,
  coalesce(image_consent, false),
  coalesce(marketing_consent, false),
  coalesce(updated_at, now())
FROM public.members
WHERE medical_notes IS NOT NULL
   OR medical_info IS NOT NULL
   OR image_consent = true
   OR marketing_consent = true
ON CONFLICT (member_id) DO NOTHING;

COMMENT ON TABLE public.member_health_data IS
  'Datos de salud Art. 9 RGPD + consentimientos. RLS restringido: solo owner/admin del gym + super-admin. Trainers no acceden.';
