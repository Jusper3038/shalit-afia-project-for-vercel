CREATE OR REPLACE FUNCTION public.record_sale(
  p_patient_id UUID DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_recorded_at TIMESTAMPTZ DEFAULT now()
)
RETURNS SETOF public.transactions
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_drug public.drugs%ROWTYPE;
  v_quantity INTEGER;
  v_sale_timestamp TIMESTAMPTZ := COALESCE(p_recorded_at, now());
  v_sale_day DATE := timezone('Africa/Nairobi', COALESCE(p_recorded_at, now()))::date;
  v_sale_week_start DATE := (
    timezone('Africa/Nairobi', COALESCE(p_recorded_at, now()))::date
    - (
      EXTRACT(ISODOW FROM timezone('Africa/Nairobi', COALESCE(p_recorded_at, now())))::integer - 1
    )
  )::date;
  v_sale_month INTEGER := EXTRACT(MONTH FROM timezone('Africa/Nairobi', COALESCE(p_recorded_at, now())))::integer;
  v_sale_year INTEGER := EXTRACT(YEAR FROM timezone('Africa/Nairobi', COALESCE(p_recorded_at, now())))::integer;
  v_today DATE := timezone('Africa/Nairobi', now())::date;
  v_transaction public.transactions%ROWTYPE;
  v_clinic_owner_id UUID;
  v_maximum_discount_percentage NUMERIC(5,2) := 0;
  v_requested_unit_selling_price NUMERIC(10,2);
  v_protected_unit_selling_price NUMERIC(10,2);
  v_discount_amount NUMERIC(10,2);
  v_discount_percentage NUMERIC(5,2);
  v_product_key TEXT;
  v_total_requested INTEGER;
  v_remaining INTEGER;
  v_expected INTEGER;
  v_actual INTEGER;
  v_batch RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_clinic_owner_id := public.current_clinic_owner_id();

  SELECT minimum_profit_retention_percentage
  INTO v_maximum_discount_percentage
  FROM public.profiles
  WHERE user_id = v_clinic_owner_id;

  v_maximum_discount_percentage := COALESCE(v_maximum_discount_percentage, 0);

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one sale item is required';
  END IF;

  IF p_patient_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.patients
    WHERE id = p_patient_id
      AND user_id = v_clinic_owner_id
  ) THEN
    RAISE EXCEPTION 'Patient not found';
  END IF;

  -- Lock every batch for the products in this bill before calculating allocations.
  PERFORM drug.id
  FROM public.drugs drug
  WHERE drug.user_id = v_clinic_owner_id
    AND lower(btrim(drug.name)) IN (
      SELECT DISTINCT lower(btrim(selected_drug.name))
      FROM jsonb_array_elements(p_items) AS input(value)
      JOIN public.drugs selected_drug
        ON selected_drug.id = NULLIF(input.value->>'drug_id', '')::uuid
       AND selected_drug.user_id = v_clinic_owner_id
    )
  ORDER BY lower(btrim(drug.name)),
           COALESCE(drug.date_of_purchase, drug.created_at::date),
           COALESCE(drug.expiry_date, DATE '9999-12-31'),
           drug.created_at,
           drug.id
  FOR UPDATE;

  -- Require the bill to consume eligible batches in purchase-date order.
  -- Expired stock is omitted; a batch expiring today remains usable through today.
  FOR v_product_key IN
    SELECT DISTINCT lower(btrim(selected_drug.name))
    FROM jsonb_array_elements(p_items) AS input(value)
    JOIN public.drugs selected_drug
      ON selected_drug.id = NULLIF(input.value->>'drug_id', '')::uuid
     AND selected_drug.user_id = v_clinic_owner_id
  LOOP
    SELECT COALESCE(SUM(NULLIF(input.value->>'quantity', '')::integer), 0)::integer
    INTO v_total_requested
    FROM jsonb_array_elements(p_items) AS input(value)
    JOIN public.drugs selected_drug
      ON selected_drug.id = NULLIF(input.value->>'drug_id', '')::uuid
     AND selected_drug.user_id = v_clinic_owner_id
    WHERE lower(btrim(selected_drug.name)) = v_product_key;

    v_remaining := v_total_requested;

    FOR v_batch IN
      SELECT drug.id, drug.name, drug.stock_quantity
      FROM public.drugs drug
      WHERE drug.user_id = v_clinic_owner_id
        AND lower(btrim(drug.name)) = v_product_key
        AND (drug.expiry_date IS NULL OR drug.expiry_date >= v_today)
      ORDER BY COALESCE(drug.date_of_purchase, drug.created_at::date),
               COALESCE(drug.expiry_date, DATE '9999-12-31'),
               drug.created_at,
               drug.id
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_expected := LEAST(v_batch.stock_quantity, v_remaining);

      SELECT COALESCE(SUM(NULLIF(input.value->>'quantity', '')::integer), 0)::integer
      INTO v_actual
      FROM jsonb_array_elements(p_items) AS input(value)
      WHERE NULLIF(input.value->>'drug_id', '')::uuid = v_batch.id;

      IF v_actual <> v_expected THEN
        RAISE EXCEPTION 'Sell the oldest unexpired % batch first', v_batch.name;
      END IF;

      v_remaining := v_remaining - v_expected;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Insufficient unexpired stock for this product';
    END IF;
  END LOOP;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS value
  LOOP
    v_quantity := NULLIF(v_item->>'quantity', '')::integer;

    IF COALESCE(v_quantity, 0) <= 0 THEN
      RAISE EXCEPTION 'Each sale item must have a positive quantity';
    END IF;

    SELECT *
    INTO v_drug
    FROM public.drugs
    WHERE id = (v_item->>'drug_id')::uuid
      AND user_id = v_clinic_owner_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory item not found';
    END IF;

    IF v_drug.expiry_date IS NOT NULL AND v_drug.expiry_date < v_today THEN
      RAISE EXCEPTION 'Expired batches cannot be sold';
    END IF;

    IF v_drug.stock_quantity < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for %', v_drug.name;
    END IF;

    v_requested_unit_selling_price := COALESCE(
      NULLIF(v_item->>'unit_selling_price', '')::numeric,
      v_drug.selling_price
    );
    v_requested_unit_selling_price := LEAST(v_requested_unit_selling_price, v_drug.selling_price);

    v_protected_unit_selling_price := ROUND(
      GREATEST(
        v_drug.buying_price,
        v_drug.selling_price * (1 - (LEAST(GREATEST(v_maximum_discount_percentage, 0), 100) / 100.0))
      )::numeric,
      2
    );

    IF v_requested_unit_selling_price < v_protected_unit_selling_price THEN
      RAISE EXCEPTION
        'Discount too high for %. Minimum allowed selling price is KSh %.',
        v_drug.name,
        v_protected_unit_selling_price;
    END IF;

    v_discount_amount := ROUND(GREATEST(v_drug.selling_price - v_requested_unit_selling_price, 0)::numeric, 2);
    v_discount_percentage := CASE
      WHEN v_drug.selling_price > 0 THEN
        ROUND(((v_discount_amount / v_drug.selling_price) * 100)::numeric, 2)
      ELSE 0
    END;

    UPDATE public.drugs
    SET stock_quantity = stock_quantity - v_quantity
    WHERE id = v_drug.id
      AND user_id = v_clinic_owner_id;

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
      v_clinic_owner_id,
      p_patient_id,
      v_drug.id,
      v_quantity,
      v_requested_unit_selling_price * v_quantity,
      v_sale_timestamp,
      v_sale_day,
      v_sale_week_start,
      v_sale_month,
      v_sale_year,
      v_drug.buying_price,
      v_requested_unit_selling_price,
      v_drug.selling_price,
      v_discount_percentage,
      v_discount_amount
    )
    RETURNING *
    INTO v_transaction;

    RETURN NEXT v_transaction;
  END LOOP;

  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_skipping_older_inventory_batch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_movement_type TEXT := NULLIF(current_setting('shalit.movement.type', TRUE), '');
  v_today DATE := timezone('Africa/Nairobi', now())::date;
BEGIN
  IF NEW.stock_quantity >= OLD.stock_quantity THEN
    RETURN NEW;
  END IF;

  -- Manual count corrections and write-offs are not sales and may target any batch.
  IF v_movement_type IN ('correction', 'write_off') THEN
    RETURN NEW;
  END IF;

  IF OLD.expiry_date IS NOT NULL AND OLD.expiry_date < v_today THEN
    RAISE EXCEPTION 'Expired batches cannot be sold';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.drugs older
    WHERE older.user_id = OLD.user_id
      AND lower(btrim(older.name)) = lower(btrim(OLD.name))
      AND older.id <> OLD.id
      AND older.stock_quantity > 0
      AND (older.expiry_date IS NULL OR older.expiry_date >= v_today)
      AND (
        COALESCE(older.date_of_purchase, older.created_at::date)
          < COALESCE(OLD.date_of_purchase, OLD.created_at::date)
        OR (
          COALESCE(older.date_of_purchase, older.created_at::date)
            = COALESCE(OLD.date_of_purchase, OLD.created_at::date)
          AND COALESCE(older.expiry_date, DATE '9999-12-31')
            < COALESCE(OLD.expiry_date, DATE '9999-12-31')
        )
        OR (
          COALESCE(older.date_of_purchase, older.created_at::date)
            = COALESCE(OLD.date_of_purchase, OLD.created_at::date)
          AND COALESCE(older.expiry_date, DATE '9999-12-31')
            = COALESCE(OLD.expiry_date, DATE '9999-12-31')
          AND (older.created_at, older.id) < (OLD.created_at, OLD.id)
        )
      )
  ) THEN
    RAISE EXCEPTION 'Sell the oldest unexpired % batch first', OLD.name;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_skipping_older_inventory_batch() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_skipping_older_inventory_batch ON public.drugs;
CREATE TRIGGER prevent_skipping_older_inventory_batch
BEFORE UPDATE OF stock_quantity ON public.drugs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_skipping_older_inventory_batch();

NOTIFY pgrst, 'reload schema';
