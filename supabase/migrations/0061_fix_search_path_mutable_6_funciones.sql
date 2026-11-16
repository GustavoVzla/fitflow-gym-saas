-- HIGH security defense-in-depth: fix search_path mutable en 6 funciones public
-- Supabase advisor lint 0011_function_search_path_mutable
-- Coherente con patron existente en dispatch_pending_avisos + book_class (search_path = '')

ALTER FUNCTION public.convert_prospect_to_member(uuid, uuid)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.tg_prospects_updated_at() SET search_path = '';
ALTER FUNCTION public.tg_families_updated_at() SET search_path = '';
ALTER FUNCTION public.tg_training_groups_updated_at() SET search_path = '';
ALTER FUNCTION public.tg_engagement_alerts_updated_at() SET search_path = '';
ALTER FUNCTION public.tg_shop_products_updated_at() SET search_path = '';
