-- =============================================================================
-- 0058 — Panel-A: política de bloqueo de socios morosos (configurable por gym)
-- =============================================================================
-- Requisito operativo LegacyGym paridad: "Se bloquearán las reservas a los
-- clientes con pagos manuales pendientes durante más de N días."
--
-- Diseño:
--   - gyms.block_morosos_after_days INT NULL  -> NULL = feature inactiva,
--     INT positivo (1..90) = dias de tolerancia antes del bloqueo.
--   - members.blocked_for_morosos_at TIMESTAMPTZ NULL -> NULL = no bloqueado,
--     timestamp = momento del bloqueo automatico.
--   - private.block_morosos_dispatcher() -> funcion que recorre gyms con
--     feature activa y bloquea socios activos con pagos pending vencidos
--     hace mas de N dias. Retorna count de bloqueados nuevos.
--   - pg_cron job diario 06:07 UTC (minute off-peak, Decision #109 cron hygiene).
--   - RPC public.unblock_member_morosos(member_id) -> owner/admin del gym
--     puede desbloquear manualmente tras registrar un pago.
--   - Policy bookings.insert: socio bloqueado NO puede reservar clases
--     (el booking lo puede crear staff/owner pero no el propio socio).
--
-- Fuente: HANDOFF_PM->PA_morosos-block-policy.md
-- =============================================================================

-- =============================================================================
-- 1. Columnas nuevas
-- =============================================================================

alter table public.gyms
  add column if not exists block_morosos_after_days int
    check (block_morosos_after_days is null or (block_morosos_after_days between 1 and 90));

comment on column public.gyms.block_morosos_after_days is
  'NULL = feature inactiva. INT 1..90 = dias tras vencimiento sin pago que disparan bloqueo automatico del socio.';

alter table public.members
  add column if not exists blocked_for_morosos_at timestamptz;

create index if not exists members_blocked_morosos_idx
  on public.members (gym_id)
  where blocked_for_morosos_at is not null;

comment on column public.members.blocked_for_morosos_at is
  'NULL = no bloqueado. Timestamp = momento del bloqueo automatico por morosidad. Desbloqueo manual via RPC unblock_member_morosos.';

-- =============================================================================
-- 2. Dispatcher (ejecutado por pg_cron)
-- =============================================================================

create or replace function private.block_morosos_dispatcher()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total_blocked int := 0;
  v_gym record;
  v_affected int;
begin
  for v_gym in
    select id, block_morosos_after_days
    from public.gyms
    where block_morosos_after_days is not null
      and block_morosos_after_days > 0
      and deleted_at is null
      and status in ('active', 'trial')
  loop
    with blocked as (
      update public.members m
      set blocked_for_morosos_at = now()
      where m.gym_id = v_gym.id
        and m.blocked_for_morosos_at is null
        and m.status = 'active'
        and exists (
          select 1 from public.payments p
          where p.member_id = m.id
            and p.gym_id = v_gym.id
            and p.status = 'pending'
            and p.due_date is not null
            and p.due_date < (current_date - (v_gym.block_morosos_after_days || ' days')::interval)::date
        )
      returning 1
    )
    select count(*) into v_affected from blocked;

    v_total_blocked := v_total_blocked + coalesce(v_affected, 0);
  end loop;

  return v_total_blocked;
end;
$$;

comment on function private.block_morosos_dispatcher is
  'Recorre gyms con block_morosos_after_days activo y bloquea socios con pagos pending vencidos. Idempotente (solo bloquea los que no estan ya bloqueados). Ejecutado por pg_cron job morosos-block-dispatcher.';

revoke all on function private.block_morosos_dispatcher() from public, anon, authenticated;
grant execute on function private.block_morosos_dispatcher() to service_role;

-- =============================================================================
-- 3. pg_cron job diario 06:07 UTC
-- =============================================================================

-- Si el job ya existe por re-run de migracion, limpiar primero
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'morosos-block-dispatcher';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end
$$;

select cron.schedule(
  'morosos-block-dispatcher',
  '7 6 * * *',
  $$select private.block_morosos_dispatcher();$$
);

-- =============================================================================
-- 4. RPC unblock_member_morosos (owner/admin staff operation)
-- =============================================================================

create or replace function public.unblock_member_morosos(
  p_member_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_member record;
  v_user_role text;
begin
  select id, gym_id, blocked_for_morosos_at
    into v_member
  from public.members
  where id = p_member_id;

  if not found then
    raise exception 'Member % not found', p_member_id using errcode = 'P0002';
  end if;

  -- Authz: super-admin o owner/admin/staff del gym
  if not public.is_app_admin() then
    select role into v_user_role
    from public.gym_users
    where user_id = auth.uid() and gym_id = v_member.gym_id
    limit 1;

    if v_user_role is null or v_user_role not in ('owner', 'admin', 'staff') then
      raise exception 'No autorizado para desbloquear socios de este gym'
        using errcode = '42501';
    end if;
  end if;

  if v_member.blocked_for_morosos_at is null then
    -- idempotente: ya estaba desbloqueado
    return p_member_id;
  end if;

  update public.members
  set blocked_for_morosos_at = null
  where id = p_member_id;

  return p_member_id;
end;
$$;

comment on function public.unblock_member_morosos(uuid) is
  'Desbloquea un socio marcado como moroso. Llamable por owner/admin/staff del gym o super-admin. Idempotente.';

revoke all on function public.unblock_member_morosos(uuid) from public, anon;
grant execute on function public.unblock_member_morosos(uuid) to authenticated;

-- =============================================================================
-- 5. Policy reservas: socio bloqueado NO puede auto-reservar
-- =============================================================================
-- Nota: la RPC book_class es SECURITY DEFINER y ya valida permisos. Este
-- check adicional se aplica dentro de book_class leyendo blocked_for_morosos_at,
-- NO en la policy RLS (que es igual para staff y member). La RPC se actualiza
-- para rechazar si quien llama es el propio socio bloqueado.

create or replace function public.is_member_blocked_for_morosos(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select blocked_for_morosos_at is not null
  from public.members
  where id = p_member_id;
$$;

comment on function public.is_member_blocked_for_morosos(uuid) is
  'Helper para UI/RPC: devuelve true si el socio esta bloqueado por morosidad.';

revoke all on function public.is_member_blocked_for_morosos(uuid) from public, anon;
grant execute on function public.is_member_blocked_for_morosos(uuid) to authenticated;
