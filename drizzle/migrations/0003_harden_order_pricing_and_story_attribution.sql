-- 1) Stories: editors cannot attribute stories to arbitrary users
DROP POLICY IF EXISTS "Editors create stories" ON public.stories;
CREATE POLICY "Editors create stories"
ON public.stories
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'editor'::app_role)
  AND (created_by IS NULL OR created_by = auth.uid())
);

-- 2) Orders: totals derived server-side, never trusted from the client
CREATE OR REPLACE FUNCTION public.force_order_total_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- Customers may not choose their own total; it is recomputed from order items.
  NEW.total_amount := 0;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_force_order_total_on_insert ON public.orders;
CREATE TRIGGER trg_force_order_total_on_insert
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.force_order_total_on_insert();

-- Allow the server-side recalculation to update total_amount
CREATE OR REPLACE FUNCTION public.guard_orders_owner_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin')
     OR coalesce(current_setting('app.order_total_recalc', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.payment_request_id IS DISTINCT FROM OLD.payment_request_id
     OR NEW.paddle_transaction_id IS DISTINCT FROM OLD.paddle_transaction_id
     OR NEW.paddle_checkout_id IS DISTINCT FROM OLD.paddle_checkout_id
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.fulfillment_status IS DISTINCT FROM OLD.fulfillment_status
     OR NEW.fulfilled_at IS DISTINCT FROM OLD.fulfilled_at
     OR NEW.fulfilled_by IS DISTINCT FROM OLD.fulfilled_by
     OR NEW.admin_note IS DISTINCT FROM OLD.admin_note
     OR NEW.shipping_status IS DISTINCT FROM OLD.shipping_status
     OR NEW.tracking_number IS DISTINCT FROM OLD.tracking_number
     OR NEW.tracking_carrier IS DISTINCT FROM OLD.tracking_carrier
     OR NEW.shipped_at IS DISTINCT FROM OLD.shipped_at
     OR NEW.delivered_at IS DISTINCT FROM OLD.delivered_at THEN
    RAISE EXCEPTION 'Only shipping details and notes can be modified on a pending order';
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Order items: unit price and currency come from the products table
CREATE OR REPLACE FUNCTION public.enforce_order_item_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_price NUMERIC;
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = NEW.order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'Cannot modify items of an order that is not pending';
  END IF;

  IF NEW.quantity IS NULL OR NEW.quantity < 1 OR NEW.quantity > 100 THEN
    RAISE EXCEPTION 'Invalid quantity';
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = NEW.product_id AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found or inactive';
  END IF;

  v_price := CASE v_order.currency
    WHEN 'EGP' THEN v_product.price_egp
    WHEN 'USD' THEN v_product.price_usd
    WHEN 'EUR' THEN v_product.price_eur
  END;
  IF v_price IS NULL OR v_price <= 0 THEN
    RAISE EXCEPTION 'Product has no price in %', v_order.currency;
  END IF;

  -- Authoritative values, regardless of what the client submitted
  NEW.unit_price := v_price;
  NEW.currency := v_order.currency;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_item_pricing ON public.order_items;
CREATE TRIGGER trg_enforce_order_item_pricing
BEFORE INSERT OR UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_item_pricing();

CREATE OR REPLACE FUNCTION public.recalc_order_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id uuid := coalesce(NEW.order_id, OLD.order_id);
  v_total NUMERIC;
BEGIN
  SELECT coalesce(sum(unit_price * quantity), 0) INTO v_total
    FROM public.order_items WHERE order_id = v_order_id;

  PERFORM set_config('app.order_total_recalc', 'on', true);
  UPDATE public.orders SET total_amount = v_total WHERE id = v_order_id;
  PERFORM set_config('app.order_total_recalc', 'off', true);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_order_total ON public.order_items;
CREATE TRIGGER trg_recalc_order_total
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.recalc_order_total();