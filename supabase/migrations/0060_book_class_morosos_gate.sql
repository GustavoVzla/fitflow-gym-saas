-- =============================================================================
-- 0060 — Gate morosos en book_class RPC + hardening del helper
-- =============================================================================
-- Contexto:
--   Migración 0058 introdujo la feature de bloqueo automático de socios morosos
--   (cron diario + cols + UI). Un comentario in-code en 0058 documentaba que
--   book_class se actualizaría para leer blocked_for_morosos_at, pero esa
--   actualización no se incluyó. Resultado: la feature era puramente cosmética
--   (UI bloquea visualmente pero un POST directo al RPC sigue reservando).
--
-- Este fix:
--   1. Re-crea public.book_class preservando el cuerpo completo (capacity,
--      waitlist, reactivación de cancelled→confirmed/waitlist del mismo socio)
--      y añade gate morosos antes del INSERT.
--   2. Endurece public.is_member_blocked_for_morosos: SECURITY INVOKER (respeta
--      RLS members) y plpgsql. Así anon/otro-gym no enumera bloqueos ajenos.
--
-- Regla de negocio del gate:
--   - Socio autenticado como sí mismo (auth.uid() == member.auth_user_id o
--     caller no tiene rol staff en el gym) → BLOQUEADO si
--     blocked_for_morosos_at IS NOT NULL.
--   - Staff (owner/admin/staff/trainer) o super-admin → SIEMPRE pueden reservar
--     en nombre del socio (flujo legítimo: cliente paga manualmente al gym,
--     staff registra la reserva aunque el socio esté marcado moroso).
--
-- Fuente:
--   - HANDOFF_SECURITY→PA_high_book-class-morosos-gate.md
--   - HANDOFF_PM→PA_book-class-morosos-gate.md
-- =============================================================================

-- 1. Re-crear book_class preservando cuerpo + gate morosos
create or replace function public.book_class(
  p_class_instance_id uuid,
  p_member_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_instance record;
  v_booking_id uuid;
  v_status public.booking_status;
  v_existing_cancelled_id uuid;
  v_member_blocked timestamptz;
  v_member_gym_id uuid;
  v_caller_role text;
  v_is_staff boolean := false;
begin
  -- -- GATE MOROSOS (nuevo) ---------------------------------------------------
  -- Cargar estado del socio (bloqueo + gym) antes del lock. Si el caller no
  -- tiene acceso RLS al member, esta lectura devuelve 0 filas → exception.
  select blocked_for_morosos_at, gym_id
    into v_member_blocked, v_member_gym_id
  from public.members
  where id = p_member_id;

  if not found then
    raise exception 'Member % not found', p_member_id using errcode = 'P0002';
  end if;

  -- Detectar si el caller es staff del gym del socio o super-admin
  if public.is_app_admin() then
    v_is_staff := true;
  else
    select role into v_caller_role
    from public.gym_users
    where user_id = auth.uid() and gym_id = v_member_gym_id
    limit 1;
    v_is_staff := v_caller_role in ('owner', 'admin', 'staff', 'trainer');
  end if;

  -- Si el socio está bloqueado por morosidad y el caller NO es staff, rechazar.
  -- Staff puede reservar en nombre del socio (flujo legítimo: cobro en
  -- recepción + reserva manual).
  if v_member_blocked is not null and not v_is_staff then
    raise exception 'Socio bloqueado por morosidad. Contacta al gimnasio.'
      using errcode = 'P0001', detail = 'member_blocked_for_morosos';
  end if;
  -- -- FIN GATE MOROSOS -------------------------------------------------------

  -- Lock para evitar race conditions
  select ci.*, c.max_spots as class_max_spots, c.waitlist_size
  into v_instance
  from public.class_instances ci
  join public.classes c on c.id = ci.class_id
  where ci.id = p_class_instance_id
  for update;

  if not found then
    raise exception 'Class instance not found' using errcode = 'P0002';
  end if;

  if v_instance.status != 'scheduled' then
    raise exception 'Class is not available for booking' using errcode = 'P0001';
  end if;

  -- Verificar si ya existe una reserva activa (confirmed/waitlist) del socio
  if exists (
    select 1 from public.bookings
    where class_instance_id = p_class_instance_id
      and member_id = p_member_id
      and status in ('confirmed', 'waitlist')
  ) then
    raise exception 'Member already has an active booking for this class'
      using errcode = '23505';
  end if;

  -- Decidir estado según capacidad
  if v_instance.booked_count < coalesce(v_instance.max_spots, v_instance.class_max_spots) then
    v_status := 'confirmed';
  elsif v_instance.waitlist_count < v_instance.waitlist_size then
    v_status := 'waitlist';
  else
    raise exception 'Class is full and waitlist is full' using errcode = 'P0001';
  end if;

  -- Buscar booking cancelado/no_show previo del mismo socio
  select id into v_existing_cancelled_id
  from public.bookings
  where class_instance_id = p_class_instance_id
    and member_id = p_member_id
    and status in ('cancelled', 'no_show')
  order by created_at desc
  limit 1;

  if v_existing_cancelled_id is not null then
    -- Reactivar booking cancelado
    update public.bookings
    set
      status = v_status,
      position_in_waitlist = case when v_status = 'waitlist' then v_instance.waitlist_count + 1 else null end,
      cancelled_at = null,
      booked_at = now(),
      updated_at = now()
    where id = v_existing_cancelled_id;
    return v_existing_cancelled_id;
  end if;

  -- Insertar nuevo booking
  insert into public.bookings (
    gym_id, class_instance_id, member_id, status,
    position_in_waitlist
  )
  values (
    v_instance.gym_id, p_class_instance_id, p_member_id, v_status,
    case when v_status = 'waitlist' then v_instance.waitlist_count + 1 else null end
  )
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

comment on function public.book_class(uuid, uuid) is
  'Reservar plaza en clase. Gate morosos: socio con blocked_for_morosos_at NO puede auto-reservar (P0001 detail=member_blocked_for_morosos). Staff (owner/admin/staff/trainer) o super-admin PUEDEN reservar en su nombre.';

-- =============================================================================
-- 2. Endurecer is_member_blocked_for_morosos: SECURITY INVOKER + plpgsql
-- =============================================================================
-- Cambio respecto a 0058:
--   - language sql -> plpgsql (necesario para semántica consistente)
--   - security definer -> security invoker (respeta RLS de members)
-- Efecto: un socio anon o de otro gym NO puede enumerar estado de bloqueo
-- de socios ajenos (la SELECT devolverá 0 filas bajo RLS → false).

create or replace function public.is_member_blocked_for_morosos(p_member_id uuid)
returns boolean
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_blocked timestamptz;
begin
  -- RLS members filtra automáticamente. Si el caller no puede leer ese member,
  -- v_blocked queda NULL y devolvemos false (sin info disclosure).
  select blocked_for_morosos_at
    into v_blocked
  from public.members
  where id = p_member_id;

  return coalesce(v_blocked is not null, false);
end;
$$;

comment on function public.is_member_blocked_for_morosos(uuid) is
  'Devuelve true si el socio esta bloqueado por morosidad. SECURITY INVOKER: respeta RLS de members (no enumera bloqueos de socios ajenos).';
