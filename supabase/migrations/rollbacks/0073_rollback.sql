-- Rollback 0073_guest_bookings.sql
DROP FUNCTION IF EXISTS public.create_guest_booking(uuid, text, text, text, text, text, numeric);
-- Mantener columna is_guest — los datos existentes pueden depender de ella.
-- Si se quiere purgar total:
-- DROP INDEX IF EXISTS public.idx_members_gym_guest;
-- ALTER TABLE public.members DROP COLUMN IF EXISTS is_guest;
