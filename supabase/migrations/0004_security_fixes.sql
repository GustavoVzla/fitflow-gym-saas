-- Fix 1: search_path en trigger functions
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

-- Fix 2: Eliminar policy INSERT permisiva en gyms
-- El canal oficial para crear gyms es el RPC public.create_gym_with_owner (SECURITY DEFINER).
-- Si algÃºn user intenta INSERT directo en gyms, debe fallar.
drop policy if exists "Authenticated users can create gyms" on public.gyms;

-- Nueva policy: INSERT directo prohibido (solo via RPC create_gym_with_owner que bypassea RLS)
-- No policy = deny by default. Queda documentado por quÃ©.
-- (El RPC es SECURITY DEFINER asÃ­ que bypassa RLS de todas formas, asÃ­ que eliminarla es mÃ¡s seguro.)
