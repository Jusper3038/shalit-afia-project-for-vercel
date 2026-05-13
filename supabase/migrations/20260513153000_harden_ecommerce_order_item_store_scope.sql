DROP POLICY IF EXISTS "Public can create ecommerce order items" ON public.ecommerce_order_items;

CREATE POLICY "Public can create ecommerce order items"
ON public.ecommerce_order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.ecommerce_orders orders
    JOIN public.ecommerce_stores store
      ON store.id = orders.store_id
    WHERE orders.id = ecommerce_order_items.order_id
      AND store.status = 'published'
      AND (
        ecommerce_order_items.product_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.ecommerce_products product
          WHERE product.id = ecommerce_order_items.product_id
            AND product.store_id = orders.store_id
            AND product.is_active = true
        )
      )
  )
);

CREATE OR REPLACE FUNCTION public.complete_ecommerce_order(p_order_id UUID)
RETURNS public.ecommerce_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.ecommerce_orders%ROWTYPE;
  v_store public.ecommerce_stores%ROWTYPE;
  v_item public.ecommerce_order_items%ROWTYPE;
  v_product public.ecommerce_products%ROWTYPE;
  v_drug public.drugs%ROWTYPE;
  v_completed_at TIMESTAMPTZ := now();
  v_sale_day DATE := timezone('Africa/Nairobi', v_completed_at)::date;
  v_sale_week_start DATE := (
    timezone('Africa/Nairobi', v_completed_at)::date
    - (
      EXTRACT(ISODOW FROM timezone('Africa/Nairobi', v_completed_at))::integer - 1
    )
  )::date;
  v_sale_month INTEGER := EXTRACT(MONTH FROM timezone('Africa/Nairobi', v_completed_at))::integer;
  v_sale_year INTEGER := EXTRACT(YEAR FROM timezone('Africa/Nairobi', v_completed_at))::integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO v_order
  FROM public.ecommerce_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ecommerce order not found';
  END IF;

  SELECT *
  INTO v_store
  FROM public.ecommerce_stores
  WHERE id = v_order.store_id;

  IF NOT FOUND OR v_store.owner_user_id <> public.current_clinic_owner_id() THEN
    RAISE EXCEPTION 'You cannot manage this ecommerce order';
  END IF;

  IF v_order.status = 'completed' AND v_order.stock_deducted_at IS NOT NULL AND v_order.dashboard_recorded_at IS NOT NULL THEN
    RETURN v_order;
  END IF;

  IF v_order.stock_deducted_at IS NULL THEN
    FOR v_item IN
      SELECT *
      FROM public.ecommerce_order_items
      WHERE order_id = v_order.id
      ORDER BY created_at ASC
    LOOP
      IF v_item.product_id IS NOT NULL THEN
        SELECT *
        INTO v_product
        FROM public.ecommerce_products
        WHERE id = v_item.product_id
        FOR UPDATE;

        IF NOT FOUND OR v_product.store_id <> v_order.store_id THEN
          RAISE EXCEPTION 'Order item product does not belong to this store';
        END IF;

        IF v_product.track_inventory AND v_product.stock_quantity < v_item.quantity THEN
          RAISE EXCEPTION 'Insufficient ecommerce stock for %', v_item.product_name;
        END IF;

        IF v_product.track_inventory THEN
          UPDATE public.ecommerce_products
          SET stock_quantity = stock_quantity - v_item.quantity
          WHERE id = v_product.id
            AND store_id = v_order.store_id;
        END IF;

        IF v_product.inventory_drug_id IS NOT NULL THEN
          SELECT *
          INTO v_drug
          FROM public.drugs
          WHERE id = v_product.inventory_drug_id
            AND user_id = v_store.owner_user_id
          FOR UPDATE;

          IF FOUND THEN
            IF v_drug.stock_quantity < v_item.quantity THEN
              RAISE EXCEPTION 'Insufficient pharmacy stock for %', v_drug.name;
            END IF;

            UPDATE public.drugs
            SET stock_quantity = stock_quantity - v_item.quantity
            WHERE id = v_drug.id
              AND user_id = v_store.owner_user_id;
          END IF;
        END IF;
      END IF;
    END LOOP;

    UPDATE public.ecommerce_orders
    SET stock_deducted_at = v_completed_at
    WHERE id = v_order.id
    RETURNING * INTO v_order;
  END IF;

  IF v_order.dashboard_recorded_at IS NULL THEN
    FOR v_item IN
      SELECT *
      FROM public.ecommerce_order_items
      WHERE order_id = v_order.id
      ORDER BY created_at ASC
    LOOP
      v_product := NULL;
      v_drug := NULL;

      IF v_item.product_id IS NOT NULL THEN
        SELECT *
        INTO v_product
        FROM public.ecommerce_products
        WHERE id = v_item.product_id;

        IF NOT FOUND OR v_product.store_id <> v_order.store_id THEN
          RAISE EXCEPTION 'Order item product does not belong to this store';
        END IF;

        IF v_product.inventory_drug_id IS NOT NULL THEN
          SELECT *
          INTO v_drug
          FROM public.drugs
          WHERE id = v_product.inventory_drug_id
            AND user_id = v_store.owner_user_id;
        END IF;
      END IF;

      INSERT INTO public.transactions (
        user_id,
        patient_id,
        drug_id,
        quantity,
        total_cost,
        date,
        sale_day,
        sale_week_start,
        sale_month,
        sale_year,
        unit_buying_price,
        unit_selling_price,
        unit_list_price,
        discount_percentage,
        discount_amount
      )
      VALUES (
        v_store.owner_user_id,
        NULL,
        CASE WHEN v_drug.id IS NOT NULL THEN v_drug.id ELSE NULL END,
        v_item.quantity,
        v_item.total_price,
        v_completed_at,
        v_sale_day,
        v_sale_week_start,
        v_sale_month,
        v_sale_year,
        COALESCE(v_drug.buying_price, 0),
        v_item.unit_price,
        v_item.unit_price,
        0,
        0
      );
    END LOOP;

    UPDATE public.ecommerce_orders
    SET dashboard_recorded_at = v_completed_at
    WHERE id = v_order.id
    RETURNING * INTO v_order;
  END IF;

  UPDATE public.ecommerce_orders
  SET status = 'completed',
      payment_status = CASE
        WHEN payment_method = 'cash' THEN payment_status
        ELSE payment_status
      END
  WHERE id = v_order.id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;
