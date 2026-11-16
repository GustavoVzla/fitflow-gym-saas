-- Fix: book_class ahora reactiva bookings cancelados del mismo socio+instance
-- en lugar de fallar por el constraint único (class_instance_id, member_id).
-- Caso real: socio reservó → canceló → quiere volver a reservar.

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
begin
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
