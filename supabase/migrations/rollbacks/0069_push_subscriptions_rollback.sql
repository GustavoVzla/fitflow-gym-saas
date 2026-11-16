-- Rollback 0069
drop policy if exists ps_select_own on public.push_subscriptions;
drop policy if exists ps_insert_own on public.push_subscriptions;
drop policy if exists ps_update_own on public.push_subscriptions;
drop policy if exists ps_delete_own on public.push_subscriptions;
drop table if exists public.push_subscriptions;
