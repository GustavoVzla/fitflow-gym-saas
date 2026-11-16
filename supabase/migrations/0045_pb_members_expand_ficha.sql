-- =============================================================================
-- 0045 — Expand members con campos adicionales para ficha completa (PB)
--
-- Contexto: F1 audit LegacyGym ficha cliente tiene 6 bloques + 50 campos.
-- FitFlow members ya tenía: birth_date, gender, tax_id, address, city,
-- postal_code, avatar_url, notes, medical_info(jsonb), tags.
--
-- Faltan para paridad ficha completa LegacyGym:
--   - second_last_name (apellido 2 — España estándar)
--   - emergency_contact_name + emergency_contact_phone + emergency_contact_relation
--   - medical_notes (text plano legible — el medical_info jsonb actual no se
--     surface en UI por ser sensible/cifrado)
--   - internal_notes (notas internas staff, distintas de notes que es del socio)
--   - dni alias preservado (usar tax_id existente)
--
-- Mapeo a la spec del prompt:
--   date_of_birth        → ya existe `birth_date` (no se renombra)
--   gender               → ya existe
--   emergency_contact_name → NUEVO
--   emergency_contact_phone → NUEVO
--   medical_notes        → NUEVO (text)
--   internal_notes       → NUEVO
--   address_line1        → ya existe `address`
--   address_postal_code  → ya existe `postal_code`
--   address_city         → ya existe `city`
--
-- Aliases-views NO necesarios. Las queries usan los nombres existentes.
-- =============================================================================

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS second_last_name text
    CHECK (second_last_name IS NULL OR length(second_last_name) <= 50),
  ADD COLUMN IF NOT EXISTS emergency_contact_name text
    CHECK (emergency_contact_name IS NULL OR length(emergency_contact_name) <= 100),
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text
    CHECK (emergency_contact_phone IS NULL OR length(emergency_contact_phone) <= 30),
  ADD COLUMN IF NOT EXISTS emergency_contact_relation text
    CHECK (emergency_contact_relation IS NULL OR length(emergency_contact_relation) <= 50),
  ADD COLUMN IF NOT EXISTS medical_notes text,
  ADD COLUMN IF NOT EXISTS internal_notes text;

COMMENT ON COLUMN public.members.second_last_name IS
  'Segundo apellido (España estándar). Distinto de last_name que guarda primer apellido.';
COMMENT ON COLUMN public.members.emergency_contact_name IS
  'Nombre completo contacto emergencia. Obligatorio gym personal training (legal).';
COMMENT ON COLUMN public.members.emergency_contact_phone IS
  'Teléfono contacto emergencia.';
COMMENT ON COLUMN public.members.emergency_contact_relation IS
  'Relación con el socio (Madre, Pareja, Hermano, etc.).';
COMMENT ON COLUMN public.members.medical_notes IS
  'Notas médicas en texto plano (alergias, lesiones conocidas). Distinto de medical_info jsonb que puede contener datos sensibles cifrados.';
COMMENT ON COLUMN public.members.internal_notes IS
  'Notas internas del staff sobre el socio. NO visibles para el socio en su área /mi-cuenta.';
