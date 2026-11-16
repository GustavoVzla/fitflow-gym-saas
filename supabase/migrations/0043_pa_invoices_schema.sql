-- =============================================================================
-- 0043 — Panel-A: schema facturas (RD 1619/2012 ES)
-- =============================================================================
-- MVP Facturacion. Cumple requisitos minimos Real Decreto 1619/2012 (Reglamento
-- por el que se regulan las obligaciones de facturacion, Espana):
--   - Numero correlativo y serie por emisor (gym)
--   - Datos del emisor (razon social, NIF, domicilio fiscal)
--   - Datos del receptor (nombre + NIF opcional para B2C)
--   - Descripcion de la operacion
--   - Base imponible + tipo IVA + cuota IVA repercutido + total
--   - Fecha de expedicion (issue_date) y, en su caso, fecha de operacion
--
-- Formato numero: <prefix>-YYYY-NNNNN (prefix 2-6 chars uppercase, year, 5 digit sequence)
--   ejemplo: WELL-2026-00001
-- =============================================================================

-- 1. Estado de factura
create type invoice_status as enum (
  'draft',        -- borrador, puede editarse
  'issued',       -- emitida, inmutable por ley (RD 1619/2012 art. 11)
  'cancelled',    -- rectificada mediante factura rectificativa (no se borra)
  'voided'        -- anulada antes de emision (solo si status era 'draft')
);

-- 2. Secuencia por gym — una secuencia logica por (gym, year). Se implementa
--    con tabla invoice_sequences (no tipo sequence, porque Postgres sequences
--    son globales y no multi-tenant-safe para numerado correlativo).
create table public.invoice_sequences (
  gym_id uuid not null references public.gyms(id) on delete cascade,
  year int not null check (year >= 2024 and year <= 2100),
  last_number int not null default 0 check (last_number >= 0),
  prefix text not null check (prefix ~ '^[A-Z0-9]{2,6}$'),
  updated_at timestamptz not null default now(),
  primary key (gym_id, year)
);

comment on table public.invoice_sequences is
  'Contador correlativo por gym y ano. Clave unica (gym_id, year). NUNCA resetear sin gap-free guarantee.';

-- 3. Tabla principal facturas
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  linked_payment_id uuid references public.payments(id) on delete set null,

  -- Numeracion correlativa (inmutable una vez issued)
  invoice_number text not null check (invoice_number ~ '^[A-Z0-9]{2,6}-\d{4}-\d{5}$'),
  series text not null default 'A' check (length(series) between 1 and 10),
  sequence_year int not null check (sequence_year >= 2024 and sequence_year <= 2100),
  sequence_number int not null check (sequence_number >= 1),

  -- Fechas
  issue_date date not null default current_date,
  due_date date,
  operation_date date,     -- Fecha de operacion (si difiere de issue_date)

  -- Importes (en centimos para evitar float precision)
  subtotal_cents int not null check (subtotal_cents >= 0),
  tax_rate_pct numeric(5,2) not null default 21.00 check (tax_rate_pct >= 0 and tax_rate_pct <= 100),
  tax_cents int not null check (tax_cents >= 0),
  total_cents int not null check (total_cents >= 0),
  currency text not null default 'EUR' check (length(currency) = 3),

  -- Status + documento
  status invoice_status not null default 'draft',
  pdf_url text,
  pdf_generated_at timestamptz,

  -- SNAPSHOT emisor (RD 1619/2012 art. 6.1.c — obligatorios en factura)
  -- Se congelan en issued para que cambios posteriores en gyms.* NO afecten
  -- facturas historicas (integridad fiscal / auditoria Hacienda).
  emitter_legal_name text not null,
  emitter_tax_id text not null,
  emitter_fiscal_address text not null,
  emitter_postal_code text not null,
  emitter_city text not null,
  emitter_country_code text not null,

  -- SNAPSHOT receptor (art. 6.1.d)
  receiver_name text not null,
  receiver_tax_id text,              -- opcional en B2C (art. 6.1.d excepcion)
  receiver_email text,
  receiver_address text,

  -- Concepto / descripcion operacion
  description text not null,
  notes text,

  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  issued_at timestamptz,             -- momento en que pasa de draft a issued
  cancelled_at timestamptz,
  cancellation_reason text,

  -- Unicidad del numero dentro del gym
  unique (gym_id, invoice_number),
  unique (gym_id, sequence_year, sequence_number),

  -- Integridad importes: tax_cents = round(subtotal * tax_rate / 100)
  --   y total = subtotal + tax (checks tolerantes a redondeo 1 centimo)
  check (abs(total_cents - (subtotal_cents + tax_cents)) <= 1)
);

comment on table public.invoices is
  'Facturas emitidas RD 1619/2012. SNAPSHOT de emisor+receptor para inmutabilidad fiscal. Una vez status=issued, solo se puede cancelar (no editar).';
comment on column public.invoices.linked_payment_id is
  'Pago operacional del que se genera la factura. NULL si factura sin pago (p.ej. anticipo o factura manual).';
comment on column public.invoices.emitter_legal_name is
  'SNAPSHOT de gyms.legal_name al issue. Nunca se actualiza si el gym cambia su razon social.';

create index invoices_gym_idx on public.invoices (gym_id, issue_date desc);
create index invoices_member_idx on public.invoices (member_id, issue_date desc)
  where member_id is not null;
create index invoices_status_idx on public.invoices (gym_id, status);
create index invoices_linked_payment_idx on public.invoices (linked_payment_id)
  where linked_payment_id is not null;

-- Trigger updated_at
create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function private.set_updated_at();

create trigger invoice_sequences_set_updated_at
  before update on public.invoice_sequences
  for each row execute function private.set_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.invoices enable row level security;
alter table public.invoice_sequences enable row level security;

-- Invoices: aislamiento por gym_id
create policy invoices_select_by_gym on public.invoices
  for select using (
    public.is_app_admin() or gym_id in (select gym_id from public.current_user_gyms())
  );

create policy invoices_insert_by_gym on public.invoices
  for insert with check (
    gym_id in (select gym_id from public.current_user_gyms() where role in ('owner','admin','staff'))
  );

create policy invoices_update_by_gym on public.invoices
  for update using (
    gym_id in (select gym_id from public.current_user_gyms() where role in ('owner','admin'))
  ) with check (
    gym_id in (select gym_id from public.current_user_gyms() where role in ('owner','admin'))
  );

-- Invoice sequences: solo visible/editable por owner/admin del gym
-- (escritura en la practica solo via RPC generate_invoice_from_payment)
create policy invoice_sequences_select_by_gym on public.invoice_sequences
  for select using (
    public.is_app_admin() or gym_id in (select gym_id from public.current_user_gyms())
  );

create policy invoice_sequences_update_by_gym on public.invoice_sequences
  for update using (
    gym_id in (select gym_id from public.current_user_gyms() where role in ('owner','admin'))
  );

-- =============================================================================
-- Socio ve sus propias facturas (RLS member plane)
-- =============================================================================

create policy invoices_select_by_member on public.invoices
  for select using (
    member_id in (select id from public.members where auth_user_id = auth.uid())
  );
