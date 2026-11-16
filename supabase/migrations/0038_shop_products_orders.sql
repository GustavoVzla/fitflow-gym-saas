-- ════════════════════════════════════════════════════════════════════════
-- Migración 0038: shop_products + shop_orders + shop_order_items (Tienda Base)
-- ════════════════════════════════════════════════════════════════════════
-- Paridad LegacyGym /shop. Sin gateway pago integrado (Base manual).
-- RLS multi-tenant desde día 1.

CREATE TABLE IF NOT EXISTS public.shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  description text,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category text,
  is_active boolean NOT NULL DEFAULT true,
  image_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_products_gym_active ON public.shop_products(gym_id, is_active);
CREATE INDEX IF NOT EXISTS idx_shop_products_category ON public.shop_products(gym_id, category) WHERE category IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  total numeric(10,2) NOT NULL CHECK (total >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled','refunded')),
  payment_method text CHECK (payment_method IN ('cash','card','transfer','manual')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_shop_orders_gym ON public.shop_orders(gym_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.shop_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.shop_products(id) ON DELETE SET NULL,
  product_name_snapshot text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL CHECK (unit_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_shop_order_items_order ON public.shop_order_items(order_id);

CREATE OR REPLACE FUNCTION public.tg_shop_products_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shop_products_updated_at ON public.shop_products;
CREATE TRIGGER shop_products_updated_at
  BEFORE UPDATE ON public.shop_products
  FOR EACH ROW EXECUTE FUNCTION public.tg_shop_products_updated_at();

ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY shop_products_staff_select ON public.shop_products
  FOR SELECT TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY shop_products_staff_insert ON public.shop_products
  FOR INSERT TO authenticated
  WITH CHECK (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY shop_products_staff_update ON public.shop_products
  FOR UPDATE TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()))
  WITH CHECK (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY shop_products_staff_delete ON public.shop_products
  FOR DELETE TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY shop_orders_staff_select ON public.shop_orders
  FOR SELECT TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY shop_orders_staff_insert ON public.shop_orders
  FOR INSERT TO authenticated
  WITH CHECK (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY shop_orders_staff_update ON public.shop_orders
  FOR UPDATE TO authenticated
  USING (gym_id IN (SELECT gym_id FROM public.current_user_gyms()))
  WITH CHECK (gym_id IN (SELECT gym_id FROM public.current_user_gyms()));

CREATE POLICY shop_order_items_staff_select ON public.shop_order_items
  FOR SELECT TO authenticated
  USING (order_id IN (
    SELECT id FROM public.shop_orders
    WHERE gym_id IN (SELECT gym_id FROM public.current_user_gyms())
  ));

CREATE POLICY shop_order_items_staff_insert ON public.shop_order_items
  FOR INSERT TO authenticated
  WITH CHECK (order_id IN (
    SELECT id FROM public.shop_orders
    WHERE gym_id IN (SELECT gym_id FROM public.current_user_gyms())
  ));
