-- Inventory schema sync for Supabase project fkfjwnzdnsjpyfsvgurk.

-- Run the full script in the target project SQL Editor.

-- This adds/replaces inventory schema objects and functions; it does not drop existing client/data tables.

-- The FIFO step replaces public.record_sale and changes stock-sale ordering rules.

BEGIN;

-- Batch metadata columns (20260413124500_add_drug_inventory_fields.sql)

ALTER TABLE public.drugs
ADD COLUMN IF NOT EXISTS expiry_date DATE,
ADD COLUMN IF NOT EXISTS serial_number TEXT,
ADD COLUMN IF NOT EXISTS date_of_purchase DATE;


-- Inventory batches and stock history (20261126090000_add_inventory_batches_and_movement_history.sql)

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drug_id UUID REFERENCES public.drugs(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  batch_number TEXT,
  expiry_date DATE,
  movement_type TEXT NOT NULL CHECK (
    movement_type IN ('opening_balance', 'delivery', 'correction', 'write_off', 'sale')
  ),
  quantity_change INTEGER NOT NULL CHECK (quantity_change <> 0),
  quantity_before INTEGER NOT NULL CHECK (quantity_before >= 0),
  quantity_after INTEGER NOT NULL CHECK (quantity_after >= 0),
  unit_buying_price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (unit_buying_price >= 0),
  reason TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (quantity_after = quantity_before + quantity_change)
);

CREATE INDEX IF NOT EXISTS inventory_movements_user_created_at_idx
  ON public.inventory_movements (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS inventory_movements_drug_created_at_idx
  ON public.inventory_movements (drug_id, created_at DESC);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic members can view inventory movements" ON public.inventory_movements;
CREATE POLICY "Clinic members can view inventory movements"
ON public.inventory_movements
FOR SELECT
USING (public.can_access_clinic_user(user_id));

REVOKE ALL ON public.inventory_movements FROM anon, authenticated;
GRANT SELECT ON public.inventory_movements TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_clinic_inventory()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE user_id = auth.uid()
          AND COALESCE(allowed_apps, ARRAY[]::TEXT[]) @> ARRAY['inventory']::TEXT[]
      )
    )
$$;

REVOKE ALL ON FUNCTION public.can_manage_clinic_inventory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_clinic_inventory() TO authenticated;

INSERT INTO public.inventory_movements (
  user_id,
  drug_id,
  product_name,
  batch_number,
  expiry_date,
  movement_type,
  quantity_change,
  quantity_before,
  quantity_after,
  unit_buying_price,
  reason
)
SELECT
  drugs.user_id,
  drugs.id,
  drugs.name,
  drugs.serial_number,
  drugs.expiry_date,
  'opening_balance',
  drugs.stock_quantity,
  0,
  drugs.stock_quantity,
  drugs.buying_price,
  'Opening stock when movement history was enabled'
FROM public.drugs
WHERE drugs.stock_quantity > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.inventory_movements movement
    WHERE movement.drug_id = drugs.id
      AND movement.movement_type = 'opening_balance'
  );

CREATE OR REPLACE FUNCTION public.capture_inventory_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quantity_before INTEGER;
  v_quantity_change INTEGER;
  v_movement_type TEXT;
  v_reason TEXT;
  v_actor_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_quantity_before := 0;
    v_quantity_change := NEW.stock_quantity;
    IF v_quantity_change <= 0 THEN
      RETURN NEW;
    END IF;
    v_movement_type := COALESCE(NULLIF(current_setting('shalit.movement.type', TRUE), ''), 'delivery');
    v_reason := COALESCE(NULLIF(current_setting('shalit.movement.reason', TRUE), ''), 'New batch received');
  ELSE
    v_quantity_before := OLD.stock_quantity;
    v_quantity_change := NEW.stock_quantity - OLD.stock_quantity;
    IF v_quantity_change = 0 THEN
      RETURN NEW;
    END IF;
    v_movement_type := COALESCE(NULLIF(current_setting('shalit.movement.type', TRUE), ''), 'correction');
    v_reason := COALESCE(NULLIF(current_setting('shalit.movement.reason', TRUE), ''), 'Stock count changed outside the movement form');
  END IF;

  IF v_movement_type NOT IN ('delivery', 'correction', 'write_off', 'sale') THEN
    v_movement_type := 'correction';
  END IF;

  SELECT NULLIF(trim(profile.name), '')
  INTO v_actor_name
  FROM public.profiles profile
  WHERE profile.user_id = auth.uid();

  INSERT INTO public.inventory_movements (
    user_id,
    drug_id,
    product_name,
    batch_number,
    expiry_date,
    movement_type,
    quantity_change,
    quantity_before,
    quantity_after,
    unit_buying_price,
    reason,
    created_by,
    created_by_name
  )
  VALUES (
    NEW.user_id,
    NEW.id,
    NEW.name,
    NEW.serial_number,
    NEW.expiry_date,
    v_movement_type,
    v_quantity_change,
    v_quantity_before,
    NEW.stock_quantity,
    NEW.buying_price,
    v_reason,
    auth.uid(),
    v_actor_name
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_inventory_stock_movement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS capture_inventory_stock_movement ON public.drugs;
CREATE TRIGGER capture_inventory_stock_movement
AFTER INSERT OR UPDATE OF stock_quantity ON public.drugs
FOR EACH ROW
EXECUTE FUNCTION public.capture_inventory_stock_movement();

CREATE OR REPLACE FUNCTION public.prevent_deleting_stocked_batch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.stock_quantity > 0 THEN
    RAISE EXCEPTION 'Write off or move the remaining stock before deleting this batch';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_deleting_stocked_batch() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_deleting_stocked_batch ON public.drugs;
CREATE TRIGGER prevent_deleting_stocked_batch
BEFORE DELETE ON public.drugs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_deleting_stocked_batch();

CREATE OR REPLACE FUNCTION public.add_inventory_batch(
  p_name TEXT,
  p_serial_number TEXT DEFAULT NULL,
  p_expiry_date DATE DEFAULT NULL,
  p_date_of_purchase DATE DEFAULT NULL,
  p_buying_price NUMERIC DEFAULT 0,
  p_selling_price NUMERIC DEFAULT 0,
  p_stock_quantity INTEGER DEFAULT 0,
  p_low_stock_threshold INTEGER DEFAULT 10,
  p_reason TEXT DEFAULT 'New batch received'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_drug_id UUID;
  v_name TEXT := trim(COALESCE(p_name, ''));
  v_reason TEXT := trim(COALESCE(p_reason, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.can_manage_clinic_inventory() THEN
    RAISE EXCEPTION 'Inventory permission is required';
  END IF;

  IF v_name = '' THEN
    RAISE EXCEPTION 'Product name is required';
  END IF;
  IF char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'Product name must be 120 characters or fewer';
  END IF;
  IF p_buying_price IS NULL OR p_buying_price < 0 OR p_selling_price IS NULL OR p_selling_price < p_buying_price THEN
    RAISE EXCEPTION 'Selling price must be at least the non-negative buying price';
  END IF;
  IF p_stock_quantity IS NULL OR p_stock_quantity < 0 OR p_low_stock_threshold IS NULL OR p_low_stock_threshold < 0 THEN
    RAISE EXCEPTION 'Stock and low-stock threshold must be non-negative whole numbers';
  END IF;
  IF p_expiry_date IS NOT NULL AND p_date_of_purchase IS NOT NULL AND p_date_of_purchase > p_expiry_date THEN
    RAISE EXCEPTION 'Date of purchase cannot be after expiry date';
  END IF;
  IF char_length(v_reason) < 3 OR char_length(v_reason) > 240 THEN
    RAISE EXCEPTION 'Add a short delivery or opening-stock note';
  END IF;
  IF char_length(COALESCE(p_serial_number, '')) > 120 THEN
    RAISE EXCEPTION 'Batch number must be 120 characters or fewer';
  END IF;

  v_owner_id := public.current_clinic_owner_id();
  IF NOT public.can_access_clinic_user(v_owner_id) THEN
    RAISE EXCEPTION 'You cannot manage this clinic inventory';
  END IF;

  PERFORM set_config('shalit.movement.type', 'delivery', TRUE);
  PERFORM set_config('shalit.movement.reason', v_reason, TRUE);

  INSERT INTO public.drugs (
    user_id,
    name,
    serial_number,
    expiry_date,
    date_of_purchase,
    buying_price,
    selling_price,
    stock_quantity,
    low_stock_threshold
  )
  VALUES (
    v_owner_id,
    v_name,
    NULLIF(trim(COALESCE(p_serial_number, '')), ''),
    p_expiry_date,
    p_date_of_purchase,
    p_buying_price,
    p_selling_price,
    p_stock_quantity,
    p_low_stock_threshold
  )
  RETURNING id INTO v_drug_id;

  RETURN v_drug_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_inventory_stock_change(
  p_drug_id UUID,
  p_movement_type TEXT,
  p_quantity INTEGER,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_drug public.drugs%ROWTYPE;
  v_delta INTEGER;
  v_reason TEXT := trim(COALESCE(p_reason, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.can_manage_clinic_inventory() THEN
    RAISE EXCEPTION 'Inventory permission is required';
  END IF;
  IF p_movement_type IS NULL OR p_movement_type NOT IN ('delivery', 'correction', 'write_off') THEN
    RAISE EXCEPTION 'Unsupported inventory movement type';
  END IF;
  IF p_quantity IS NULL OR p_quantity = 0 THEN
    RAISE EXCEPTION 'Movement quantity cannot be zero';
  END IF;
  IF p_movement_type IN ('delivery', 'write_off') AND p_quantity < 0 THEN
    RAISE EXCEPTION 'Enter a positive quantity for deliveries and write-offs';
  END IF;
  IF char_length(v_reason) < 3 OR char_length(v_reason) > 240 THEN
    RAISE EXCEPTION 'A reason is required for every stock movement';
  END IF;

  v_owner_id := public.current_clinic_owner_id();
  IF NOT public.can_access_clinic_user(v_owner_id) THEN
    RAISE EXCEPTION 'You cannot manage this clinic inventory';
  END IF;

  SELECT * INTO v_drug
  FROM public.drugs
  WHERE id = p_drug_id AND user_id = v_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory batch not found';
  END IF;

  v_delta := CASE WHEN p_movement_type = 'write_off' THEN -p_quantity ELSE p_quantity END;
  IF v_drug.stock_quantity + v_delta < 0 THEN
    RAISE EXCEPTION 'The movement cannot reduce stock below zero';
  END IF;

  PERFORM set_config('shalit.movement.type', p_movement_type, TRUE);
  PERFORM set_config('shalit.movement.reason', v_reason, TRUE);

  UPDATE public.drugs
  SET stock_quantity = stock_quantity + v_delta
  WHERE id = v_drug.id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_inventory_batch(TEXT, TEXT, DATE, DATE, NUMERIC, NUMERIC, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_inventory_stock_change(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_inventory_batch(TEXT, TEXT, DATE, DATE, NUMERIC, NUMERIC, INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_inventory_stock_change(UUID, TEXT, INTEGER, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.classify_inventory_sale_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.drug_id IS NULL OR NEW.quantity <= 0 THEN
    RETURN NEW;
  END IF;

  UPDATE public.inventory_movements
  SET movement_type = 'sale',
      reason = 'Stock sold and recorded as a transaction'
  WHERE id = (
    SELECT movement.id
    FROM public.inventory_movements movement
    WHERE movement.drug_id = NEW.drug_id
      AND movement.user_id = NEW.user_id
      AND movement.movement_type = 'correction'
      AND movement.quantity_change = -NEW.quantity
      AND movement.created_at = NEW.created_at
    ORDER BY movement.id DESC
    LIMIT 1
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.classify_inventory_sale_movement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS classify_inventory_sale_movement ON public.transactions;
CREATE TRIGGER classify_inventory_sale_movement
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.classify_inventory_sale_movement();

NOTIFY pgrst, 'reload schema';


-- FIFO stock-sale enforcement (20261126100000_enforce_oldest_batch_first.sql)

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


-- OCR multi-batch RPC (20261126110000_add_inventory_invoice_batch_rpc.sql)

CREATE OR REPLACE FUNCTION public.add_inventory_batches(
  p_batches JSONB,
  p_reason TEXT DEFAULT 'Supplier invoice import'
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch JSONB;
  v_ids UUID[] := ARRAY[]::UUID[];
  v_id UUID;
  v_reason TEXT := trim(COALESCE(p_reason, ''));
  v_name TEXT;
  v_serial_number TEXT;
  v_expiry_date DATE;
  v_date_of_purchase DATE;
  v_buying_price NUMERIC;
  v_selling_price NUMERIC;
  v_stock_quantity INTEGER;
  v_low_stock_threshold INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.can_manage_clinic_inventory() THEN
    RAISE EXCEPTION 'Inventory permission is required';
  END IF;
  IF jsonb_typeof(p_batches) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_batches) < 1
    OR jsonb_array_length(p_batches) > 100 THEN
    RAISE EXCEPTION 'Provide between 1 and 100 invoice items';
  END IF;
  IF char_length(v_reason) < 3 OR char_length(v_reason) > 240 THEN
    RAISE EXCEPTION 'Add a short invoice reference or note';
  END IF;

  FOR v_batch IN SELECT value FROM jsonb_array_elements(p_batches) AS value
  LOOP
    v_name := trim(COALESCE(v_batch->>'name', ''));
    v_serial_number := NULLIF(trim(COALESCE(v_batch->>'serial_number', '')), '');
    v_expiry_date := NULLIF(v_batch->>'expiry_date', '')::DATE;
    v_date_of_purchase := NULLIF(v_batch->>'date_of_purchase', '')::DATE;
    v_buying_price := NULLIF(v_batch->>'buying_price', '')::NUMERIC;
    v_selling_price := NULLIF(v_batch->>'selling_price', '')::NUMERIC;
    v_stock_quantity := NULLIF(v_batch->>'stock_quantity', '')::INTEGER;
    v_low_stock_threshold := COALESCE(NULLIF(v_batch->>'low_stock_threshold', '')::INTEGER, 10);

    IF v_name = '' OR char_length(v_name) > 120 THEN
      RAISE EXCEPTION 'Every invoice item needs a product name of 120 characters or fewer';
    END IF;
    IF v_buying_price IS NULL OR v_buying_price < 0
      OR v_selling_price IS NULL OR v_selling_price < v_buying_price THEN
      RAISE EXCEPTION 'Selling price must be at least the non-negative buying price for %', v_name;
    END IF;
    IF COALESCE(v_stock_quantity, 0) < 1 OR COALESCE(v_low_stock_threshold, -1) < 0 THEN
      RAISE EXCEPTION 'Enter a positive whole-number quantity and a non-negative stock threshold for %', v_name;
    END IF;
    IF v_expiry_date IS NOT NULL AND v_date_of_purchase IS NOT NULL AND v_date_of_purchase > v_expiry_date THEN
      RAISE EXCEPTION 'Purchase date cannot be after expiry date for %', v_name;
    END IF;
    IF char_length(COALESCE(v_serial_number, '')) > 120 THEN
      RAISE EXCEPTION 'Batch number must be 120 characters or fewer for %', v_name;
    END IF;

    v_id := public.add_inventory_batch(
      p_name := v_name,
      p_serial_number := v_serial_number,
      p_expiry_date := v_expiry_date,
      p_date_of_purchase := v_date_of_purchase,
      p_buying_price := v_buying_price,
      p_selling_price := v_selling_price,
      p_stock_quantity := v_stock_quantity,
      p_low_stock_threshold := v_low_stock_threshold,
      p_reason := v_reason
    );
    v_ids := array_append(v_ids, v_id);
  END LOOP;

  RETURN v_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.add_inventory_batches(JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_inventory_batches(JSONB, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- Inventory lookup index (20261126120000_add_inventory_lookup_index.sql)

CREATE INDEX IF NOT EXISTS drugs_user_created_at_idx
  ON public.drugs (user_id, created_at DESC);


-- Row-validated OCR multi-batch RPC (20261126130000_rewrite_inventory_invoice_batch_rpc.sql)

CREATE OR REPLACE FUNCTION public.add_inventory_batches(
  p_batches JSONB,
  p_reason TEXT DEFAULT 'Supplier invoice import'
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_ids UUID[] := ARRAY[]::UUID[];
  v_id UUID;
  v_reason TEXT := trim(COALESCE(p_reason, ''));
  v_row_number INTEGER := 0;
  v_batch_count INTEGER;
  v_name TEXT;
  v_serial_number TEXT;
  v_expiry_date DATE;
  v_date_of_purchase DATE;
  v_buying_price NUMERIC;
  v_selling_price NUMERIC;
  v_stock_quantity INTEGER;
  v_low_stock_threshold INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.can_manage_clinic_inventory() THEN
    RAISE EXCEPTION 'Inventory permission is required';
  END IF;

  IF p_batches IS NULL OR jsonb_typeof(p_batches) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invoice batches must be sent as a JSON array';
  END IF;
  v_batch_count := jsonb_array_length(p_batches);
  IF v_batch_count < 1 OR v_batch_count > 100 THEN
    RAISE EXCEPTION 'Provide between 1 and 100 invoice items';
  END IF;
  IF char_length(v_reason) < 3 OR char_length(v_reason) > 240 THEN
    RAISE EXCEPTION 'Add a short invoice reference or note';
  END IF;

  FOR v_item IN
    SELECT item.value
    FROM jsonb_array_elements(p_batches) AS item(value)
  LOOP
    v_row_number := v_row_number + 1;
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Invoice row % must be a JSON object', v_row_number;
    END IF;

    BEGIN
      v_name := trim(COALESCE(v_item->>'name', ''));
      v_serial_number := NULLIF(trim(COALESCE(v_item->>'serial_number', '')), '');
      v_expiry_date := NULLIF(v_item->>'expiry_date', '')::DATE;
      v_date_of_purchase := NULLIF(v_item->>'date_of_purchase', '')::DATE;
      v_buying_price := NULLIF(v_item->>'buying_price', '')::NUMERIC;
      v_selling_price := NULLIF(v_item->>'selling_price', '')::NUMERIC;
      v_stock_quantity := NULLIF(v_item->>'stock_quantity', '')::INTEGER;
      v_low_stock_threshold := COALESCE(NULLIF(v_item->>'low_stock_threshold', '')::INTEGER, 10);
    EXCEPTION WHEN data_exception THEN
      RAISE EXCEPTION 'Invoice row % has an invalid date, price, quantity, or stock threshold', v_row_number;
    END;

    IF v_name = '' OR char_length(v_name) > 120 THEN
      RAISE EXCEPTION 'Invoice row % needs a product name of 120 characters or fewer', v_row_number;
    END IF;
    IF v_buying_price IS NULL OR v_buying_price < 0
      OR v_selling_price IS NULL OR v_selling_price < v_buying_price THEN
      RAISE EXCEPTION 'Invoice row % needs a selling price at least as high as its non-negative buying price', v_row_number;
    END IF;
    IF v_stock_quantity IS NULL OR v_stock_quantity < 1
      OR v_low_stock_threshold < 0 THEN
      RAISE EXCEPTION 'Invoice row % needs a positive whole-number quantity and a non-negative stock threshold', v_row_number;
    END IF;
    IF v_expiry_date IS NOT NULL AND v_date_of_purchase IS NOT NULL
      AND v_date_of_purchase > v_expiry_date THEN
      RAISE EXCEPTION 'Invoice row % has a purchase date after its expiry date', v_row_number;
    END IF;
    IF char_length(COALESCE(v_serial_number, '')) > 120 THEN
      RAISE EXCEPTION 'Invoice row % has a batch number longer than 120 characters', v_row_number;
    END IF;

    v_id := public.add_inventory_batch(
      p_name := v_name,
      p_serial_number := v_serial_number,
      p_expiry_date := v_expiry_date,
      p_date_of_purchase := v_date_of_purchase,
      p_buying_price := v_buying_price,
      p_selling_price := v_selling_price,
      p_stock_quantity := v_stock_quantity,
      p_low_stock_threshold := v_low_stock_threshold,
      p_reason := v_reason
    );
    v_ids := array_append(v_ids, v_id);
  END LOOP;

  RETURN v_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.add_inventory_batches(JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_inventory_batches(JSONB, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';


COMMIT;