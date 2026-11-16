-- =============================================================================
-- FitFlow — Initial Schema (multi-tenant SaaS fitness)
-- =============================================================================
-- Arquitectura:
--   - Multi-tenant: cada centro deportivo es un "gym" (tenant root).
--   - Users de Supabase Auth (auth.users) se conectan a gyms via gym_users (M:N).
--   - RLS en 0002_rls_policies.sql (este archivo solo define estructura).
--
-- Principios:
--   - UUID primary keys (generados por Postgres, no por aplicación)
--   - timestamps UTC con timezone (timestamptz)
--   - soft delete via status/is_active, NUNCA DELETE físico
--   - payment snapshots (tariff_snapshot JSONB) para integridad histórica
--   - class_instances separadas de classes (patrón plantilla + instancia)
-- =============================================================================

-- Extensiones necesarias
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Schema privado para funciones SECURITY DEFINER (no expuesto a API)
create schema if not exists private;

-- =============================================================================
-- ENUMS (tipos enumerados — más rápidos y seguros que text con CHECK)
-- =============================================================================

create type gym_status as enum ('active', 'trial', 'suspended', 'cancelled');
create type gym_plan as enum ('base', 'smart', 'pro', 'premium', 'app_pro', 'enterprise');
create type gym_user_role as enum ('super_admin', 'owner', 'admin', 'staff', 'trainer', 'viewer');
create type member_status as enum ('active', 'pending', 'inactive', 'blocked');
create type class_type as enum ('dinamico', 'premium', 'salud', 'personal_1h', 'personal_30min', 'grupal');
create type class_instance_status as enum ('scheduled', 'cancelled', 'completed');
create type booking_status as enum ('confirmed', 'waitlist', 'cancelled', 'attended', 'no_show');
create type tariff_type as enum ('monthly', 'bonus', 'one_time');
create type payment_method as enum ('manual', 'sepa', 'card', 'stripe', 'cash', 'bank_transfer');
create type payment_status as enum ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled');
create type notification_type as enum ('info', 'warning', 'success', 'error');
create type task_status as enum ('todo', 'in_progress', 'done', 'archived');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');
create type shop_order_status as enum ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded');

-- =============================================================================
-- 1. GYMS — tenant root
-- =============================================================================

create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]+$' and length(slug) between 3 and 50),
  name text not null check (length(name) between 1 and 100),
  logo_url text,
  address text,
  city text,
  postal_code text,
  country text default 'ES',
  phone text,
  email text,
  website text,
  timezone text not null default 'Europe/Madrid',
  currency text not null default 'EUR' check (length(currency) = 3),
  tax_id text, -- CIF/NIF España
  status gym_status not null default 'trial',
  plan gym_plan not null default 'base',
  trial_ends_at timestamptz,
  stripe_account_id text, -- Stripe Connect account
  stripe_customer_id text, -- Para cobrarle a NOSOTROS la suscripción SaaS
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.gyms is 'Tenant root. Cada gym es un centro deportivo aislado via RLS.';
comment on column public.gyms.slug is 'URL-friendly identifier (ej: demo-studio-madrid). Usado en subdominios futuros.';
comment on column public.gyms.stripe_account_id is 'Stripe Connect Express account del gym para cobrar a sus socios.';
comment on column public.gyms.stripe_customer_id is 'Nuestro customer_id para cobrar al gym su suscripción FitFlow.';

create index gyms_slug_idx on public.gyms (slug);
create index gyms_status_idx on public.gyms (status) where status != 'cancelled';

-- =============================================================================
-- 2. GYM_USERS — relación M:N auth.users ↔ gyms con rol
-- =============================================================================

create table public.gym_users (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role gym_user_role not null default 'staff',
  is_active boolean not null default true,
  invited_by uuid references auth.users(id),
  invited_at timestamptz default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, user_id)
);

comment on table public.gym_users is 'Relación muchos-a-muchos entre auth.users y gyms con rol. Base del sistema multi-tenant.';

create index gym_users_user_id_idx on public.gym_users (user_id) where is_active = true;
create index gym_users_gym_id_idx on public.gym_users (gym_id) where is_active = true;

-- =============================================================================
-- 3. GYM_SETTINGS — configuración por gym (tabs config del panel)
-- =============================================================================

create table public.gym_settings (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  -- Horarios de apertura (JSONB flexible para cada día de la semana)
  opening_hours jsonb not null default '{}'::jsonb,
  -- Configuración de reservas
  booking_advance_days integer not null default 7 check (booking_advance_days between 0 and 90),
  booking_cancel_hours integer not null default 2 check (booking_cancel_hours between 0 and 72),
  waitlist_enabled boolean not null default true,
  -- Configuración de notificaciones
  notifications_config jsonb not null default '{"email": true, "sms": false, "push": true}'::jsonb,
  -- Branding custom
  brand_color text default '#3b8bea',
  brand_logo_url text,
  -- Integraciones
  integrations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.gym_settings is 'Configuración por gym. JSONB para flexibilidad sin migraciones frecuentes.';

-- =============================================================================
-- 4. INSTRUCTORS — entrenadores/instructores
-- =============================================================================

create table public.instructors (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, -- opcional: si tiene cuenta
  name text not null check (length(name) between 1 and 100),
  email text,
  phone text,
  bio text,
  specialties text[] default '{}',
  avatar_url text,
  color text default '#3b8bea', -- color para el horario
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index instructors_gym_id_idx on public.instructors (gym_id) where is_active = true;

-- =============================================================================
-- 5. TARIFFS — tarifas/planes del gym
-- =============================================================================

create table public.tariffs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  "group" text, -- agrupador (ej: "Adultos", "Niños", "Empresas")
  name text not null check (length(name) between 1 and 100),
  description text,
  price numeric(10,2) not null check (price >= 0),
  type tariff_type not null default 'monthly',
  sessions_per_week integer check (sessions_per_week is null or sessions_per_week > 0),
  total_sessions integer check (total_sessions is null or total_sessions > 0),
  duration_months integer check (duration_months is null or duration_months > 0),
  color text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.tariffs.sessions_per_week is 'Para tarifas de sesiones limitadas por semana (ej: 3 sesiones/semana).';
comment on column public.tariffs.total_sessions is 'Para bonos: total de sesiones incluidas (ej: bono 10 sesiones).';

create index tariffs_gym_id_idx on public.tariffs (gym_id) where is_active = true;

-- =============================================================================
-- 6. MEMBERS — socios del gym
-- =============================================================================

create table public.members (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  -- Datos personales
  first_name text not null check (length(first_name) between 1 and 50),
  last_name text not null check (length(last_name) between 1 and 50),
  email text,
  phone text,
  birth_date date,
  gender text check (gender in ('male', 'female', 'other', null)),
  tax_id text, -- DNI/NIE
  -- Dirección
  address text,
  city text,
  postal_code text,
  -- Relación con el gym
  member_number text, -- número de socio interno
  status member_status not null default 'pending',
  join_date date not null default current_date,
  leave_date date,
  -- Tarifa actual (snapshot para lookup rápido; histórico en member_tariffs)
  current_tariff_id uuid references public.tariffs(id) on delete set null,
  -- Metadatos
  avatar_url text,
  notes text,
  tags text[] default '{}',
  -- Consentimientos RGPD
  rgpd_consent boolean not null default false,
  rgpd_consent_at timestamptz,
  marketing_consent boolean not null default false,
  image_consent boolean not null default false,
  -- Datos médicos (JSONB, cifrado a nivel app si sensible)
  medical_info jsonb,
  -- Pagos
  stripe_customer_id text,
  sepa_mandate_id text,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Constraint: email único por gym (puede repetirse entre gyms distintos)
  unique (gym_id, email)
);

comment on table public.members is 'Socios del gym. Email único POR gym (un mismo email puede existir en varios gyms).';
comment on column public.members.medical_info is 'Datos médicos en JSONB. Campos sensibles deben cifrarse a nivel aplicación.';

create index members_gym_id_idx on public.members (gym_id);
create index members_status_idx on public.members (gym_id, status);
create index members_name_idx on public.members (gym_id, last_name, first_name);
create index members_email_idx on public.members (gym_id, email) where email is not null;

-- =============================================================================
-- 7. MEMBER_TARIFFS — histórico de tarifas aplicadas a cada socio
-- =============================================================================

create table public.member_tariffs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  tariff_id uuid not null references public.tariffs(id) on delete restrict,
  -- Snapshot de la tarifa al aplicarla (para integridad histórica)
  tariff_snapshot jsonb not null,
  start_date date not null default current_date,
  end_date date,
  sessions_used integer not null default 0,
  sessions_remaining integer, -- null = ilimitado
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on column public.member_tariffs.tariff_snapshot is 'Snapshot completo de la tarifa en el momento de aplicarla. Evita que cambios futuros corrompan históricos.';

create index member_tariffs_member_idx on public.member_tariffs (member_id) where is_active = true;
create index member_tariffs_gym_idx on public.member_tariffs (gym_id);

-- =============================================================================
-- 8. CLASSES — plantilla de clase recurrente (semanal)
-- =============================================================================

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  description text,
  type class_type not null default 'grupal',
  instructor_id uuid references public.instructors(id) on delete set null,
  -- Plantilla recurrente semanal
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0=domingo
  start_time time not null,
  end_time time not null,
  duration_minutes integer generated always as (
    extract(epoch from (end_time - start_time)) / 60
  ) stored,
  -- Capacidad
  max_spots integer not null check (max_spots > 0),
  min_spots integer default 1 check (min_spots >= 0),
  waitlist_size integer default 0 check (waitlist_size >= 0),
  -- Ubicación
  room text,
  -- Control
  color text,
  valid_from date not null default current_date,
  valid_until date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

comment on table public.classes is 'Plantillas de clases recurrentes semanales. Las instancias concretas están en class_instances.';

create index classes_gym_day_idx on public.classes (gym_id, day_of_week) where is_active = true;

-- =============================================================================
-- 9. CLASS_INSTANCES — instancia concreta de una clase en una fecha
-- =============================================================================

create table public.class_instances (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  -- Fecha y hora efectiva (puede diferir de la plantilla si hay cambios puntuales)
  scheduled_date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  -- Overrides opcionales de la plantilla
  instructor_id uuid references public.instructors(id) on delete set null,
  room text,
  max_spots integer,
  -- Estado
  status class_instance_status not null default 'scheduled',
  cancellation_reason text,
  -- Cache (se recalcula con triggers)
  booked_count integer not null default 0,
  waitlist_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, scheduled_date),
  check (end_at > start_at)
);

comment on table public.class_instances is 'Instancia concreta de una clase. Permite cancelar/modificar una sesión específica sin afectar la plantilla.';

create index class_instances_gym_date_idx on public.class_instances (gym_id, scheduled_date);
create index class_instances_upcoming_idx on public.class_instances (gym_id, start_at) where status = 'scheduled';

-- =============================================================================
-- 10. BOOKINGS — reservas de socios a class_instances
-- =============================================================================

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  class_instance_id uuid not null references public.class_instances(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  status booking_status not null default 'confirmed',
  -- Trazabilidad
  booked_at timestamptz not null default now(),
  cancelled_at timestamptz,
  attended_at timestamptz,
  position_in_waitlist integer,
  -- Consumo de sesiones (si la tarifa es por sesiones)
  consumed_session boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_instance_id, member_id)
);

comment on table public.bookings is 'Reservas. Constraint único asegura que un socio no reserve 2 veces la misma instancia.';

create index bookings_gym_idx on public.bookings (gym_id);
create index bookings_member_idx on public.bookings (member_id, booked_at desc);
create index bookings_instance_idx on public.bookings (class_instance_id) where status in ('confirmed', 'waitlist');

-- =============================================================================
-- 11. PAYMENTS — pagos con snapshot de tarifa
-- =============================================================================

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete restrict,
  member_tariff_id uuid references public.member_tariffs(id) on delete set null,
  -- Importe
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'EUR' check (length(currency) = 3),
  tax_amount numeric(10,2) default 0 check (tax_amount >= 0),
  -- Descripción
  description text not null,
  concept text, -- 'subscription', 'bonus', 'product', 'penalty'
  period_start date,
  period_end date,
  -- SNAPSHOT: datos congelados en el momento del pago (integridad histórica)
  tariff_snapshot jsonb,
  member_snapshot jsonb not null,
  -- Método y estado
  method payment_method not null,
  status payment_status not null default 'pending',
  -- Integración externa
  stripe_payment_intent_id text,
  stripe_charge_id text,
  sepa_mandate_id text,
  external_reference text,
  -- Fechas
  due_date date,
  paid_at timestamptz,
  refunded_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  -- Factura
  invoice_number text,
  invoice_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.payments is 'Pagos con SNAPSHOT de tarifa y socio. Históricos inmutables aunque se editen tarifas/socios.';
comment on column public.payments.tariff_snapshot is 'Snapshot de la tarifa al momento del pago. NUNCA se modifica tras paid_at.';
comment on column public.payments.member_snapshot is 'Snapshot mínimo del socio (nombre, email, tax_id) al momento del pago. Para facturación histórica.';

create index payments_gym_idx on public.payments (gym_id, created_at desc);
create index payments_member_idx on public.payments (member_id, created_at desc);
create index payments_status_idx on public.payments (gym_id, status) where status in ('pending', 'failed');
create index payments_period_idx on public.payments (gym_id, period_start, period_end);

-- =============================================================================
-- 12. NOTIFICATIONS — notificaciones internas del panel
-- =============================================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade, -- null = para todo el gym
  title text not null,
  message text not null,
  type notification_type not null default 'info',
  link text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where is_read = false;
create index notifications_gym_idx on public.notifications (gym_id, created_at desc);

-- =============================================================================
-- 13. TASKS — tareas internas del staff
-- =============================================================================

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  title text not null,
  description text,
  status task_status not null default 'todo',
  priority task_priority not null default 'medium',
  assigned_to uuid references auth.users(id) on delete set null,
  due_date date,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_gym_status_idx on public.tasks (gym_id, status) where status != 'archived';
create index tasks_assigned_idx on public.tasks (assigned_to) where status != 'done' and status != 'archived';

-- =============================================================================
-- 14. CONVERSATIONS + MESSAGES — chat interno gym↔socio y gym↔staff
-- =============================================================================

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  subject text,
  last_message_at timestamptz default now(),
  last_message_preview text,
  unread_count_gym integer not null default 0,
  unread_count_member integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_gym_idx on public.conversations (gym_id, last_message_at desc) where is_archived = false;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('gym', 'member', 'system', 'bot')),
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_member_id uuid references public.members(id) on delete set null,
  content text not null,
  attachments jsonb default '[]'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- =============================================================================
-- 15. OFFERS — ofertas/promociones
-- =============================================================================

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  title text not null,
  description text,
  discount_type text check (discount_type in ('percentage', 'fixed', 'free_trial')),
  discount_value numeric(10,2),
  valid_from date,
  valid_until date,
  max_redemptions integer,
  current_redemptions integer not null default 0,
  code text, -- código promocional opcional
  applicable_tariff_ids uuid[], -- array de tariff_ids aplicables (null = todas)
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, code) deferrable initially deferred
);

create index offers_gym_active_idx on public.offers (gym_id) where is_active = true;

-- =============================================================================
-- 16. WORKOUTS — plantillas de entrenamientos (AMRAP, EMOM, Tabata...)
-- =============================================================================

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null,
  type text not null, -- 'amrap', 'emom', 'tabata', 'custom'
  description text,
  duration_minutes integer,
  difficulty text check (difficulty in ('beginner', 'intermediate', 'advanced', null)),
  exercises jsonb not null default '[]'::jsonb,
  published_date date default current_date,
  published_by uuid references auth.users(id),
  is_published boolean not null default false,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workouts_gym_idx on public.workouts (gym_id, published_date desc) where is_published = true;

-- =============================================================================
-- 17. COMPETITIONS — competiciones internas del gym
-- =============================================================================

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null,
  description text,
  start_date date not null,
  end_date date not null,
  type text, -- 'ranking', 'challenge', 'tournament'
  rules jsonb default '{}'::jsonb,
  participants jsonb default '[]'::jsonb,
  results jsonb default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

-- =============================================================================
-- 18. SHOP_PRODUCTS + SHOP_ORDERS — tienda del gym
-- =============================================================================

create table public.shop_products (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  category text,
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  tax_rate numeric(5,2) default 21.0, -- IVA España
  stock integer,
  sku text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shop_products_gym_idx on public.shop_products (gym_id) where is_active = true;

create table public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  order_number text not null,
  items jsonb not null, -- [{product_id, name, quantity, price, tax}]
  subtotal numeric(10,2) not null,
  tax_amount numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  status shop_order_status not null default 'pending',
  payment_id uuid references public.payments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, order_number)
);

create index shop_orders_gym_idx on public.shop_orders (gym_id, created_at desc);

-- =============================================================================
-- 19. POSTS — publicaciones/feed social del gym
-- =============================================================================

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  title text,
  content text not null,
  media_urls text[] default '{}',
  tags text[] default '{}',
  is_published boolean not null default false,
  published_at timestamptz,
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_gym_idx on public.posts (gym_id, published_at desc) where is_published = true;

-- =============================================================================
-- 20. REPORTS_SNAPSHOTS — cache de informes (recalculados periódicamente)
-- =============================================================================

create table public.reports_snapshots (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  report_key text not null, -- 'monthly_revenue', 'active_members', 'churn_rate', etc.
  period_start date not null,
  period_end date not null,
  data jsonb not null,
  computed_at timestamptz not null default now(),
  unique (gym_id, report_key, period_start, period_end)
);

create index reports_snapshots_lookup_idx on public.reports_snapshots (gym_id, report_key, period_end desc);

-- =============================================================================
-- 21. AUDIT_LOG — trazabilidad RGPD y operativa
-- =============================================================================

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null, -- 'create', 'update', 'delete', 'login', 'export', 'consent'
  resource_type text not null, -- 'member', 'payment', 'booking', etc.
  resource_id uuid,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_log_gym_idx on public.audit_log (gym_id, created_at desc);
create index audit_log_resource_idx on public.audit_log (resource_type, resource_id);

-- =============================================================================
-- FUNCTIONS — helpers para RLS y triggers
-- =============================================================================

-- Helper: gyms a los que pertenece el usuario actual (SECURITY DEFINER evita recursión)
create or replace function private.current_user_gym_ids()
returns setof uuid
language sql
security definer
set search_path = ''
stable
as $$
  select gym_id from public.gym_users
  where user_id = (select auth.uid())
    and is_active = true
$$;

-- Helper: rol del usuario en un gym específico
create or replace function private.user_role_in_gym(p_gym_id uuid)
returns gym_user_role
language sql
security definer
set search_path = ''
stable
as $$
  select role from public.gym_users
  where user_id = (select auth.uid())
    and gym_id = p_gym_id
    and is_active = true
  limit 1
$$;

-- Helper: ¿es owner o admin de este gym?
create or replace function private.is_gym_admin(p_gym_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.gym_users
    where user_id = (select auth.uid())
      and gym_id = p_gym_id
      and role in ('super_admin', 'owner', 'admin')
      and is_active = true
  )
$$;

-- Trigger genérico: actualizar updated_at
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Aplicar trigger de updated_at a todas las tablas con esa columna
do $$
declare
  t text;
  tables text[] := array[
    'gyms', 'gym_users', 'gym_settings', 'instructors', 'tariffs',
    'members', 'classes', 'class_instances', 'bookings', 'payments',
    'tasks', 'conversations', 'offers', 'workouts', 'competitions',
    'shop_products', 'shop_orders', 'posts'
  ];
begin
  foreach t in array tables loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function private.set_updated_at()',
      t
    );
  end loop;
end $$;

-- Trigger: mantener booked_count en class_instances
create or replace function private.update_class_instance_counts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'confirmed' then
      update public.class_instances
      set booked_count = booked_count + 1
      where id = new.class_instance_id;
    elsif new.status = 'waitlist' then
      update public.class_instances
      set waitlist_count = waitlist_count + 1
      where id = new.class_instance_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.status != new.status then
      -- Ajustar counters según cambio de estado
      update public.class_instances
      set
        booked_count = booked_count +
          case when new.status = 'confirmed' then 1 else 0 end -
          case when old.status = 'confirmed' then 1 else 0 end,
        waitlist_count = waitlist_count +
          case when new.status = 'waitlist' then 1 else 0 end -
          case when old.status = 'waitlist' then 1 else 0 end
      where id = new.class_instance_id;
    end if;
  elsif tg_op = 'DELETE' then
    update public.class_instances
    set
      booked_count = booked_count - case when old.status = 'confirmed' then 1 else 0 end,
      waitlist_count = waitlist_count - case when old.status = 'waitlist' then 1 else 0 end
    where id = old.class_instance_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger bookings_update_counts
after insert or update or delete on public.bookings
for each row execute function private.update_class_instance_counts();

-- =============================================================================
-- FIN SCHEMA INICIAL
-- =============================================================================
-- Siguiente migración: 0002_rls_policies.sql
