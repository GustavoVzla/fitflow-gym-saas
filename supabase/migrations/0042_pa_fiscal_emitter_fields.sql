-- =============================================================================
-- 0042 — Panel-A: datos fiscales del emisor separados del perfil comercial
-- =============================================================================
-- Contexto:
--   Hasta ahora el gym tenia un unico campo "name" (nombre comercial) + "tax_id"
--   + "address"/"city"/"postal_code" compartidos para comunicacion y facturacion.
--   Requisito RD 1619/2012 (Reglamento Facturacion ES): la factura debe llevar
--   la razon social legal + NIF + domicilio fiscal, que pueden diferir del
--   nombre comercial y del domicilio del centro.
--
-- Caso real Demo Studio:
--   - Nombre comercial: Demo Studio
--   - Razon social:     DEMO FITNESS SL
--   - CIF:              B11111111
--   - Domicilio fiscal: C/ Ejemplo 1, 28040 Madrid
-- =============================================================================

alter table public.gyms
  add column if not exists legal_name text,
  add column if not exists fiscal_address_line1 text,
  add column if not exists fiscal_address_postal_code text,
  add column if not exists fiscal_address_city text,
  add column if not exists fiscal_country_code text not null default 'ES'
    check (fiscal_country_code ~ '^[A-Z]{2}$');

comment on column public.gyms.legal_name is
  'Razon social legal (p.ej. "DEMO FITNESS SL"). Usado en factura. Puede diferir de name (nombre comercial).';
comment on column public.gyms.fiscal_address_line1 is
  'Domicilio fiscal usado en factura. Puede diferir de address (domicilio comercial).';
comment on column public.gyms.fiscal_country_code is
  'Codigo ISO 3166-1 alfa-2. Default ES. Obligatorio en factura.';

-- =============================================================================
-- Pre-poblar Demo Studio con datos fiscales reales detectados en auditoria V3
-- (gym id 00000000-0000-4000-8000-000000000001)
-- =============================================================================

update public.gyms
set
  legal_name = 'DEMO FITNESS SL',
  tax_id = coalesce(tax_id, 'B11111111'),
  fiscal_address_line1 = 'C/ Ejemplo 1',
  fiscal_address_postal_code = '28040',
  fiscal_address_city = 'Madrid',
  fiscal_country_code = 'ES'
where id = '00000000-0000-4000-8000-000000000001';
