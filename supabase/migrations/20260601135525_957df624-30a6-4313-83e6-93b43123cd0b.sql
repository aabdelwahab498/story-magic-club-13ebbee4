ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS paddle_product_id TEXT,
  ADD COLUMN IF NOT EXISTS paddle_price_id TEXT;

CREATE INDEX IF NOT EXISTS idx_products_paddle_price ON public.products(paddle_price_id);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paddle_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS paddle_checkout_id TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_paddle_tx ON public.orders(paddle_transaction_id) WHERE paddle_transaction_id IS NOT NULL;
