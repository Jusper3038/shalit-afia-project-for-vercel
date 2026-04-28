ALTER TABLE public.profiles
ALTER COLUMN minimum_profit_retention_percentage SET DEFAULT 0;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_minimum_profit_retention_percentage_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_minimum_profit_retention_percentage_check
CHECK (minimum_profit_retention_percentage >= 0 AND minimum_profit_retention_percentage <= 100);

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
  v_transaction public.transactions%ROWTYPE;
  v_maximum_discount_percentage NUMERIC(5,2) := 0;
  v_requested_unit_selling_price NUMERIC(10,2);
  v_protected_unit_selling_price NUMERIC(10,2);
  v_discount_amount NUMERIC(10,2);
  v_discount_percentage NUMERIC(5,2);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT minimum_profit_retention_percentage
  INTO v_maximum_discount_percentage
  FROM public.profiles
  WHERE user_id = auth.uid();

  v_maximum_discount_percentage := COALESCE(v_maximum_discount_percentage, 0);

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one sale item is required';
  END IF;

  IF p_patient_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.patients
    WHERE id = p_patient_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Patient not found';
  END IF;

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
      AND user_id = auth.uid()
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory item not found';
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
      AND user_id = auth.uid();

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
      auth.uid(),
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
