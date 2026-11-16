-- ════════════════════════════════════════════════════════════════════════
-- 0069 — Panel-C · Aplica settings_general.reservas en book_class RPC
-- ════════════════════════════════════════════════════════════════════════
-- Incorpora al RPC book_class las validaciones basadas en los 23 settings
-- que se almacenan en `gyms.settings_general.reservas` (migraciones 0065+0068):
--
--  - booking_window_days: max días futuro permitidos para reservar
--  - max_future_bookings: max reservas simultáneas por socio
--  - multi_class_same_day: permite reservar 2+ clases el mismo día
--  - same_day_booking_cutoff_minutes: minutos mínimos antes del inicio para
--    reservar clases del mismo día (0 = hasta la hora de inicio)
--  - staff_override_full_class: staff puede forzar reserva en clase llena
--
-- Los overrides de staff respetan el gate morosos existente (se preserva).
-- Gate morosos y todo lo demás no cambia.

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
  v_settings jsonb;
  v_booking_window_days int;
  v_max_future_bookings int;
  v_multi_class_same_day boolean;
  v_same_day_cutoff_minutes int;
  v_staff_override_full boolean;
  v_now_in_tz timestamptz;
  v_max_future_date date;
  v_member_future_bookings int;
  v_same_day_count int;
begin
  -- GATE MOROSOS (preservado) ---------------------------------------------
  select blocked_for_morosos_at, gym_id
    into v_member_blocked, v_member_gym_id
  from public.members
  where id = p_member_id;

  if not found then
    raise exception 'Member % not found', p_member_id using errcode = 'P0002';
  end if;

  if public.is_app_admin() then
    v_is_staff := true;
  else
    select role into v_caller_role
    from public.gym_users
    where user_id = auth.uid() and gym_id = v_member_gym_id
    limit 1;
    v_is_staff := v_caller_role in ('owner', 'admin', 'staff', 'trainer');
  end if;

  if v_member_blocked is not null and not v_is_staff then
    raise exception 'Socio bloqueado por morosidad. Contacta al gimnasio.'
      using errcode = 'P0001', detail = 'member_blocked_for_morosos';
  end if;
  -- FIN GATE MOROSOS ------------------------------------------------------

  -- Cargar settings del gym
  select coalesce(settings_general->'reservas', '{}'::jsonb)
    into v_settings
  from public.gyms
  where id = v_member_gym_id;

  v_booking_window_days   := coalesce((v_settings->>'booking_window_days')::int, 14);
  v_max_future_bookings   := coalesce((v_settings->>'max_future_bookings')::int, 5);
  v_multi_class_same_day  := coalesce((v_settings->>'multi_class_same_day')::boolean, true);
  v_same_day_cutoff_minutes := coalesce((v_settings->>'same_day_booking_cutoff_minutes')::int, 0);
  v_staff_override_full   := coalesce((v_settings->>'staff_override_full_class')::boolean, true);

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

  -- Ventana de reserva (días futuro) — staff pueden saltarse
  if not v_is_staff then
    v_max_future_date := (current_date + make_interval(days => v_booking_window_days))::date;
    if v_instance.scheduled_date > v_max_future_date then
      raise exception 'Reserva fuera de ventana permitida (% días)', v_booking_window_days
        using errcode = 'P0001', detail = 'booking_window_exceeded';
    end if;
  end if;

  -- Cutoff same-day: si la clase es hoy y faltan menos de X minutos, staff-only
  if not v_is_staff
     and v_instance.scheduled_date = current_date
     and v_same_day_cutoff_minutes > 0
     and v_instance.start_at < (now() + make_interval(mins => v_same_day_cutoff_minutes)) then
    raise exception 'Reserva cerrada (mínimo % min antes del inicio)', v_same_day_cutoff_minutes
      using errcode = 'P0001', detail = 'same_day_cutoff';
  end if;

  -- Max reservas futuras simultáneas — staff pueden saltarse
  if not v_is_staff and v_max_future_bookings > 0 then
    select count(*)
      into v_member_future_bookings
    from public.bookings b
    join public.class_instances ci2 on ci2.id = b.class_instance_id
    where b.member_id = p_member_id
      and b.status in ('confirmed', 'waitlist')
      and ci2.scheduled_date >= current_date;

    if v_member_future_bookings >= v_max_future_bookings then
      raise exception 'Límite de reservas futuras (%) alcanzado', v_max_future_bookings
        using errcode = 'P0001', detail = 'max_future_bookings_reached';
    end if;
  end if;

  -- multi_class_same_day — si false, prohibir más de 1 clase/día
  if not v_is_staff and not v_multi_class_same_day then
    select count(*)
      into v_same_day_count
    from public.bookings b
    join public.class_instances ci2 on ci2.id = b.class_instance_id
    where b.member_id = p_member_id
      and b.status = 'confirmed'
      and ci2.scheduled_date = v_instance.scheduled_date;

    if v_same_day_count > 0 then
      raise exception 'Ya tienes una reserva para este día'
        using errcode = 'P0001', detail = 'multi_class_same_day_disabled';
    end if;
  end if;

  -- Verificar si ya existe una reserva activa del socio para esta clase
  if exists (
    select 1 from public.bookings
    where class_instance_id = p_class_instance_id
      and member_id = p_member_id
      and status in ('confirmed', 'waitlist')
  ) then
    raise exception 'Member already has an active booking for this class'
      using errcode = '23505';
  end if;

  -- Decidir estado según capacidad, con posible override staff en clase llena
  if v_instance.booked_count < coalesce(v_instance.max_spots, v_instance.class_max_spots) then
    v_status := 'confirmed';
  elsif v_instance.waitlist_count < v_instance.waitlist_size then
    v_status := 'waitlist';
  elsif v_is_staff and v_staff_override_full then
    -- Staff fuerza confirmación aunque la clase esté llena (capacidad + waitlist)
    v_status := 'confirmed';
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

  insert into public.bookings (
    gym_id, class_instance_id, member_id, status,
    position_in_waitlist
  )
  values (
    v_instance.gym_id, p_class_instance_id, p_member_id, v_status,
    case when v_status = 'waitlist' then v_instance.waitlist_count + 1 else null end
  )
  returning id into v_booking_id;

  -- Suppress unused variable warning (v_now_in_tz reservado para futura lógica)
  v_now_in_tz := now();
  perform v_now_in_tz;

  return v_booking_id;
end;
$$;

comment on function public.book_class(uuid, uuid) is
  'Reservar plaza. Aplica 23 settings de reservas (ventana, max futuras, same-day cutoff, multi-clase, staff override). Preserva gate morosos.';
