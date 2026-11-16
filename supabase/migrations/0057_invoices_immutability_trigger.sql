-- =============================================================================
-- 0057 — Panel-A: inmutabilidad de facturas emitidas (RD 1619/2012 Art. 8 y 15)
-- =============================================================================
-- Contexto:
--   Migraciones 0043/0044 crearon la tabla `invoices` + RPC generate_invoice_from_payment.
--   La policy RLS `invoices_update_by_gym` permite a owner/admin actualizar filas
--   sin filtrar por status, lo que permitiria modificar campos fiscales despues
--   de issued -> violacion RD 1619/2012 (facturas emitidas son inmutables).
--
-- Fix (trigger BEFORE UPDATE):
--   - status=draft: todo editable (aun no emitida)
--   - status in (issued, cancelled, voided): solo se permite cambiar `status`
--     (transiciones legales como issued -> cancelled via rectificativa) + `notes`
--     + `updated_at` (automatico). Cualquier otro campo fiscal dispara excepcion.
--
-- Reporte security: HANDOFF_SECURITY->PA_critical_invoices-mutables-rd-1619.md
-- =============================================================================

create or replace function private.enforce_invoice_immutability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Draft: todo editable (aun no emitida, no existe compromiso fiscal)
  if old.status = 'draft' then
    return new;
  end if;

  -- Issued / cancelled / voided: inmutable excepto status + notes + updated_at + pdf_url
  if old.invoice_number is distinct from new.invoice_number
     or old.series is distinct from new.series
     or old.sequence_year is distinct from new.sequence_year
     or old.sequence_number is distinct from new.sequence_number
     or old.issue_date is distinct from new.issue_date
     or old.operation_date is distinct from new.operation_date
     or old.due_date is distinct from new.due_date
     or old.subtotal_cents is distinct from new.subtotal_cents
     or old.tax_rate_pct is distinct from new.tax_rate_pct
     or old.tax_cents is distinct from new.tax_cents
     or old.total_cents is distinct from new.total_cents
     or old.currency is distinct from new.currency
     or old.emitter_legal_name is distinct from new.emitter_legal_name
     or old.emitter_tax_id is distinct from new.emitter_tax_id
     or old.emitter_fiscal_address is distinct from new.emitter_fiscal_address
     or old.emitter_postal_code is distinct from new.emitter_postal_code
     or old.emitter_city is distinct from new.emitter_city
     or old.emitter_country_code is distinct from new.emitter_country_code
     or old.receiver_name is distinct from new.receiver_name
     or old.receiver_tax_id is distinct from new.receiver_tax_id
     or old.receiver_email is distinct from new.receiver_email
     or old.receiver_address is distinct from new.receiver_address
     or old.linked_payment_id is distinct from new.linked_payment_id
     or old.gym_id is distinct from new.gym_id
     or old.member_id is distinct from new.member_id
     or old.description is distinct from new.description
     or old.issued_at is distinct from new.issued_at
     or old.created_by is distinct from new.created_by
  then
    raise exception 'RD 1619/2012: factura emitida es inmutable. Usa factura rectificativa (status=cancelled + nueva factura con referencia) para correcciones.'
      using errcode = 'P0001';
  end if;

  -- Reglas adicionales sobre transiciones de status:
  -- Solo se permite issued -> cancelled (para rectificativas). Reverses prohibidos.
  if old.status = 'cancelled' and new.status is distinct from 'cancelled' then
    raise exception 'RD 1619/2012: no se puede re-activar una factura cancelada.'
      using errcode = 'P0001';
  end if;

  if old.status = 'voided' and new.status is distinct from 'voided' then
    raise exception 'RD 1619/2012: no se puede re-activar una factura anulada.'
      using errcode = 'P0001';
  end if;

  -- issued -> draft prohibido (no se puede des-emitir).
  if old.status = 'issued' and new.status = 'draft' then
    raise exception 'RD 1619/2012: no se puede revertir una factura emitida a borrador.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function private.enforce_invoice_immutability is
  'RD 1619/2012 Art. 8 + Art. 15: bloqueo mutabilidad campos fiscales y transiciones ilegales de status en facturas issued/cancelled/voided.';

drop trigger if exists invoices_enforce_immutability on public.invoices;

create trigger invoices_enforce_immutability
  before update on public.invoices
  for each row execute function private.enforce_invoice_immutability();

comment on trigger invoices_enforce_immutability on public.invoices is
  'Bloquea modificaciones de campos fiscales en facturas no-draft. Fuente: HANDOFF_SECURITY->PA_critical_invoices-mutables-rd-1619.md';
