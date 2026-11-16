-- =============================================================================
-- 0074 — PD paridad 100%: /tienda extend shop_products
--
-- Contexto: audit delta LIVE /tienda confirma 3 tabs (Productos/Categorías/Ventas)
-- funcionales. Form producto actual tiene 5 campos básicos (name, description,
-- price, stock, category). Handoff PM pide extender con:
--   - cost_price_cents (margen calculable)
--   - stock_min (alerta cuando stock <= min)
--   - barcode (EAN-13 o similar)
--   - attributes JSONB (talla, color, etc.)
--
-- Decisiones:
--   - Columnas NULLABLE (retrocompat — productos existentes no requieren update)
--   - cost_price INTEGER cents (no NUMERIC — alineado con price_cents de payments)
--   - barcode VARCHAR(32) suficiente para EAN-13, UPC-A, Code128
--   - attributes JSONB DEFAULT '{}' vacío para UI genérica
-- =============================================================================

ALTER TABLE public.shop_products
  ADD COLUMN IF NOT EXISTS cost_price_cents integer
    CHECK (cost_price_cents IS NULL OR cost_price_cents >= 0),
  ADD COLUMN IF NOT EXISTS stock_min integer
    CHECK (stock_min IS NULL OR stock_min >= 0),
  ADD COLUMN IF NOT EXISTS barcode varchar(32),
  ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Índice único barcode per-gym si se establece (evita duplicados escaneo)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_shop_products_gym_barcode
  ON public.shop_products(gym_id, barcode)
  WHERE barcode IS NOT NULL;

COMMENT ON COLUMN public.shop_products.cost_price_cents IS
  'Precio de compra en céntimos. Permite calcular margen (price - cost).';
COMMENT ON COLUMN public.shop_products.stock_min IS
  'Stock mínimo para alerta reposición. NULL = sin alerta.';
COMMENT ON COLUMN public.shop_products.barcode IS
  'Código de barras EAN-13 o similar. Único per-gym.';
COMMENT ON COLUMN public.shop_products.attributes IS
  'Atributos libres JSONB: talla, color, material, etc. Schema flexible por gym.';
