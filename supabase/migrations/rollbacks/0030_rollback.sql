-- Rollback 0030_appointments.sql

-- RPCs
DROP FUNCTION IF EXISTS public.mark_no_show_appointment(uuid);
DROP FUNCTION IF EXISTS public.complete_appointment(uuid, boolean);
DROP FUNCTION IF EXISTS public.reschedule_appointment(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.cancel_appointment_by_member(uuid, text);
DROP FUNCTION IF EXISTS public.cancel_appointment(uuid, text);
DROP FUNCTION IF EXISTS public.list_appointments_in_range(uuid, timestamptz, timestamptz, uuid);
DROP FUNCTION IF EXISTS public.create_appointment(uuid, uuid, uuid, timestamptz, timestamptz, public.appointment_type, text, text, integer);

-- Policies
DROP POLICY IF EXISTS "appointments_delete_admin" ON public.appointments;
DROP POLICY IF EXISTS "appointments_update_staff" ON public.appointments;
DROP POLICY IF EXISTS "appointments_insert_staff" ON public.appointments;
DROP POLICY IF EXISTS "appointments_select_member_own" ON public.appointments;
DROP POLICY IF EXISTS "appointments_select_staff" ON public.appointments;

DROP POLICY IF EXISTS "rooms_delete_admin" ON public.gym_rooms;
DROP POLICY IF EXISTS "rooms_update_admin" ON public.gym_rooms;
DROP POLICY IF EXISTS "rooms_insert_admin" ON public.gym_rooms;
DROP POLICY IF EXISTS "rooms_select_own_gym" ON public.gym_rooms;

-- Tablas
DROP TABLE IF EXISTS public.appointments;
DROP TABLE IF EXISTS public.gym_rooms;

-- Columna gym_settings
ALTER TABLE public.gym_settings DROP COLUMN IF EXISTS appointment_cancel_hours;

-- ENUMs
DROP TYPE IF EXISTS public.appointment_status;
DROP TYPE IF EXISTS public.appointment_type;
