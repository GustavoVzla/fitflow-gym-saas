-- Rollback 0034
DROP POLICY IF EXISTS "gym_expenses_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "gym_expenses_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "gym_expenses_storage_select" ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'gym-expenses';

DROP FUNCTION IF EXISTS public.gym_expenses_kpis(uuid, date);
DROP FUNCTION IF EXISTS public.list_expenses_range(uuid, date, date, public.expense_category, text);
DROP FUNCTION IF EXISTS public.delete_expense(uuid);
DROP FUNCTION IF EXISTS public.update_expense(uuid, public.expense_category, text, text, numeric, numeric, date, text, text, text);
DROP FUNCTION IF EXISTS public.create_expense(uuid, public.expense_category, text, numeric, date, text, numeric, text, text, text);

DROP POLICY IF EXISTS "gym_expenses_delete_admin" ON public.gym_expenses;
DROP POLICY IF EXISTS "gym_expenses_update_admin" ON public.gym_expenses;
DROP POLICY IF EXISTS "gym_expenses_insert_admin" ON public.gym_expenses;
DROP POLICY IF EXISTS "gym_expenses_select_staff" ON public.gym_expenses;

DROP TABLE IF EXISTS public.gym_expenses;
DROP TYPE IF EXISTS public.expense_category;
