-- Rollback 0033 — quitar policies anon read
DROP POLICY IF EXISTS "gym_rooms_public_read_active" ON public.gym_rooms;
DROP POLICY IF EXISTS "instructors_public_read_active" ON public.instructors;
DROP POLICY IF EXISTS "tariffs_public_read_active" ON public.tariffs;
DROP POLICY IF EXISTS "class_instances_public_read_scheduled" ON public.class_instances;
DROP POLICY IF EXISTS "classes_public_read_active" ON public.classes;
DROP POLICY IF EXISTS "gyms_public_read_active" ON public.gyms;
