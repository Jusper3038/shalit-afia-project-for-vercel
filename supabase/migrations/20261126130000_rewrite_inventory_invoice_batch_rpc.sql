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
