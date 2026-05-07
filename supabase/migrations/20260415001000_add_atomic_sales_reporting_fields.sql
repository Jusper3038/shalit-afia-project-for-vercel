ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS sale_day DATE,
ADD COLUMN IF NOT EXISTS sale_week_start DATE,
ADD COLUMN IF NOT EXISTS sale_month INTEGER,
ADD COLUMN IF NOT EXISTS sale_year INTEGER,
ADD COLUMN IF NOT EXISTS unit_buying_price NUMERIC(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit_selling_price NUMERIC(10,2) NOT NULL DEFAULT 0;

UPDATE public.transactions AS t
SET
  sale_day = COALESCE(
    t.sale_day,
    timezone('Africa/Nairobi', COALESCE(t.date, t.created_at))::date
  ),
  sale_week_start = COALESCE(
    t.sale_week_start,
    (
      timezone('Africa/Nairobi', COALESCE(t.date, t.created_at))::date
      - (
        EXTRACT(ISODOW FROM timezone('Africa/Nairobi', COALESCE(t.date, t.created_at)))::integer - 1
      )
    )::date
  ),
  sale_month = COALESCE(
    t.sale_month,
    EXTRACT(MONTH FROM timezone('Africa/Nairobi', COALESCE(t.date, t.created_at)))::integer
  ),
  sale_year = COALESCE(
    t.sale_year,
    EXTRACT(YEAR FROM timezone('Africa/Nairobi', COALESCE(t.date, t.created_at)))::integer
  ),
  unit_buying_price = COALESCE(
    NULLIF(t.unit_buying_price, 0),
    (SELECT d.buying_price FROM public.drugs AS d WHERE d.id = t.drug_id),
    0
  ),
  unit_selling_price = COALESCE(
    NULLIF(t.unit_selling_price, 0),
    CASE
      WHEN t.quantity > 0 THEN ROUND((t.total_cost / t.quantity)::numeric, 2)
      ELSE 0
    END
  );

ALTER TABLE public.transactions
ALTER COLUMN sale_day SET DEFAULT timezone('Africa/Nairobi', now())::date,
ALTER COLUMN sale_day SET NOT NULL,
ALTER COLUMN sale_week_start SET DEFAULT (
  timezone('Africa/Nairobi', now())::date
  - (
    EXTRACT(ISODOW FROM timezone('Africa/Nairobi', now()))::integer - 1
  )
)::date,
ALTER COLUMN sale_week_start SET NOT NULL,
ALTER COLUMN sale_month SET DEFAULT EXTRACT(MONTH FROM timezone('Africa/Nairobi', now()))::integer,
ALTER COLUMN sale_month SET NOT NULL,
ALTER COLUMN sale_year SET DEFAULT EXTRACT(YEAR FROM timezone('Africa/Nairobi', now()))::integer,
ALTER COLUMN sale_year SET NOT NULL;

CREATE INDEX IF NOT EXISTS transactions_user_sale_day_idx
  ON public.transactions (user_id, sale_day DESC);

CREATE INDEX IF NOT EXISTS transactions_user_sale_week_start_idx
  ON public.transactions (user_id, sale_week_start DESC);

CREATE INDEX IF NOT EXISTS transactions_user_sale_year_month_idx
  ON public.transactions (user_id, sale_year DESC, sale_month DESC);

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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

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
      unit_selling_price
    )
    VALUES (
      auth.uid(),
      p_patient_id,
      v_drug.id,
      v_quantity,
      v_drug.selling_price * v_quantity,
      v_sale_timestamp,
      v_sale_day,
      v_sale_week_start,
      v_sale_month,
      v_sale_year,
      v_drug.buying_price,
      v_drug.selling_price
    )
    RETURNING *
    INTO v_transaction;

    RETURN NEXT v_transaction;
  END LOOP;

  RETURN;
END;
$$;
