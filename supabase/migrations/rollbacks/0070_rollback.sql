-- Rollback 0070_gym_form_fields_custom.sql
DROP TABLE IF EXISTS public.gym_form_fields CASCADE;
DROP TYPE IF EXISTS public.form_scope;
DROP TYPE IF EXISTS public.form_field_type;
