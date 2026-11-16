-- Rollback 0038_shop_products_orders
DROP TABLE IF EXISTS public.shop_order_items CASCADE;
DROP TABLE IF EXISTS public.shop_orders CASCADE;
DROP TABLE IF EXISTS public.shop_products CASCADE;
DROP FUNCTION IF EXISTS public.tg_shop_products_updated_at() CASCADE;
