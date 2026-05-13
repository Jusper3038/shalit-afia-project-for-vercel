DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'drugs_name_not_blank'
  ) THEN
    ALTER TABLE public.drugs
      ADD CONSTRAINT drugs_name_not_blank
      CHECK (char_length(btrim(name)) > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'drugs_buying_price_non_negative'
  ) THEN
    ALTER TABLE public.drugs
      ADD CONSTRAINT drugs_buying_price_non_negative
      CHECK (buying_price >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'drugs_selling_price_non_negative'
  ) THEN
    ALTER TABLE public.drugs
      ADD CONSTRAINT drugs_selling_price_non_negative
      CHECK (selling_price >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'drugs_stock_quantity_non_negative'
  ) THEN
    ALTER TABLE public.drugs
      ADD CONSTRAINT drugs_stock_quantity_non_negative
      CHECK (stock_quantity >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'drugs_low_stock_threshold_non_negative'
  ) THEN
    ALTER TABLE public.drugs
      ADD CONSTRAINT drugs_low_stock_threshold_non_negative
      CHECK (low_stock_threshold >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'drugs_purchase_before_expiry'
  ) THEN
    ALTER TABLE public.drugs
      ADD CONSTRAINT drugs_purchase_before_expiry
      CHECK (
        expiry_date IS NULL
        OR date_of_purchase IS NULL
        OR date_of_purchase <= expiry_date
      ) NOT VALID;
  END IF;
END
$$;
