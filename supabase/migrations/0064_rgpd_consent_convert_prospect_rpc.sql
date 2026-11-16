-- Drop old signature (uuid, uuid) para permitir CREATE con nuevos params.
DROP FUNCTION IF EXISTS public.convert_prospect_to_member(uuid, uuid);

CREATE OR REPLACE FUNCTION public.convert_prospect_to_member(
  p_prospect_id uuid,
  p_tariff_id uuid DEFAULT NULL,
  p_rgpd_consent_granted boolean DEFAULT false,
  p_rgpd_consent_source text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_prospect record;
  v_member_id uuid;
  v_first_name text;
  v_last_name text;
  v_space_pos int;
  v_user_id uuid := auth.uid();
BEGIN
  IF NOT p_rgpd_consent_granted THEN
    RAISE EXCEPTION 'Debe confirmarse consentimiento RGPD del potencial antes de convertir en socio'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_rgpd_consent_source IS NULL OR p_rgpd_consent_source NOT IN
     ('paper_signed','email_confirmed','in_person_verbal_logged','digital_signature') THEN
    RAISE EXCEPTION 'rgpd_consent_source invalido (debe ser paper_signed|email_confirmed|in_person_verbal_logged|digital_signature)'
      USING ERRCODE = 'P0001';
  END IF;

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
    current_tariff_id, status,
    rgpd_consent, rgpd_consent_at, rgpd_consent_source, rgpd_consent_operator_user_id
  ) VALUES (
    v_prospect.gym_id, v_first_name, v_last_name, v_prospect.email, v_prospect.phone,
    p_tariff_id, 'active',
    true, now(), p_rgpd_consent_source, v_user_id
  ) RETURNING id INTO v_member_id;

  UPDATE public.prospects
     SET status = 'converted',
         conversion_member_id = v_member_id,
         updated_at = now()
   WHERE id = p_prospect_id;

  RETURN v_member_id;
END;
$$;

COMMENT ON FUNCTION public.convert_prospect_to_member IS
  'Convierte prospect en member. RGPD Art. 7: requiere p_rgpd_consent_granted + p_rgpd_consent_source validos. Guarda operator via auth.uid().';
