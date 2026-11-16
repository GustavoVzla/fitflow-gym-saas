-- RGPD Art. 7 compliance: trazabilidad del consentimiento real
-- Antes: rgpd_consent = true hardcoded server-side (violacion RGPD).
-- Ahora: columna source + operator_user_id + validacion explicita en createMember + convertProspect.
--
-- Valores validos en rgpd_consent_source (enum informal, no SQL enum por flexibilidad futura):
--   'paper_signed'              - consentimiento firmado en papel (gym archiva)
--   'email_confirmed'           - email con link confirm (double opt-in)
--   'in_person_verbal_logged'   - verbal in situ con nota operator
--   'digital_signature'         - firma digital (eSign)
--   'legacy_import'          - importado de LegacyGym (consentimiento previo gym)

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS rgpd_consent_source text,
  ADD COLUMN IF NOT EXISTS rgpd_consent_operator_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_members_rgpd_consent_operator
  ON public.members(rgpd_consent_operator_user_id)
  WHERE rgpd_consent_operator_user_id IS NOT NULL;

COMMENT ON COLUMN public.members.rgpd_consent_source IS
  'Fuente del consentimiento RGPD. Valores: paper_signed|email_confirmed|in_person_verbal_logged|digital_signature|legacy_import.';
COMMENT ON COLUMN public.members.rgpd_consent_operator_user_id IS
  'User_id del operator que registro el consentimiento (trazabilidad auditoria AEPD).';
