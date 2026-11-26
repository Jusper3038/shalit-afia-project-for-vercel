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
