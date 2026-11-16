-- =============================================================================
-- FitFlow — Functions & RPCs
-- =============================================================================
-- Funciones expuestas al cliente (via supabase.rpc()) y utilidades internas
-- =============================================================================

-- =============================================================================
-- RPC: create_gym_with_owner
-- =============================================================================
-- Crea un gym nuevo Y asigna al usuario actual como owner en una sola transacción.
-- Resuelve el problema del "huevo y la gallina": la policy de gym_users requiere
-- ser admin del gym, pero sin miembros no hay admin. Esta función SECURITY DEFINER
-- bypasses RLS solo para este caso controlado.
-- =============================================================================

create or replace function public.create_gym_with_owner(
  p_name text,
  p_slug text,
  p_email text default null,
  p_phone text default null,
  p_timezone text default 'Europe/Madrid'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_gym_id uuid;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Validar slug disponible
  if exists (select 1 from public.gyms where slug = p_slug) then
    raise exception 'Slug already taken: %', p_slug using errcode = '23505';
  end if;

  -- Crear gym
  insert into public.gyms (name, slug, email, phone, timezone, status)
  values (p_name, p_slug, p_email, p_phone, p_timezone, 'trial')
  returning id into v_gym_id;

  -- Crear settings por defecto
  insert into public.gym_settings (gym_id) values (v_gym_id);

  -- Asignar al user como owner
  insert into public.gym_users (gym_id, user_id, role, is_active, accepted_at)
  values (v_gym_id, v_user_id, 'owner', true, now());

  return v_gym_id;
end;
$$;

grant execute on function public.create_gym_with_owner to authenticated;

-- =============================================================================
-- RPC: current_user_gyms
-- =============================================================================
-- Devuelve los gyms del user actual con su rol. Usado para el selector de gym.
-- =============================================================================

create or replace function public.current_user_gyms()
returns table (
  gym_id uuid,
  gym_name text,
  gym_slug text,
  gym_logo_url text,
  gym_status public.gym_status,
  role public.gym_user_role
)
language sql
security invoker
set search_path = ''
stable
as $$
  select
    g.id as gym_id,
    g.name as gym_name,
    g.slug as gym_slug,
    g.logo_url as gym_logo_url,
    g.status as gym_status,
    gu.role
  from public.gyms g
  join public.gym_users gu on gu.gym_id = g.id
  where gu.user_id = (select auth.uid())
    and gu.is_active = true
  order by g.name
$$;

grant execute on function public.current_user_gyms to authenticated;

-- =============================================================================
-- RPC: generate_class_instances
-- =============================================================================
-- Genera instancias de clase para un rango de fechas.
-- Ejecutar periódicamente (cron/edge function) o bajo demanda.
-- =============================================================================

create or replace function public.generate_class_instances(
  p_gym_id uuid,
  p_from_date date default current_date,
  p_to_date date default (current_date + interval '14 days')::date
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_class record;
  v_date date;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_timezone text;
  v_count integer := 0;
begin
  -- Verificar permisos via RLS: el user debe ser admin del gym
  if not private.is_gym_admin(p_gym_id) then
    raise exception 'Insufficient permissions' using errcode = '42501';
  end if;

  -- Obtener timezone del gym
  select timezone into v_timezone from public.gyms where id = p_gym_id;

  -- Iterar clases activas del gym
  for v_class in
    select * from public.classes
    where gym_id = p_gym_id
      and is_active = true
      and valid_from <= p_to_date
      and (valid_until is null or valid_until >= p_from_date)
  loop
    -- Iterar fechas del rango
    v_date := greatest(p_from_date, v_class.valid_from);
    while v_date <= least(p_to_date, coalesce(v_class.valid_until, p_to_date)) loop
      -- Solo si el día de semana coincide
      if extract(dow from v_date)::smallint = v_class.day_of_week then
        v_start_at := (v_date::text || ' ' || v_class.start_time::text)::timestamp at time zone v_timezone;
        v_end_at := (v_date::text || ' ' || v_class.end_time::text)::timestamp at time zone v_timezone;

        -- Insertar solo si no existe (ON CONFLICT DO NOTHING)
        insert into public.class_instances (
          gym_id, class_id, scheduled_date, start_at, end_at,
          instructor_id, room, max_spots
        )
        values (
          p_gym_id, v_class.id, v_date, v_start_at, v_end_at,
          v_class.instructor_id, v_class.room, v_class.max_spots
        )
        on conflict (class_id, scheduled_date) do nothing;

        if found then
          v_count := v_count + 1;
        end if;
      end if;

      v_date := v_date + 1;
    end loop;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.generate_class_instances to authenticated;

-- =============================================================================
-- RPC: book_class
-- =============================================================================
-- Reserva una clase de forma atómica:
--   - Verifica capacidad
--   - Si lleno, mete en waitlist
--   - Incrementa counters via trigger
-- =============================================================================

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
begin
  -- Lock pessimista para evitar race conditions en capacidad
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

  -- Decidir estado según capacidad
  if v_instance.booked_count < coalesce(v_instance.max_spots, v_instance.class_max_spots) then
    v_status := 'confirmed';
  elsif v_instance.waitlist_count < v_instance.waitlist_size then
    v_status := 'waitlist';
  else
    raise exception 'Class is full and waitlist is full' using errcode = 'P0001';
  end if;

  -- Insertar booking (trigger actualizará counters)
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

grant execute on function public.book_class to authenticated;

-- =============================================================================
-- RPC: cancel_booking
-- =============================================================================
-- Cancela reserva + promueve primer waitlist si había lista
-- =============================================================================

create or replace function public.cancel_booking(
  p_booking_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_booking record;
  v_next_waitlist uuid;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if v_booking.status = 'cancelled' then
    return; -- idempotente
  end if;

  -- Cancelar
  update public.bookings
  set status = 'cancelled',
      cancelled_at = now()
  where id = p_booking_id;

  -- Si era confirmed, promover primero de waitlist
  if v_booking.status = 'confirmed' then
    select id into v_next_waitlist
    from public.bookings
    where class_instance_id = v_booking.class_instance_id
      and status = 'waitlist'
    order by position_in_waitlist asc
    limit 1
    for update;

    if found then
      update public.bookings
      set status = 'confirmed',
          position_in_waitlist = null
      where id = v_next_waitlist;
    end if;
  end if;
end;
$$;

grant execute on function public.cancel_booking to authenticated;

-- =============================================================================
-- FIN FUNCTIONS
-- =============================================================================
