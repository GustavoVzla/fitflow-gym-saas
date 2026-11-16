-- =============================================================================
-- 0044 — Panel-A: RPC generate_invoice_from_payment + helpers
-- =============================================================================
-- Genera una factura (status=issued, inmutable) a partir de un pago completado.
-- Toma los datos fiscales del gym emisor + datos del socio + pago, calcula
-- base imponible e IVA (extrayendo 21% de un importe total que incluye IVA) y
-- reserva un numero correlativo atomicamente por (gym, year) via UPDATE FOR
-- UPDATE en invoice_sequences.
--
-- Reglas:
--   - No genera factura si ya existe una factura (no cancelled/voided) ligada
--     al mismo pago.
--   - El numero correlativo es GAP-FREE: si la transaccion aborta, el contador
--     no avanza (bloqueo pesimista sobre la fila invoice_sequences).
--   - Los snapshots del emisor se congelan en este momento — cambios posteriores
--     en gyms.* NO afectan facturas historicas.
--   - tax_rate_pct = 21 por defecto (IVA general ES). Configurable en input.
--   - Solo acepta pagos status='completed' (RD 1619/2012: factura se emite por
--     operacion ya realizada, no por intencion de cobro).
-- =============================================================================

-- Helper: default prefix a partir del slug del gym (primeras 4 letras upper)
create or replace function private.default_invoice_prefix(p_gym_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select upper(substring(regexp_replace(coalesce(slug, 'GYM'), '[^a-zA-Z0-9]', '', 'g'), 1, 4))
  from public.gyms where id = p_gym_id;
$$;

revoke all on function private.default_invoice_prefix(uuid) from public, anon;
grant execute on function private.default_invoice_prefix(uuid) to authenticated, service_role;

-- Helper: reserva siguiente numero (atomic lock-row). Crea fila si no existe.
create or replace function private.next_invoice_number(p_gym_id uuid, p_year int)
returns table (seq_number int, prefix text, invoice_number text)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_prefix text;
  v_next int;
begin
  -- Insert si no existe (ON CONFLICT DO NOTHING), luego SELECT FOR UPDATE
  insert into public.invoice_sequences (gym_id, year, last_number, prefix)
  values (
    p_gym_id,
    p_year,
    0,
    coalesce(private.default_invoice_prefix(p_gym_id), 'INV')
  )
  on conflict (gym_id, year) do nothing;

  -- Lock fila para evitar race conditions con transacciones concurrentes
  select s.prefix, s.last_number + 1
    into v_prefix, v_next
  from public.invoice_sequences s
  where s.gym_id = p_gym_id and s.year = p_year
  for update;

  update public.invoice_sequences
  set last_number = v_next
  where gym_id = p_gym_id and year = p_year;

  seq_number := v_next;
  prefix := v_prefix;
  invoice_number := v_prefix || '-' || p_year::text || '-' || lpad(v_next::text, 5, '0');
  return next;
end;
$$;

revoke all on function private.next_invoice_number(uuid, int) from public, anon;
grant execute on function private.next_invoice_number(uuid, int) to authenticated, service_role;

-- =============================================================================
-- RPC principal: generate_invoice_from_payment
-- =============================================================================

create or replace function public.generate_invoice_from_payment(
  p_payment_id uuid,
  p_tax_rate_pct numeric default 21.00,
  p_receiver_tax_id text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_payment record;
  v_gym record;
  v_member record;
  v_existing uuid;
  v_year int;
  v_seq record;
  v_subtotal_cents int;
  v_tax_cents int;
  v_total_cents int;
  v_invoice_id uuid;
  v_user_gym_role text;
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  -- 1. Cargar pago + validaciones basicas
  select * into v_payment from public.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment % not found', p_payment_id using errcode = 'P0002';
  end if;

  if v_payment.status <> 'completed' then
    raise exception 'Solo se puede facturar un pago completed (estado actual: %)', v_payment.status
      using errcode = 'P0001';
  end if;

  -- 2. Autorizacion: el caller debe ser owner/admin/staff del gym O super-admin
  if not public.is_app_admin() then
    select role into v_user_gym_role
    from public.gym_users
    where user_id = v_user_id and gym_id = v_payment.gym_id
    limit 1;

    if v_user_gym_role is null or v_user_gym_role not in ('owner', 'admin', 'staff') then
      raise exception 'No autorizado para facturar pagos de este gym' using errcode = '42501';
    end if;
  end if;

  -- 3. Evitar duplicados: si ya existe factura viva para este pago, retornar su id
  select id into v_existing
  from public.invoices
  where linked_payment_id = p_payment_id
    and status in ('draft', 'issued')
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  -- 4. Cargar datos fiscales del gym (snapshot)
  select * into v_gym from public.gyms where id = v_payment.gym_id;
  if v_gym.legal_name is null or v_gym.tax_id is null
     or v_gym.fiscal_address_line1 is null or v_gym.fiscal_address_city is null then
    raise exception 'El gym no tiene datos fiscales completos. Completa Configuracion > Datos fiscales antes de emitir facturas.'
      using errcode = 'P0001';
  end if;

  -- 5. Cargar socio receptor
  select id, first_name, last_name, email, tax_id, address, city, postal_code
    into v_member
  from public.members
  where id = v_payment.member_id;

  -- 6. Calcular importes. El amount del pago incluye IVA (precio final cliente).
  --    base = round(total * 100 / (100 + tax_rate))
  --    iva  = total - base
  v_total_cents := round(v_payment.amount * 100)::int;
  v_subtotal_cents := round(v_total_cents::numeric * 100 / (100 + p_tax_rate_pct))::int;
  v_tax_cents := v_total_cents - v_subtotal_cents;

  -- 7. Reservar numero correlativo
  v_year := extract(year from coalesce(v_payment.paid_at, now()))::int;
  select * into v_seq from private.next_invoice_number(v_payment.gym_id, v_year);

  -- 8. Insert con snapshots
  insert into public.invoices (
    gym_id, member_id, linked_payment_id,
    invoice_number, series, sequence_year, sequence_number,
    issue_date, operation_date,
    subtotal_cents, tax_rate_pct, tax_cents, total_cents, currency,
    status, issued_at,
    emitter_legal_name, emitter_tax_id, emitter_fiscal_address,
    emitter_postal_code, emitter_city, emitter_country_code,
    receiver_name, receiver_tax_id, receiver_email, receiver_address,
    description, notes, created_by
  ) values (
    v_payment.gym_id, v_member.id, v_payment.id,
    v_seq.invoice_number, 'A', v_year, v_seq.seq_number,
    current_date, coalesce(v_payment.paid_at::date, current_date),
    v_subtotal_cents, p_tax_rate_pct, v_tax_cents, v_total_cents, v_payment.currency,
    'issued', now(),
    v_gym.legal_name, v_gym.tax_id, v_gym.fiscal_address_line1,
    coalesce(v_gym.fiscal_address_postal_code, ''), coalesce(v_gym.fiscal_address_city, ''),
    coalesce(v_gym.fiscal_country_code, 'ES'),
    trim(coalesce(v_member.first_name,'') || ' ' || coalesce(v_member.last_name,'')),
    coalesce(p_receiver_tax_id, v_member.tax_id),
    v_member.email,
    trim(concat_ws(', ', v_member.address, v_member.postal_code, v_member.city)),
    v_payment.description,
    p_notes,
    v_user_id
  )
  returning id into v_invoice_id;

  return v_invoice_id;
end;
$$;

revoke all on function public.generate_invoice_from_payment(uuid, numeric, text, text) from public, anon;
grant execute on function public.generate_invoice_from_payment(uuid, numeric, text, text) to authenticated;

comment on function public.generate_invoice_from_payment(uuid, numeric, text, text) is
  'Emite una factura (RD 1619/2012) a partir de un pago completed. Idempotente por linked_payment_id. Snapshots emisor+receptor congelados en issued.';
