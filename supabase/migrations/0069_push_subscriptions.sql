-- Migration 0069 — push_subscriptions
-- =============================================================================
-- Web Push subscriptions de socios (App PWA). Una fila por (user_id, endpoint).
-- Edge Function `send-push-notification` consume esto para entregar notificaciones.
--
-- RLS:
--   - INSERT/UPDATE/DELETE: solo el propio usuario (auth.uid() = user_id)
--   - SELECT: el propio usuario + Edge Function via service_role bypassa RLS
-- =============================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists idx_push_subscriptions_user
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists ps_select_own on public.push_subscriptions;
create policy ps_select_own on public.push_subscriptions
  for select
  using (user_id = auth.uid());

drop policy if exists ps_insert_own on public.push_subscriptions;
create policy ps_insert_own on public.push_subscriptions
  for insert
  with check (user_id = auth.uid());

drop policy if exists ps_update_own on public.push_subscriptions;
create policy ps_update_own on public.push_subscriptions
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists ps_delete_own on public.push_subscriptions;
create policy ps_delete_own on public.push_subscriptions
  for delete
  using (user_id = auth.uid());

comment on table public.push_subscriptions is 'Web Push API subscriptions per usuario. Edge Function send-push-notification entrega via VAPID.';
comment on column public.push_subscriptions.endpoint is 'URL del push service (FCM, Mozilla, Apple WebPush, etc.)';
comment on column public.push_subscriptions.p256dh is 'Public key del cliente para encriptar el payload (RFC 8291).';
comment on column public.push_subscriptions.auth_secret is 'Auth secret del cliente (RFC 8291).';
